// src/modules/chat-hub/chat-hub.service.ts
// Hub trung tâm — Tập trung tin nhắn từ các nền tảng và phân phối cho agents
import { Injectable, Logger } from '@nestjs/common';
import {
  IChatAdapter,
  IStandardMessage,
  IAgentNotifier,
} from 'src/common/interfaces/standard-message.interface';
import { Platform, SenderType, MessageType } from 'src/common/enums';

@Injectable()
export class ChatHubService {
  private readonly logger = new Logger(ChatHubService.name);
  private readonly adapters: Map<Platform, IChatAdapter> = new Map();
  private readonly notifiers: IAgentNotifier[] = [];

  // ============ ĐĂNG KÝ ADAPTER ============

  registerAdapter(platform: Platform, adapter: IChatAdapter): void {
    this.adapters.set(platform, adapter);
    this.logger.log(`✅ Đã đăng ký adapter: ${platform}`);
  }

  getAdapter(platform: Platform): IChatAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) throw new Error(`Adapter ${platform} chưa được đăng ký`);
    return adapter;
  }

  getRegisteredAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  // ============ ĐĂNG KÝ NOTIFIER ============

  /**
   * Đăng ký một notifier để nhận broadcast khi có tin nhắn mới.
   * Ví dụ: WebSocket Gateway đăng ký để push tin nhắn đến agent UI.
   */
  registerNotifier(notifier: IAgentNotifier): void {
    this.notifiers.push(notifier);
    this.logger.log(`✅ Đã đăng ký agent notifier (total: ${this.notifiers.length})`);
  }

  // ============ LUỒNG 1: KHÁCH HÀNG → AGENTS ============

  /**
   * Xử lý tin nhắn ĐẾN từ khách hàng (Telegram, LiveChat, ...).
   * Tin nhắn sẽ được broadcast đến tất cả agents đã đăng ký.
   *
   * ⚠️ KHÔNG gọi method này cho agent reply!
   * Agent reply phải dùng routeToCustomer().
   */
  async handleIncomingMessage(message: IStandardMessage): Promise<void> {
    this.logger.log(
      `📩 [${message.platform}] ${message.senderName} (${message.senderType}): ${message.text || '[media]'}`,
    );

    // Broadcast đến tất cả agents đã đăng ký (Gateway, SSE, etc.)
    for (const notifier of this.notifiers) {
      try {
        notifier.notifyAgents(message);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`❌ Lỗi broadcast đến agent notifier: ${errorMsg}`);
      }
    }
  }

  // ============ LUỒNG 2: AGENT → KHÁCH HÀNG ============

  /**
   * Route tin nhắn từ agent ĐẾN khách hàng trên đúng nền tảng.
   * Platform và threadId xác định khách hàng nào trên nền tảng nào.
   *
   * @param platform - Nền tảng gốc của khách hàng (TELEGRAM / LIVECHAT)
   * @param threadId - ID cuộc hội thoại trên nền tảng gốc
   * @param message  - Tin nhắn chuẩn hóa cần gửi
   */
  async routeToCustomer(
    platform: Platform,
    threadId: string,
    message: IStandardMessage,
  ): Promise<boolean> {
    try {
      const adapter = this.getAdapter(platform);
      const result = await adapter.sendMessage(threadId, message);

      this.logger.log(
        `📤 Đã gửi tin nhắn đến ${platform} (thread: ${threadId})`,
      );
      return result;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Lỗi gửi đến ${platform} (thread: ${threadId}): ${errorMsg}`,
      );
      return false;
    }
  }

  // ============ TIỆN ÍCH ============

  /**
   * Gửi tin nhắn hệ thống trực tiếp đến khách hàng.
   * Dùng cho thông báo tự động, welcome message, etc.
   */
  async sendSystemMessage(
    platform: Platform,
    threadId: string,
    text: string,
    senderName = 'System',
  ): Promise<boolean> {
    const message: IStandardMessage = {
      platform,
      platformThreadId: threadId,
      platformMessageId: `sys_${Date.now()}`,
      senderType: SenderType.SYSTEM,
      senderName,
      messageType: MessageType.TEXT,
      text,
      timestamp: new Date(),
    };
    return this.routeToCustomer(platform, threadId, message);
  }
}
