// src/modules/adapters/telegram/telegram.service.ts
// Telegraf Bot Client - Chỉ lo giao tiếp với Telegram API (bot commands, listeners, send)
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { IStandardMessage } from 'src/common/interfaces/standard-message.interface';
import { MessageType } from 'src/common/enums';

// Forward reference type (sẽ được gán từ adapter qua setAdapter)
import type { TelegramAdapter } from './telegram.adapter';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;
  private adapter: TelegramAdapter;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new Telegraf(token);
  }

  /**
   * Được gọi bởi TelegramAdapter.onModuleInit() để gắn adapter reference
   */
  setAdapter(adapter: TelegramAdapter) {
    this.adapter = adapter;
  }

  // ============ LIFECYCLE ============

  onModuleInit() {
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
      if (ctx.message.text.startsWith('/')) return;
      const standardMsg = await this.adapter.parseTextMessage(ctx);
      await this.adapter.handleIncoming(standardMsg);
    });

    // Ảnh
    this.bot.on('photo', async (ctx) => {
      const standardMsg = await this.adapter.parsePhotoMessage(ctx);
      await this.adapter.handleIncoming(standardMsg);
    });

    // File/Document
    this.bot.on('document', async (ctx) => {
      const standardMsg = await this.adapter.parseDocumentMessage(ctx);
      await this.adapter.handleIncoming(standardMsg);
    });

    // Sticker
    this.bot.on('sticker', async (ctx) => {
      const standardMsg = await this.adapter.parseStickerMessage(ctx);
      await this.adapter.handleIncoming(standardMsg);
    });

    // Location
    this.bot.on('location', async (ctx) => {
      const standardMsg = await this.adapter.parseLocationMessage(ctx);
      await this.adapter.handleIncoming(standardMsg);
    });

    // Contact
    this.bot.on('contact', async (ctx) => {
      const standardMsg = await this.adapter.parseContactMessage(ctx);
      await this.adapter.handleIncoming(standardMsg);
    });
  }

  // ============ SEND MESSAGES (được gọi bởi Adapter) ============

  /**
   * Gửi IStandardMessage tới Telegram user
   * Được gọi bởi TelegramAdapter.sendMessage()
   */
  async sendStandardMessage(chatId: string, message: IStandardMessage): Promise<boolean> {
    try {
      switch (message.messageType) {
        case MessageType.IMAGE:
          if (message.mediaUrl) {
            await this.bot.telegram.sendPhoto(chatId, message.mediaUrl, {
              caption: `[${message.senderName}]: ${message.text || ''}`,
            });
          }
          break;

        case MessageType.FILE:
          if (message.mediaUrl) {
            await this.bot.telegram.sendDocument(chatId, message.mediaUrl, {
              caption: `[${message.senderName}]: ${message.text || ''}`,
            });
          }
          break;

        case MessageType.LOCATION:
          if (message.metadata?.latitude && message.metadata?.longitude) {
            await this.bot.telegram.sendLocation(chatId, message.metadata.latitude, message.metadata.longitude);
          }
          break;

        case MessageType.TEXT:
        default:
          const textToSend = `💬 [${message.senderName}]: ${message.text}`;
          await this.bot.telegram.sendMessage(chatId, textToSend);
          break;
      }

      this.logger.log(`📤 Đã gửi ${message.messageType} đến Telegram chatId: ${chatId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Lỗi gửi Telegram đến ${chatId}: ${error.message}`);
      return false;
    }
  }

  // ============ UTILITY ============

  async getBotInfo(): Promise<any> {
    return this.bot.telegram.getMe();
  }

  async sendDirectText(chatId: string, text: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(chatId, text);
      return true;
    } catch (error) {
      this.logger.error(`❌ Lỗi gửi direct text: ${error.message}`);
      return false;
    }
  }

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