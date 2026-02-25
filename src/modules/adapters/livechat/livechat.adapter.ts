// src/modules/adapters/livechat/livechat.adapter.ts
// LiveChat Adapter - Chuyển đổi giữa LiveChat format ↔ IStandardMessage
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { IChatAdapter, IStandardMessage } from 'src/common/interfaces/standard-message.interface';
import { Platform, SenderType, MessageType } from 'src/common/enums';
import { LivechatApiService } from './livechat-api.service';
import { ChatHubService } from '../../chat-hub/chat-hub.service';

@Injectable()
export class LivechatAdapter implements IChatAdapter, OnModuleInit {
    readonly platform = Platform.LIVECHAT;
    private readonly logger = new Logger(LivechatAdapter.name);

    constructor(
        private readonly livechatApiService: LivechatApiService,
        private readonly chatHubService: ChatHubService,
    ) { }

    onModuleInit() {
        this.chatHubService.registerAdapter(this.platform, this);
        this.logger.log('✅ LiveChat Adapter đã đăng ký với Chat Hub');
    }

    // ============ PARSE INCOMING WEBHOOK ============

    /**
     * Chuyển payload webhook từ LiveChat → IStandardMessage
     * Hỗ trợ các action: incoming_chat, incoming_event, incoming_chat_thread
     */
    async parseIncomingWebhook(payload: any): Promise<IStandardMessage | null> {
        try {
            const action = payload?.action;

            if (action === 'incoming_chat' || action === 'incoming_chat_thread') {
                return this.parseIncomingChat(payload);
            }

            if (action === 'incoming_event') {
                return this.parseIncomingEvent(payload);
            }

            this.logger.warn(`⚠️ Webhook action không được hỗ trợ: ${action}`);
            return null;
        } catch (error) {
            this.logger.error(`❌ Lỗi parse webhook: ${error.message}`);
            return null;
        }
    }

    /**
     * Parse incoming_chat / incoming_chat_thread webhook
     */
    private parseIncomingChat(payload: any): IStandardMessage | null {
        const chat = payload?.payload?.chat;
        if (!chat) return null;

        const thread = chat.thread || chat.threads?.[0];
        if (!thread) return null;

        // Lấy event message đầu tiên (nếu có)
        const messageEvent = thread.events?.find((e: any) => e.type === 'message');
        if (!messageEvent) return null;

        const chatId = chat.id;

        return {
            platform: this.platform,
            platformThreadId: chatId,
            platformMessageId: messageEvent.id || `lc_${Date.now()}`,
            senderType: this.detectSenderType(messageEvent.author_id, payload),
            senderName: this.findSenderName(messageEvent.author_id, chat.users) || 'Customer',
            senderId: messageEvent.author_id,
            messageType: this.mapEventType(messageEvent.type),
            text: messageEvent.text,
            mediaUrl: messageEvent.url,
            metadata: {
                threadId: thread.id,
                properties: messageEvent.properties,
            },
            timestamp: new Date(messageEvent.created_at || Date.now()),
        };
    }

    /**
     * Parse incoming_event webhook (tin nhắn đơn lẻ trong chat đang mở)
     */
    private parseIncomingEvent(payload: any): IStandardMessage | null {
        const chatId = payload?.payload?.chat_id;
        const event = payload?.payload?.event;
        if (!chatId || !event) return null;

        return {
            platform: this.platform,
            platformThreadId: chatId,
            platformMessageId: event.id || `lc_${Date.now()}`,
            senderType: this.detectSenderType(event.author_id, payload),
            senderName: event.author_id || 'Customer',
            senderId: event.author_id,
            messageType: this.mapEventType(event.type),
            text: event.text,
            mediaUrl: event.url,
            metadata: {
                threadId: payload?.payload?.thread_id,
                properties: event.properties,
            },
            timestamp: new Date(event.created_at || Date.now()),
        };
    }

    // ============ SEND MESSAGE ============

    /**
     * Gửi IStandardMessage tới LiveChat qua API
     * Được gọi bởi ChatHub khi có tin nhắn từ nền tảng khác (VD: Telegram)
     */
    async sendMessage(destinationThreadId: string, message: IStandardMessage): Promise<boolean> {
        try {
            switch (message.messageType) {
                case MessageType.IMAGE:
                case MessageType.FILE:
                    if (message.mediaUrl) {
                        const contentType = message.messageType === MessageType.IMAGE ? 'image/png' : 'application/octet-stream';
                        const fileName = message.metadata?.fileName || 'file';
                        await this.livechatApiService.sendFile(destinationThreadId, message.mediaUrl, contentType, fileName);
                    }
                    break;

                case MessageType.TEXT:
                default:
                    const text = message.text || '';
                    const formattedText = `[${message.senderName}]: ${text}`;
                    await this.livechatApiService.sendMessage(destinationThreadId, formattedText);
                    break;
            }

            this.logger.log(`📤 Đã gửi ${message.messageType} đến LiveChat thread: ${destinationThreadId}`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Lỗi gửi LiveChat: ${error.message}`);
            return false;
        }
    }

    // ============ PARSE FROM AGENT (WebSocket) ============

    /**
     * Parse tin nhắn từ agent (qua WebSocket Gateway) → IStandardMessage
     */
    parseAgentMessage(payload: {
        customerThreadId: string;
        agentName: string;
        text: string;
    }): IStandardMessage {
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

    // ============ HELPERS ============

    /**
     * Xác định loại người gửi dựa trên author_id
     */
    private detectSenderType(authorId: string, payload: any): SenderType {
        if (!authorId) return SenderType.USER;

        // Nếu author_id chứa format email → là agent
        if (authorId.includes('@')) return SenderType.AGENT;

        // Kiểm tra trong users list
        const users = payload?.payload?.chat?.users || [];
        const user = users.find((u: any) => u.id === authorId);
        if (user) {
            if (user.type === 'agent') return SenderType.AGENT;
            if (user.type === 'customer') return SenderType.USER;
        }

        return SenderType.USER;
    }

    /**
     * Tìm tên người gửi từ danh sách users
     */
    private findSenderName(authorId: string, users: any[]): string | null {
        if (!users || !authorId) return null;
        const user = users.find((u: any) => u.id === authorId);
        return user?.name || null;
    }

    /**
     * Map LiveChat event type → MessageType
     */
    private mapEventType(eventType: string): MessageType {
        switch (eventType) {
            case 'message':
                return MessageType.TEXT;
            case 'file':
                return MessageType.FILE;
            case 'rich_message':
                return MessageType.RICH_MESSAGE;
            case 'system_message':
                return MessageType.SYSTEM_EVENT;
            default:
                return MessageType.TEXT;
        }
    }
}
