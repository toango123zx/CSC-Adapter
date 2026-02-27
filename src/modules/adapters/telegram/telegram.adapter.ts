// src/modules/adapters/telegram/telegram.adapter.ts
// Telegram Adapter — Sở hữu message parsing + listener registration + message storage
// Dependency 1 chiều: Adapter → Service (KHÔNG có forwardRef)
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  IChatAdapter,
  IStandardMessage,
} from 'src/common/interfaces/standard-message.interface';
import { Platform, SenderType, MessageType } from 'src/common/enums';
import { TelegramService } from './telegram.service';
import { TelegramStoreService } from './telegram-store.service';
import { ChatHubService } from '../../chat-hub/chat-hub.service';
import { Context } from 'telegraf';
import {
  TelegramTextMessage,
  TelegramPhotoMessage,
  TelegramDocumentMessage,
  TelegramStickerMessage,
  TelegramLocationMessage,
  TelegramContactMessage,
  TelegramChatType,
} from './telegram.types';

@Injectable()
export class TelegramAdapter implements IChatAdapter, OnModuleInit {
  readonly platform = Platform.TELEGRAM;
  private readonly logger = new Logger(TelegramAdapter.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly storeService: TelegramStoreService,
    private readonly chatHubService: ChatHubService,
  ) { }

  // ============ LIFECYCLE ============

  onModuleInit() {
    this.chatHubService.registerAdapter(this.platform, this);
    this.setupListeners();
    this.telegramService.launch();
    this.logger.log('✅ Telegram Adapter đã khởi tạo và đăng ký với Chat Hub');
  }

  // ============ LISTENER REGISTRATION ============

  private setupListeners(): void {
    // --- TEXT ---
    this.telegramService.registerHandler('text', async (ctx: Context) => {
      if (ctx.message && 'text' in ctx.message && ctx.message.text.startsWith('/')) return;
      if (ctx.from?.is_bot) return; // Bỏ qua tin nhắn từ bot khác (tránh echo loop)
      const msg = this.parseTextMessage(ctx);
      this.trackConversation(ctx);
      this.storeService.storeMessage(msg, 'incoming');
      await this.chatHubService.handleIncomingMessage(msg);
    });

    // --- PHOTO ---
    this.telegramService.registerHandler('photo', async (ctx: Context) => {
      if (ctx.from?.is_bot) return;
      const msg = await this.parsePhotoMessage(ctx);
      this.trackConversation(ctx);
      this.storeService.storeMessage(msg, 'incoming');
      await this.chatHubService.handleIncomingMessage(msg);
    });

    // --- DOCUMENT ---
    this.telegramService.registerHandler('document', async (ctx: Context) => {
      if (ctx.from?.is_bot) return;
      const msg = await this.parseDocumentMessage(ctx);
      this.trackConversation(ctx);
      this.storeService.storeMessage(msg, 'incoming');
      await this.chatHubService.handleIncomingMessage(msg);
    });

    // --- STICKER ---
    this.telegramService.registerHandler('sticker', async (ctx: Context) => {
      if (ctx.from?.is_bot) return;
      const msg = this.parseStickerMessage(ctx);
      this.trackConversation(ctx);
      this.storeService.storeMessage(msg, 'incoming');
      await this.chatHubService.handleIncomingMessage(msg);
    });

    // --- LOCATION ---
    this.telegramService.registerHandler('location', async (ctx: Context) => {
      if (ctx.from?.is_bot) return;
      const msg = this.parseLocationMessage(ctx);
      this.trackConversation(ctx);
      this.storeService.storeMessage(msg, 'incoming');
      await this.chatHubService.handleIncomingMessage(msg);
    });

    // --- CONTACT ---
    this.telegramService.registerHandler('contact', async (ctx: Context) => {
      if (ctx.from?.is_bot) return;
      const msg = this.parseContactMessage(ctx);
      this.trackConversation(ctx);
      this.storeService.storeMessage(msg, 'incoming');
      await this.chatHubService.handleIncomingMessage(msg);
    });

    // --- NEW CHAT MEMBERS (Bot được add vào nhóm mới) ---
    this.telegramService.registerHandler('new_chat_members' as any, async (ctx: Context) => {
      if (!ctx.message || !('new_chat_members' in ctx.message)) return;
      const newMembers = (ctx.message as any).new_chat_members as any[];
      const botInfo = await ctx.telegram.getMe();

      for (const member of newMembers) {
        if (member.id === botInfo.id) {
          const chatId = ctx.chat!.id.toString();
          const chatTitle = (ctx.chat as any).title || 'Unknown Group';
          this.logger.log(`🤖 Bot đã được thêm vào group: "${chatTitle}" (ID: ${chatId})`);

          // Track conversation ngay khi bot được add
          this.storeService.upsertConversation(
            chatId,
            (ctx.chat!.type || 'group') as TelegramChatType,
            chatTitle,
            ctx.from?.id.toString() || 'system',
            undefined,
          );
        }
      }
    });

    this.logger.log('📌 Đã đăng ký 7 message handlers với Telegram bot (bao gồm group listener)');
  }

  // ============ CONVERSATION TRACKING ============

  /**
   * Cập nhật conversation metadata từ Telegram context.
   * Gọi mỗi khi nhận tin nhắn incoming.
   */
  private trackConversation(ctx: Context): void {
    const chatId = ctx.chat!.id.toString();
    const chatType = (ctx.chat!.type || 'private') as TelegramChatType;
    const customerName = ctx.from!.first_name || 'Khách hàng';
    const customerId = ctx.from!.id.toString();
    const languageCode = ctx.from!.language_code;

    this.storeService.upsertConversation(
      chatId,
      chatType,
      customerName,
      customerId,
      languageCode,
    );
  }

  // ============ IChatAdapter: parseIncomingWebhook ============

  async parseIncomingWebhook(
    payload: Context,
  ): Promise<IStandardMessage | null> {
    try {
      return this.parseTextMessage(payload);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Lỗi parse webhook: ${errorMsg}`);
      return null;
    }
  }

  // ============ IChatAdapter: sendMessage ============

  async sendMessage(
    destinationThreadId: string,
    message: IStandardMessage,
  ): Promise<boolean> {
    // Lưu outgoing message vào store
    this.storeService.storeMessage(message, 'outgoing');

    return this.telegramService.sendStandardMessage(
      destinationThreadId,
      message,
    );
  }

  // ============ PARSERS ============

  private extractBaseInfo(ctx: Context): {
    threadId: string;
    messageId: string;
    senderName: string;
    senderId: string;
    timestamp: Date;
  } {
    return {
      threadId: ctx.chat!.id.toString(),
      messageId: ctx.message!.message_id.toString(),
      senderName: ctx.from!.first_name || 'Khách hàng',
      senderId: ctx.from!.id.toString(),
      timestamp: new Date(ctx.message!.date * 1000),
    };
  }

  parseTextMessage(ctx: Context): IStandardMessage {
    const base = this.extractBaseInfo(ctx);
    const msg = ctx.message as unknown as TelegramTextMessage;
    return {
      platform: this.platform,
      platformThreadId: base.threadId,
      platformMessageId: base.messageId,
      senderType: SenderType.USER,
      senderName: base.senderName,
      senderId: base.senderId,
      messageType: MessageType.TEXT,
      text: msg.text,
      timestamp: base.timestamp,
    };
  }

  async parsePhotoMessage(ctx: Context): Promise<IStandardMessage> {
    const base = this.extractBaseInfo(ctx);
    const msg = ctx.message as unknown as TelegramPhotoMessage;
    const largestPhoto = msg.photo[msg.photo.length - 1];
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
    return {
      platform: this.platform,
      platformThreadId: base.threadId,
      platformMessageId: base.messageId,
      senderType: SenderType.USER,
      senderName: base.senderName,
      senderId: base.senderId,
      messageType: MessageType.IMAGE,
      text: msg.caption || '📷 Đã gửi ảnh',
      mediaUrl: fileLink.href,
      metadata: {
        fileId: largestPhoto.file_id,
        width: largestPhoto.width,
        height: largestPhoto.height,
      },
      timestamp: base.timestamp,
    };
  }

  async parseDocumentMessage(ctx: Context): Promise<IStandardMessage> {
    const base = this.extractBaseInfo(ctx);
    const msg = ctx.message as unknown as TelegramDocumentMessage;
    const doc = msg.document;
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    return {
      platform: this.platform,
      platformThreadId: base.threadId,
      platformMessageId: base.messageId,
      senderType: SenderType.USER,
      senderName: base.senderName,
      senderId: base.senderId,
      messageType: MessageType.FILE,
      text: msg.caption || `📎 Đã gửi file: ${doc.file_name}`,
      mediaUrl: fileLink.href,
      metadata: {
        fileId: doc.file_id,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
      },
      timestamp: base.timestamp,
    };
  }

  parseStickerMessage(ctx: Context): IStandardMessage {
    const base = this.extractBaseInfo(ctx);
    const msg = ctx.message as unknown as TelegramStickerMessage;
    const sticker = msg.sticker;
    return {
      platform: this.platform,
      platformThreadId: base.threadId,
      platformMessageId: base.messageId,
      senderType: SenderType.USER,
      senderName: base.senderName,
      senderId: base.senderId,
      messageType: MessageType.STICKER,
      text: `${sticker.emoji || '🏷️'} Sticker`,
      metadata: {
        fileId: sticker.file_id,
        emoji: sticker.emoji,
        setName: sticker.set_name,
      },
      timestamp: base.timestamp,
    };
  }

  parseLocationMessage(ctx: Context): IStandardMessage {
    const base = this.extractBaseInfo(ctx);
    const msg = ctx.message as unknown as TelegramLocationMessage;
    const location = msg.location;
    return {
      platform: this.platform,
      platformThreadId: base.threadId,
      platformMessageId: base.messageId,
      senderType: SenderType.USER,
      senderName: base.senderName,
      senderId: base.senderId,
      messageType: MessageType.LOCATION,
      text: `📍 Vị trí: ${location.latitude}, ${location.longitude}`,
      metadata: { latitude: location.latitude, longitude: location.longitude },
      timestamp: base.timestamp,
    };
  }

  parseContactMessage(ctx: Context): IStandardMessage {
    const base = this.extractBaseInfo(ctx);
    const msg = ctx.message as unknown as TelegramContactMessage;
    const contact = msg.contact;
    return {
      platform: this.platform,
      platformThreadId: base.threadId,
      platformMessageId: base.messageId,
      senderType: SenderType.USER,
      senderName: base.senderName,
      senderId: base.senderId,
      messageType: MessageType.CONTACT,
      text: `📞 Liên hệ: ${contact.first_name} ${contact.last_name || ''} - ${contact.phone_number}`,
      metadata: {
        firstName: contact.first_name,
        lastName: contact.last_name,
        phoneNumber: contact.phone_number,
      },
      timestamp: base.timestamp,
    };
  }
}
