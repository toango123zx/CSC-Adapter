// src/modules/adapters/telegram/telegram.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import {
  IChatAdapter,
  IStandardMessage,
  Platform,
  SenderType,
  MessageType,
} from 'src/common/interfaces/standard-message.interface';
import { ChatHubService } from '../../chat-hub/chat-hub.service';

@Injectable()
export class TelegramService implements IChatAdapter, OnModuleInit, OnModuleDestroy {
  platform = Platform.TELEGRAM;
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private chatHubService: ChatHubService,
    private configService: ConfigService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new Telegraf(token);
  }

  // ============ LIFECYCLE ============

  onModuleInit() {
    this.chatHubService.registerAdapter(this.platform, this);
    this.setupCommands();
    this.setupListeners();
    this.bot.launch();
    this.logger.log('🤖 Telegram Bot đã khởi chạy!');
  }

  onModuleDestroy() {
    this.bot.stop('App shutting down');
    this.logger.log('🛑 Telegram Bot đã dừng.');
  }

  // ============ BOT COMMANDS ============

  private setupCommands() {
    // /start - Chào mừng
    this.bot.start((ctx) => {
      const name = ctx.from.first_name || 'bạn';
      ctx.reply(
        `👋 Xin chào ${name}!\n\n` +
        `Tôi là bot hỗ trợ khách hàng.\n` +
        `Hãy gửi tin nhắn, nhân viên CSKH sẽ phản hồi sớm nhất.\n\n` +
        `📝 Lệnh hỗ trợ:\n` +
        `/start - Bắt đầu trò chuyện\n` +
        `/help - Xem hướng dẫn\n` +
        `/info - Xem thông tin của bạn`,
      );
      this.logger.log(`👤 Khách hàng mới: ${name} (chatId: ${ctx.chat.id})`);
    });

    // /help
    this.bot.help((ctx) => {
      ctx.reply(
        `📖 Hướng dẫn sử dụng:\n\n` +
        `💬 Gửi tin nhắn văn bản - Nhân viên sẽ nhận và phản hồi\n` +
        `📷 Gửi ảnh - Có thể gửi kèm chú thích\n` +
        `📎 Gửi file - Hỗ trợ các loại tệp phổ biến\n` +
        `📍 Gửi vị trí - Chia sẻ location của bạn\n` +
        `📞 Gửi liên hệ - Chia sẻ thông tin liên hệ\n\n` +
        `Nhân viên CSKH sẽ phản hồi trong thời gian sớm nhất!`,
      );
    });

    // /info - Xem thông tin user
    this.bot.command('info', (ctx) => {
      const user = ctx.from;
      ctx.reply(
        `ℹ️ Thông tin của bạn:\n\n` +
        `👤 Tên: ${user.first_name} ${user.last_name || ''}\n` +
        `🆔 User ID: ${user.id}\n` +
        `💬 Chat ID: ${ctx.chat.id}\n` +
        `🌐 Ngôn ngữ: ${user.language_code || 'Không xác định'}`,
      );
    });
  }

  // ============ LISTENERS ============

  private setupListeners() {
    // Tin nhắn văn bản
    this.bot.on('text', async (ctx) => {
      // Bỏ qua các lệnh (đã xử lý ở trên)
      if (ctx.message.text.startsWith('/')) return;
      const standardMsg = await this.parseTextMessage(ctx);
      await this.chatHubService.handleIncomingMessage(standardMsg);
    });

    // Ảnh
    this.bot.on('photo', async (ctx) => {
      const standardMsg = await this.parsePhotoMessage(ctx);
      await this.chatHubService.handleIncomingMessage(standardMsg);
    });

    // File/Document
    this.bot.on('document', async (ctx) => {
      const standardMsg = await this.parseDocumentMessage(ctx);
      await this.chatHubService.handleIncomingMessage(standardMsg);
    });

    // Sticker
    this.bot.on('sticker', async (ctx) => {
      const standardMsg = await this.parseStickerMessage(ctx);
      await this.chatHubService.handleIncomingMessage(standardMsg);
    });

    // Location
    this.bot.on('location', async (ctx) => {
      const standardMsg = await this.parseLocationMessage(ctx);
      await this.chatHubService.handleIncomingMessage(standardMsg);
    });

    // Contact
    this.bot.on('contact', async (ctx) => {
      const standardMsg = await this.parseContactMessage(ctx);
      await this.chatHubService.handleIncomingMessage(standardMsg);
    });
  }

  // ============ PARSE MESSAGES ============

  async parseWebhook(ctx: any): Promise<IStandardMessage> {
    return this.parseTextMessage(ctx);
  }

  private async parseTextMessage(ctx: Context): Promise<IStandardMessage> {
    return {
      platform: this.platform,
      platformThreadId: ctx.chat.id.toString(),
      platformMessageId: ctx.message.message_id.toString(),
      senderType: SenderType.USER,
      senderName: ctx.from.first_name || 'Khách hàng',
      senderId: ctx.from.id.toString(),
      messageType: MessageType.TEXT,
      text: (ctx.message as any).text,
      timestamp: new Date(ctx.message.date * 1000),
    };
  }

  private async parsePhotoMessage(ctx: Context): Promise<IStandardMessage> {
    const photos = (ctx.message as any).photo;
    const largestPhoto = photos[photos.length - 1]; // Lấy ảnh chất lượng cao nhất
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
    const caption = (ctx.message as any).caption || '';

    return {
      platform: this.platform,
      platformThreadId: ctx.chat.id.toString(),
      platformMessageId: ctx.message.message_id.toString(),
      senderType: SenderType.USER,
      senderName: ctx.from.first_name || 'Khách hàng',
      senderId: ctx.from.id.toString(),
      messageType: MessageType.IMAGE,
      text: caption || '📷 Đã gửi ảnh',
      mediaUrl: fileLink.href,
      metadata: { fileId: largestPhoto.file_id, width: largestPhoto.width, height: largestPhoto.height },
      timestamp: new Date(ctx.message.date * 1000),
    };
  }

  private async parseDocumentMessage(ctx: Context): Promise<IStandardMessage> {
    const doc = (ctx.message as any).document;
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const caption = (ctx.message as any).caption || '';

    return {
      platform: this.platform,
      platformThreadId: ctx.chat.id.toString(),
      platformMessageId: ctx.message.message_id.toString(),
      senderType: SenderType.USER,
      senderName: ctx.from.first_name || 'Khách hàng',
      senderId: ctx.from.id.toString(),
      messageType: MessageType.FILE,
      text: caption || `📎 Đã gửi file: ${doc.file_name}`,
      mediaUrl: fileLink.href,
      metadata: { fileId: doc.file_id, fileName: doc.file_name, mimeType: doc.mime_type, fileSize: doc.file_size },
      timestamp: new Date(ctx.message.date * 1000),
    };
  }

  private async parseStickerMessage(ctx: Context): Promise<IStandardMessage> {
    const sticker = (ctx.message as any).sticker;
    return {
      platform: this.platform,
      platformThreadId: ctx.chat.id.toString(),
      platformMessageId: ctx.message.message_id.toString(),
      senderType: SenderType.USER,
      senderName: ctx.from.first_name || 'Khách hàng',
      senderId: ctx.from.id.toString(),
      messageType: MessageType.STICKER,
      text: `${sticker.emoji || '🏷️'} Sticker`,
      metadata: { fileId: sticker.file_id, emoji: sticker.emoji, setName: sticker.set_name },
      timestamp: new Date(ctx.message.date * 1000),
    };
  }

  private async parseLocationMessage(ctx: Context): Promise<IStandardMessage> {
    const location = (ctx.message as any).location;
    return {
      platform: this.platform,
      platformThreadId: ctx.chat.id.toString(),
      platformMessageId: ctx.message.message_id.toString(),
      senderType: SenderType.USER,
      senderName: ctx.from.first_name || 'Khách hàng',
      senderId: ctx.from.id.toString(),
      messageType: MessageType.LOCATION,
      text: `📍 Vị trí: ${location.latitude}, ${location.longitude}`,
      metadata: { latitude: location.latitude, longitude: location.longitude },
      timestamp: new Date(ctx.message.date * 1000),
    };
  }

  private async parseContactMessage(ctx: Context): Promise<IStandardMessage> {
    const contact = (ctx.message as any).contact;
    return {
      platform: this.platform,
      platformThreadId: ctx.chat.id.toString(),
      platformMessageId: ctx.message.message_id.toString(),
      senderType: SenderType.USER,
      senderName: ctx.from.first_name || 'Khách hàng',
      senderId: ctx.from.id.toString(),
      messageType: MessageType.CONTACT,
      text: `📞 Liên hệ: ${contact.first_name} ${contact.last_name || ''} - ${contact.phone_number}`,
      metadata: { firstName: contact.first_name, lastName: contact.last_name, phoneNumber: contact.phone_number },
      timestamp: new Date(ctx.message.date * 1000),
    };
  }

  // ============ SEND MESSAGES ============

  /**
   * Gửi tin nhắn đến user trên Telegram (được gọi bởi ChatHub)
   */
  async sendMessage(destinationThreadId: string, message: IStandardMessage): Promise<boolean> {
    try {
      switch (message.messageType) {
        case MessageType.IMAGE:
          if (message.mediaUrl) {
            await this.bot.telegram.sendPhoto(destinationThreadId, message.mediaUrl, {
              caption: `[${message.senderName}]: ${message.text || ''}`,
            });
          }
          break;

        case MessageType.FILE:
          if (message.mediaUrl) {
            await this.bot.telegram.sendDocument(destinationThreadId, message.mediaUrl, {
              caption: `[${message.senderName}]: ${message.text || ''}`,
            });
          }
          break;

        case MessageType.LOCATION:
          if (message.metadata?.latitude && message.metadata?.longitude) {
            await this.bot.telegram.sendLocation(
              destinationThreadId,
              message.metadata.latitude,
              message.metadata.longitude,
            );
          }
          break;

        case MessageType.TEXT:
        default:
          const textToSend = `💬 [${message.senderName}]: ${message.text}`;
          await this.bot.telegram.sendMessage(destinationThreadId, textToSend);
          break;
      }

      this.logger.log(`📤 Đã gửi ${message.messageType} đến Telegram chatId: ${destinationThreadId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Lỗi gửi Telegram đến ${destinationThreadId}: ${error.message}`);
      return false;
    }
  }

  // ============ UTILITY ============

  /**
   * Lấy thông tin bot
   */
  async getBotInfo(): Promise<any> {
    return this.bot.telegram.getMe();
  }

  /**
   * Gửi tin nhắn text đơn giản (không qua Hub)
   */
  async sendDirectText(chatId: string, text: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(chatId, text);
      return true;
    } catch (error) {
      this.logger.error(`❌ Lỗi gửi direct text: ${error.message}`);
      return false;
    }
  }

  /**
   * Gửi ảnh (không qua Hub)
   */
  async sendDirectPhoto(chatId: string, photoUrl: string, caption?: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendPhoto(chatId, photoUrl, { caption });
      return true;
    } catch (error) {
      this.logger.error(`❌ Lỗi gửi ảnh: ${error.message}`);
      return false;
    }
  }
}