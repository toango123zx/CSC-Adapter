// src/modules/adapters/livechat/livechat.adapter.ts
// LiveChat Adapter — Chuyển đổi giữa LiveChat format ↔ IStandardMessage
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  IChatAdapter,
  IStandardMessage,
} from 'src/common/interfaces/standard-message.interface';
import { Platform, SenderType, MessageType } from 'src/common/enums';
import { LivechatApiService } from './livechat-api.service';
import { ChatHubService } from '../../chat-hub/chat-hub.service';
import {
  LivechatWebhookPayload,
  LivechatUser,
} from './livechat-api.types';

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
   * Hỗ trợ: incoming_chat, incoming_event, incoming_chat_thread
   */
  async parseIncomingWebhook(
    payload: LivechatWebhookPayload,
  ): Promise<IStandardMessage | null> {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Lỗi parse webhook: ${message}`);
      return null;
    }
  }

  // ============ SEND MESSAGE ============

  /**
   * Gửi IStandardMessage tới LiveChat qua API.
   * Được gọi bởi ChatHub khi agent reply đến khách hàng trên LiveChat.
   */
  async sendMessage(
    destinationThreadId: string,
    message: IStandardMessage,
  ): Promise<boolean> {
    try {
      switch (message.messageType) {
        case MessageType.IMAGE:
        case MessageType.FILE: {
          if (message.mediaUrl) {
            const contentType =
              message.messageType === MessageType.IMAGE
                ? 'image/png'
                : 'application/octet-stream';
            const fileName =
              (message.metadata?.['fileName'] as string) || 'file';
            await this.livechatApiService.sendFile(
              destinationThreadId,
              message.mediaUrl,
              contentType,
              fileName,
            );
          }
          break;
        }

        case MessageType.TEXT:
        default: {
          const text = message.text || '';
          const formattedText = `[${message.senderName}]: ${text}`;
          await this.livechatApiService.sendMessage(
            destinationThreadId,
            formattedText,
          );
          break;
        }
      }

      this.logger.log(
        `📤 Đã gửi ${message.messageType} đến LiveChat thread: ${destinationThreadId}`,
      );
      return true;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Lỗi gửi LiveChat: ${errorMsg}`);
      return false;
    }
  }

  // ============ PRIVATE HELPERS ============

  private parseIncomingChat(
    payload: LivechatWebhookPayload,
  ): IStandardMessage | null {
    const chat = payload?.payload?.chat;
    if (!chat) return null;

    const thread = chat.thread || chat.threads?.[0];
    if (!thread) return null;

    const messageEvent = thread.events?.find((e) => e.type === 'message');
    if (!messageEvent) return null;

    return {
      platform: this.platform,
      platformThreadId: chat.id,
      platformMessageId: messageEvent.id || `lc_${Date.now()}`,
      senderType: this.detectSenderType(messageEvent.author_id, chat.users),
      senderName:
        this.findSenderName(messageEvent.author_id, chat.users) || 'Customer',
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

  private parseIncomingEvent(
    payload: LivechatWebhookPayload,
  ): IStandardMessage | null {
    const chatId = payload?.payload?.chat_id;
    const event = payload?.payload?.event;
    if (!chatId || !event) return null;

    return {
      platform: this.platform,
      platformThreadId: chatId,
      platformMessageId: event.id || `lc_${Date.now()}`,
      senderType: this.detectSenderType(event.author_id),
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

  private detectSenderType(
    authorId: string,
    users?: LivechatUser[],
  ): SenderType {
    if (!authorId) return SenderType.USER;
    if (authorId.includes('@')) return SenderType.AGENT;

    if (users) {
      const user = users.find((u) => u.id === authorId);
      if (user) {
        if (user.type === 'agent') return SenderType.AGENT;
        if (user.type === 'customer') return SenderType.USER;
      }
    }

    return SenderType.USER;
  }

  private findSenderName(
    authorId: string,
    users?: LivechatUser[],
  ): string | null {
    if (!users || !authorId) return null;
    const user = users.find((u) => u.id === authorId);
    return user?.name || null;
  }

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
