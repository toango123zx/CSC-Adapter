// src/modules/agent-gateway/agent.gateway.ts
// WebSocket Gateway cho Agent UI — Platform-agnostic, nhận broadcast từ Hub
import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
    IStandardMessage,
    IAgentNotifier,
} from 'src/common/interfaces/standard-message.interface';
import { Platform, SenderType, MessageType } from 'src/common/enums';
import { ChatHubService } from '../chat-hub/chat-hub.service';

@WebSocketGateway({ cors: true, namespace: '/agent' })
export class AgentGateway
    implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, IAgentNotifier {
    private readonly logger = new Logger(AgentGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(private readonly chatHubService: ChatHubService) { }

    // ============ LIFECYCLE ============

    onModuleInit() {
        this.chatHubService.registerNotifier(this);
        this.logger.log('✅ Agent Gateway đã đăng ký với Chat Hub');
    }

    // ============ IAgentNotifier ============

    /**
     * Hub gọi method này khi có tin nhắn mới từ khách hàng.
     * Gateway broadcast đến tất cả agents đang kết nối qua WebSocket.
     */
    notifyAgents(message: IStandardMessage): void {
        this.server.emit('new_customer_message', {
            platform: message.platform,
            threadId: message.platformThreadId,
            message: {
                ...message,
                receivedAt: new Date(),
            },
        });

        this.logger.log(
            `📡 Broadcast: [${message.platform}] ${message.senderName}: ${message.text || '[media]'}`,
        );
    }

    // ============ CONNECTION EVENTS ============

    handleConnection(client: Socket) {
        this.logger.log(`🔌 Agent connected: ${client.id}`);
        client.emit('connected', {
            message: 'Đã kết nối Agent Gateway',
            clientId: client.id,
            registeredAdapters: this.chatHubService.getRegisteredAdapters(),
        });
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`🔌 Agent disconnected: ${client.id}`);
    }

    // ============ AGENT REPLY → KHÁCH HÀNG ============

    /**
     * Agent gửi tin nhắn text → route đến đúng platform của khách hàng.
     * Payload PHẢI có `platform` để Hub biết route đi đâu.
     */
    @SubscribeMessage('agent_reply')
    async handleAgentReply(
        @MessageBody()
        payload: {
            platform: Platform;
            threadId: string;
            agentName: string;
            text: string;
        },
        @ConnectedSocket() client: Socket,
    ) {
        this.logger.log(
            `📩 Agent "${payload.agentName}" → [${payload.platform}] Thread ${payload.threadId}`,
        );

        const standardMsg: IStandardMessage = {
            platform: payload.platform,
            platformThreadId: payload.threadId,
            platformMessageId: `agent_${Date.now()}`,
            senderType: SenderType.AGENT,
            senderName: payload.agentName || 'Nhân viên CSKH',
            messageType: MessageType.TEXT,
            text: payload.text,
            timestamp: new Date(),
        };

        const result = await this.chatHubService.routeToCustomer(
            payload.platform,
            payload.threadId,
            standardMsg,
        );

        client.emit('message_sent', {
            success: result,
            platform: payload.platform,
            threadId: payload.threadId,
            text: payload.text,
            timestamp: new Date(),
        });
    }

    /**
     * Agent gửi ảnh → route đến đúng platform.
     */
    @SubscribeMessage('agent_reply_image')
    async handleAgentImage(
        @MessageBody()
        payload: {
            platform: Platform;
            threadId: string;
            agentName: string;
            imageUrl: string;
            caption?: string;
        },
        @ConnectedSocket() client: Socket,
    ) {
        const standardMsg: IStandardMessage = {
            platform: payload.platform,
            platformThreadId: payload.threadId,
            platformMessageId: `agent_${Date.now()}`,
            senderType: SenderType.AGENT,
            senderName: payload.agentName || 'Nhân viên CSKH',
            messageType: MessageType.IMAGE,
            text: payload.caption || '',
            mediaUrl: payload.imageUrl,
            timestamp: new Date(),
        };

        const result = await this.chatHubService.routeToCustomer(
            payload.platform,
            payload.threadId,
            standardMsg,
        );

        client.emit('message_sent', { success: result, type: 'image' });
    }

    /**
     * Agent gửi file → route đến đúng platform.
     */
    @SubscribeMessage('agent_reply_file')
    async handleAgentFile(
        @MessageBody()
        payload: {
            platform: Platform;
            threadId: string;
            agentName: string;
            fileUrl: string;
            fileName: string;
        },
        @ConnectedSocket() client: Socket,
    ) {
        const standardMsg: IStandardMessage = {
            platform: payload.platform,
            platformThreadId: payload.threadId,
            platformMessageId: `agent_${Date.now()}`,
            senderType: SenderType.AGENT,
            senderName: payload.agentName || 'Nhân viên CSKH',
            messageType: MessageType.FILE,
            text: `📎 ${payload.fileName}`,
            mediaUrl: payload.fileUrl,
            metadata: { fileName: payload.fileName },
            timestamp: new Date(),
        };

        const result = await this.chatHubService.routeToCustomer(
            payload.platform,
            payload.threadId,
            standardMsg,
        );

        client.emit('message_sent', { success: result, type: 'file' });
    }
}
