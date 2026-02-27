// src/modules/adapters/telegram/telegram.service.ts
// Pure Telegraf Bot Client — Chỉ lo tạo bot, gửi tin nhắn, expose API
// KHÔNG import Adapter → KHÔNG có circular dependency
import {
  Injectable,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import type { MessageSubType } from 'telegraf/typings/telegram-types';
import { IStandardMessage } from 'src/common/interfaces/standard-message.interface';
import { MessageType } from 'src/common/enums';
import { TelegramBotInfo } from './telegram.types';

/** Callback type cho message handlers */
type MessageHandler = (ctx: Context) => Promise<void>;


@Injectable()
export class TelegramService implements OnModuleDestroy {
  private readonly bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.bot = new Telegraf(token);
    this.setupCommands();
  }

  // ============ LIFECYCLE (cho Adapter gọi) ============

  /**
   * Đăng ký handler cho 1 loại message.
   * Adapter gọi method này trong onModuleInit TRƯỚC khi launch().
   */
  registerHandler(event: MessageSubType, handler: MessageHandler): void {
    this.bot.on(event, handler);
    this.logger.debug(`📌 Đã đăng ký handler: ${event}`);
  }

  /**
   * Khởi chạy bot. Gọi SAU KHI tất cả handlers đã đăng ký.
   */
  launch(): void {
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

  // ============ SEND — TEXT ============

  async sendText(chatId: string, text: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(chatId, text);
      this.logger.log(`📤 Text → ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ sendText(${chatId}): ${msg}`);
      return false;
    }
  }

  // ============ SEND — PHOTO ============

  async sendPhoto(
    chatId: string,
    photoUrl: string,
    caption?: string,
  ): Promise<boolean> {
    try {
      await this.bot.telegram.sendPhoto(chatId, photoUrl, { caption });
      this.logger.log(`📤 Photo → ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ sendPhoto(${chatId}): ${msg}`);
      return false;
    }
  }

  // ============ SEND — DOCUMENT ============

  async sendDocument(
    chatId: string,
    documentUrl: string,
    caption?: string,
  ): Promise<boolean> {
    try {
      await this.bot.telegram.sendDocument(chatId, documentUrl, { caption });
      this.logger.log(`📤 Document → ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ sendDocument(${chatId}): ${msg}`);
      return false;
    }
  }

  // ============ SEND — LOCATION ============

  async sendLocation(
    chatId: string,
    latitude: number,
    longitude: number,
  ): Promise<boolean> {
    try {
      await this.bot.telegram.sendLocation(chatId, latitude, longitude);
      this.logger.log(`📤 Location → ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ sendLocation(${chatId}): ${msg}`);
      return false;
    }
  }

  // ============ SEND — CONTACT ============

  async sendContact(
    chatId: string,
    phoneNumber: string,
    firstName: string,
    lastName?: string,
  ): Promise<boolean> {
    try {
      await this.bot.telegram.sendContact(chatId, phoneNumber, firstName, {
        last_name: lastName,
      });
      this.logger.log(`📤 Contact → ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ sendContact(${chatId}): ${msg}`);
      return false;
    }
  }

  // ============ SEND — STANDARD MESSAGE (cho Adapter) ============

  /**
   * Gửi IStandardMessage qua Telegram.
   * Adapter gọi method này khi Hub route tin nhắn đến Telegram.
   */
  async sendStandardMessage(
    chatId: string,
    message: IStandardMessage,
  ): Promise<boolean> {
    switch (message.messageType) {
      case MessageType.IMAGE: {
        if (!message.mediaUrl) return false;
        return this.sendPhoto(
          chatId,
          message.mediaUrl,
          `[${message.senderName}]: ${message.text || ''}`,
        );
      }

      case MessageType.FILE: {
        if (!message.mediaUrl) return false;
        return this.sendDocument(
          chatId,
          message.mediaUrl,
          `[${message.senderName}]: ${message.text || ''}`,
        );
      }

      case MessageType.LOCATION: {
        const lat = message.metadata?.['latitude'] as number | undefined;
        const lng = message.metadata?.['longitude'] as number | undefined;
        if (lat == null || lng == null) return false;
        return this.sendLocation(chatId, lat, lng);
      }

      case MessageType.CONTACT: {
        const phone = message.metadata?.['phoneNumber'] as string | undefined;
        const first = message.metadata?.['firstName'] as string | undefined;
        const last = message.metadata?.['lastName'] as string | undefined;
        if (!phone || !first) return false;
        return this.sendContact(chatId, phone, first, last);
      }

      case MessageType.TEXT:
      default: {
        return this.sendText(
          chatId,
          `💬 [${message.senderName}]: ${message.text || ''}`,
        );
      }
    }
  }

  // ============ BOT INFO ============

  async getBotInfo(): Promise<TelegramBotInfo> {
    const me = await this.bot.telegram.getMe();
    return me as TelegramBotInfo;
  }

  // ============ CHAT / GROUP INFO ============

  async getChat(chatId: string): Promise<Record<string, unknown>> {
    try {
      const chat = await this.bot.telegram.getChat(chatId);
      return chat as unknown as Record<string, unknown>;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ getChat(${chatId}): ${msg}`);
      throw error;
    }
  }

  async getChatMemberCount(chatId: string): Promise<number> {
    return this.bot.telegram.getChatMembersCount(chatId);
  }

  async getChatMember(
    chatId: string,
    userId: number,
  ): Promise<Record<string, unknown>> {
    const member = await this.bot.telegram.getChatMember(chatId, userId);
    return member as unknown as Record<string, unknown>;
  }

  // ============ GROUP MANAGEMENT ============

  /**
   * Bot rời khỏi group/supergroup.
   * ⚠️ Telegram Bot API KHÔNG hỗ trợ tạo group — bot chỉ có thể rời.
   */
  async leaveChat(chatId: string): Promise<boolean> {
    try {
      await this.bot.telegram.leaveChat(chatId);
      this.logger.log(`🚪 Bot đã rời chat: ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ leaveChat(${chatId}): ${msg}`);
      return false;
    }
  }

  async setChatTitle(chatId: string, title: string): Promise<boolean> {
    try {
      await this.bot.telegram.setChatTitle(chatId, title);
      this.logger.log(`✏️ Đã đổi tên chat ${chatId}: "${title}"`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ setChatTitle(${chatId}): ${msg}`);
      return false;
    }
  }

  async setChatDescription(
    chatId: string,
    description: string,
  ): Promise<boolean> {
    try {
      await this.bot.telegram.setChatDescription(chatId, description);
      this.logger.log(`✏️ Đã đổi mô tả chat ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ setChatDescription(${chatId}): ${msg}`);
      return false;
    }
  }

  async createInviteLink(
    chatId: string,
    options?: {
      name?: string;
      expire_date?: number;
      member_limit?: number;
      creates_join_request?: boolean;
    },
  ): Promise<{ inviteLink: string } | null> {
    try {
      const result = await this.bot.telegram.createChatInviteLink(
        chatId,
        options,
      );
      this.logger.log(`🔗 Invite link cho ${chatId}: ${result.invite_link}`);
      return { inviteLink: result.invite_link };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ createInviteLink(${chatId}): ${msg}`);
      return null;
    }
  }

  // ============ MEMBER MANAGEMENT ============

  /**
   * Phê duyệt yêu cầu tham gia group.
   */
  async approveChatJoinRequest(
    chatId: string,
    userId: number,
  ): Promise<boolean> {
    try {
      await this.bot.telegram.approveChatJoinRequest(chatId, userId);
      this.logger.log(`✅ Đã duyệt user ${userId} vào group ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ approveChatJoinRequest(${chatId}, ${userId}): ${msg}`);
      return false;
    }
  }

  /**
   * Từ chối yêu cầu tham gia group.
   */
  async declineChatJoinRequest(
    chatId: string,
    userId: number,
  ): Promise<boolean> {
    try {
      await this.bot.telegram.declineChatJoinRequest(chatId, userId);
      this.logger.log(`❌ Đã từ chối user ${userId} vào group ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ declineChatJoinRequest(${chatId}, ${userId}): ${msg}`);
      return false;
    }
  }

  /**
   * Kick (ban) user khỏi group.
   * Bot phải là admin mới kick được.
   */
  async kickMember(chatId: string, userId: number): Promise<boolean> {
    try {
      await this.bot.telegram.banChatMember(chatId, userId);
      this.logger.log(`🚫 Đã kick user ${userId} khỏi ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ kickMember(${chatId}, ${userId}): ${msg}`);
      return false;
    }
  }

  /**
   * Unban user — cho phép user tham gia lại group.
   */
  async unbanMember(chatId: string, userId: number): Promise<boolean> {
    try {
      await this.bot.telegram.unbanChatMember(chatId, userId, {
        only_if_banned: true,
      });
      this.logger.log(`✅ Đã unban user ${userId} trong ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ unbanMember(${chatId}, ${userId}): ${msg}`);
      return false;
    }
  }

  // ============ MESSAGE MANAGEMENT ============

  /**
   * Chỉnh sửa nội dung tin nhắn text đã gửi.
   * Chỉ edit được tin nhắn do bot gửi.
   */
  async editMessage(
    chatId: string,
    messageId: number,
    newText: string,
  ): Promise<boolean> {
    try {
      await this.bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        newText,
      );
      this.logger.log(`✏️ Đã edit message ${messageId} trong ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ editMessage(${chatId}, ${messageId}): ${msg}`);
      return false;
    }
  }

  /**
   * Xóa tin nhắn.
   * Bot có thể xóa tin nhắn của mình, hoặc tin nhắn của user nếu bot là admin.
   */
  async deleteMessage(chatId: string, messageId: number): Promise<boolean> {
    try {
      await this.bot.telegram.deleteMessage(chatId, messageId);
      this.logger.log(`🗑️ Đã xóa message ${messageId} trong ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ deleteMessage(${chatId}, ${messageId}): ${msg}`);
      return false;
    }
  }

  /**
   * Ghim tin nhắn trong chat.
   */
  async pinMessage(chatId: string, messageId: number): Promise<boolean> {
    try {
      await this.bot.telegram.pinChatMessage(chatId, messageId);
      this.logger.log(`📌 Đã ghim message ${messageId} trong ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ pinMessage(${chatId}, ${messageId}): ${msg}`);
      return false;
    }
  }

  /**
   * Bỏ ghim tin nhắn.
   */
  async unpinMessage(chatId: string, messageId: number): Promise<boolean> {
    try {
      await this.bot.telegram.unpinChatMessage(chatId, messageId);
      this.logger.log(`📌 Đã bỏ ghim message ${messageId} trong ${chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ unpinMessage(${chatId}, ${messageId}): ${msg}`);
      return false;
    }
  }
}
