// src/modules/adapters/livechat/livechat.gateway.ts
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
import {
  IChatAdapter,
  IStandardMessage,
  Platform,
  SenderType,
  MessageType,
} from 'src/common/interfaces/standard-message.interface';
import { ChatHubService } from '../../chat-hub/chat-hub.service';
import { LivechatService } from './livechat.service';

@WebSocketGateway({ cors: true, namespace: '/livechat' })
export class LivechatGateway implements IChatAdapter, OnGatewayConnection, OnGatewayDisconnect {
  platform = Platform.LIVECHAT;
  private readonly logger = new Logger(LivechatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private chatHubService: ChatHubService,
    private livechatService: LivechatService,
  ) {
    this.chatHubService.registerAdapter(this.platform, this);
  }

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
   * Payload: { customerThreadId: 'telegram_chat_id', agentName: 'Agent 1', text: 'Xin chào' }
   */
  @SubscribeMessage('agent_send_message')
  async handleAgentMessage(
    @MessageBody() payload: { customerThreadId: string; agentName: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`📩 Agent "${payload.agentName}" → Thread ${payload.customerThreadId}: ${payload.text}`);
    const standardMsg = await this.parseWebhook(payload);
    await this.chatHubService.handleIncomingMessage(standardMsg);

    // Xác nhận cho agent
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
      platform: this.platform,
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
      platform: this.platform,
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

  // ============ LIVECHAT WEBHOOK (incoming from LiveChat) ============

  /**
   * Xử lý webhook incoming_chat từ LiveChat
   * Khi có khách chat vào LiveChat widget → chuyển vào hệ thống
   */
  @SubscribeMessage('livechat_webhook')
  async handleLivechatWebhook(@MessageBody() payload: any) {
    this.logger.log(`📨 LiveChat webhook: ${JSON.stringify(payload).substring(0, 200)}`);

    if (payload.action === 'incoming_chat' || payload.action === 'incoming_event') {
      const event = payload.payload?.event || payload.payload?.chat?.thread?.events?.[0];
      if (event && event.type === 'message') {
        const chatId = payload.payload?.chat_id || payload.payload?.chat?.id;
        const standardMsg: IStandardMessage = {
          platform: this.platform,
          platformThreadId: chatId,
          platformMessageId: event.id || `lc_${Date.now()}`,
          senderType: event.author_id?.startsWith('customer') ? SenderType.USER : SenderType.AGENT,
          senderName: event.author_id || 'Customer',
          messageType: MessageType.TEXT,
          text: event.text,
          timestamp: new Date(event.created_at || Date.now()),
        };

        // Phát cho tất cả agents đang kết nối
        this.server.emit('new_message_to_agent', {
          threadId: chatId,
          messageData: standardMsg,
        });
      }
    }
  }

  // ============ LIVECHAT API QUERIES (từ Frontend) ============

  /**
   * Frontend yêu cầu danh sách chats đang hoạt động
   */
  @SubscribeMessage('get_active_chats')
  async handleGetActiveChats(@ConnectedSocket() client: Socket) {
    const chats = await this.livechatService.listChats();
    client.emit('active_chats', chats);
  }

  /**
   * Frontend yêu cầu chi tiết chat
   */
  @SubscribeMessage('get_chat_detail')
  async handleGetChatDetail(
    @MessageBody() payload: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const chat = await this.livechatService.getChat(payload.chatId);
    client.emit('chat_detail', chat);
  }

  /**
   * Frontend yêu cầu thay đổi trạng thái agent
   */
  @SubscribeMessage('set_agent_status')
  async handleSetAgentStatus(
    @MessageBody() payload: { status: 'accepting_chats' | 'not_accepting_chats' | 'offline' },
    @ConnectedSocket() client: Socket,
  ) {
    const result = await this.livechatService.setRoutingStatus(payload.status);
    client.emit('agent_status_updated', { status: payload.status, result });
  }

  /**
   * Frontend gửi typing indicator
   */
  @SubscribeMessage('typing_indicator')
  async handleTypingIndicator(
    @MessageBody() payload: { chatId: string; isTyping: boolean },
  ) {
    await this.livechatService.sendTypingIndicator(payload.chatId, payload.isTyping);
  }

  // ============ ADAPTER INTERFACE ============

  async parseWebhook(payload: any): Promise<IStandardMessage> {
    return {
      platform: this.platform,
      platformThreadId: payload.customerThreadId,
      platformMessageId: `lc_${Date.now()}`,
      senderType: SenderType.AGENT,
      senderName: payload.agentName || 'Nhân viên CSKH',
      messageType: MessageType.TEXT,
      text: payload.text,
      timestamp: new Date(),
    };
  }

  /**
   * Được Hub gọi khi có tin nhắn từ nền tảng khác (VD: Telegram) đến
   * → Phát qua WebSocket cho tất cả nhân viên đang online
   */
  async sendMessage(destinationThreadId: string, message: IStandardMessage): Promise<boolean> {
    try {
      // Phát event qua WebSocket để giao diện Livechat của nhân viên nhận
      this.server.emit('new_message_to_agent', {
        threadId: destinationThreadId,
        messageData: {
          ...message,
          receivedAt: new Date(),
        },
      });

      this.logger.log(`📤 Đã phát tin nhắn đến LiveChat agents (thread: ${destinationThreadId})`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Lỗi phát WebSocket: ${error.message}`);
      return false;
    }
  }
}