// src/modules/adapters/livechat/livechat.gateway.ts
// WebSocket Gateway cho Frontend - Không phải adapter, chỉ là cầu nối WebSocket
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { IStandardMessage } from 'src/common/interfaces/standard-message.interface';
import { SenderType, MessageType } from 'src/common/enums';
import { ChatHubService } from '../../chat-hub/chat-hub.service';
import { LivechatApiService } from './livechat-api.service';
import { LivechatAdapter } from './livechat.adapter';

@WebSocketGateway({ cors: true, namespace: '/livechat' })
export class LivechatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LivechatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatHubService: ChatHubService,
    private readonly livechatApi: LivechatApiService,
    private readonly livechatAdapter: LivechatAdapter,
  ) { }

  // ============ CONNECTION EVENTS ============

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Agent connected: ${client.id}`);
    client.emit('connected', { message: 'Đã kết nối LiveChat Gateway', clientId: client.id });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Agent disconnected: ${client.id}`);
  }

  // ============ AGENT → CUSTOMER (qua Hub) ============

  /**
   * Nhân viên gửi tin nhắn cho khách hàng
   */
  @SubscribeMessage('agent_send_message')
  async handleAgentMessage(
    @MessageBody() payload: { customerThreadId: string; agentName: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`📩 Agent "${payload.agentName}" → Thread ${payload.customerThreadId}: ${payload.text}`);

    const standardMsg = this.livechatAdapter.parseAgentMessage(payload);
    await this.chatHubService.handleIncomingMessage(standardMsg);

    client.emit('message_sent', {
      success: true,
      threadId: payload.customerThreadId,
      text: payload.text,
      timestamp: new Date(),
    });
  }

  /**
   * Nhân viên gửi ảnh cho khách hàng
   */
  @SubscribeMessage('agent_send_image')
  async handleAgentImage(
    @MessageBody() payload: { customerThreadId: string; agentName: string; imageUrl: string; caption?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const standardMsg: IStandardMessage = {
      platform: this.livechatAdapter.platform,
      platformThreadId: payload.customerThreadId,
      platformMessageId: `lc_${Date.now()}`,
      senderType: SenderType.AGENT,
      senderName: payload.agentName || 'Nhân viên CSKH',
      messageType: MessageType.IMAGE,
      text: payload.caption || '',
      mediaUrl: payload.imageUrl,
      timestamp: new Date(),
    };

    await this.chatHubService.handleIncomingMessage(standardMsg);
    client.emit('message_sent', { success: true, type: 'image' });
  }

  /**
   * Nhân viên gửi file cho khách hàng
   */
  @SubscribeMessage('agent_send_file')
  async handleAgentFile(
    @MessageBody() payload: { customerThreadId: string; agentName: string; fileUrl: string; fileName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const standardMsg: IStandardMessage = {
      platform: this.livechatAdapter.platform,
      platformThreadId: payload.customerThreadId,
      platformMessageId: `lc_${Date.now()}`,
      senderType: SenderType.AGENT,
      senderName: payload.agentName || 'Nhân viên CSKH',
      messageType: MessageType.FILE,
      text: `📎 ${payload.fileName}`,
      mediaUrl: payload.fileUrl,
      metadata: { fileName: payload.fileName },
      timestamp: new Date(),
    };

    await this.chatHubService.handleIncomingMessage(standardMsg);
    client.emit('message_sent', { success: true, type: 'file' });
  }

  // ============ LIVECHAT API QUERIES (từ Frontend) ============

  @SubscribeMessage('get_active_chats')
  async handleGetActiveChats(@ConnectedSocket() client: Socket) {
    const chats = await this.livechatApi.listChats();
    client.emit('active_chats', chats);
  }

  @SubscribeMessage('get_chat_detail')
  async handleGetChatDetail(
    @MessageBody() payload: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const chat = await this.livechatApi.getChat(payload.chatId);
    client.emit('chat_detail', chat);
  }

  @SubscribeMessage('set_agent_status')
  async handleSetAgentStatus(
    @MessageBody() payload: { status: 'accepting_chats' | 'not_accepting_chats' | 'offline' },
    @ConnectedSocket() client: Socket,
  ) {
    const result = await this.livechatApi.setRoutingStatus(payload.status);
    client.emit('agent_status_updated', { status: payload.status, result });
  }

  @SubscribeMessage('typing_indicator')
  async handleTypingIndicator(
    @MessageBody() payload: { chatId: string; isTyping: boolean },
  ) {
    await this.livechatApi.sendTypingIndicator(payload.chatId, payload.isTyping);
  }

  // ============ BROADCAST TO AGENTS ============

  /**
   * Phát tin nhắn mới đến tất cả agents đang kết nối
   * Có thể gọi từ bên ngoài (VD: từ webhook controller)
   */
  broadcastToAgents(threadId: string, message: IStandardMessage) {
    this.server.emit('new_message_to_agent', {
      threadId,
      messageData: { ...message, receivedAt: new Date() },
    });
  }
}