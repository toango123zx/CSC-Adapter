// src/modules/chat-hub/chat-hub.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { IChatAdapter, IStandardMessage } from 'src/common/interfaces/standard-message.interface';
import { Platform, SenderType, MessageType } from 'src/common/enums';

@Injectable()
export class ChatHubService {
  private readonly logger = new Logger(ChatHubService.name);
  private adapters: Map<Platform, IChatAdapter> = new Map();

  // ============ ĐĂNG KÝ ADAPTER ============

  registerAdapter(platform: Platform, adapter: IChatAdapter) {
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

  // ============ LOGIC ĐỊNH TUYẾN ============

  /**
   * Xử lý tin nhắn đến từ bất kỳ adapter nào
   * Routing: Telegram → LiveChat, LiveChat → Telegram
   */
  async handleIncomingMessage(message: IStandardMessage) {
    this.logger.log(
      `📩 [${message.platform}] ${message.senderName} (${message.senderType}): ${message.text || '[media]'}`,
    );

    try {
      if (message.platform === Platform.TELEGRAM) {
        // Khách nhắn từ Telegram → Chuyển tiếp sang Livechat cho nhân viên
        const livechatAdapter = this.getAdapter(Platform.LIVECHAT);
        await livechatAdapter.sendMessage(message.platformThreadId, message);
        this.logger.log(`📤 Đã chuyển tin từ Telegram → LiveChat (thread: ${message.platformThreadId})`);
      } else if (message.platform === Platform.LIVECHAT) {
        // Nhân viên trả lời từ Livechat → Gửi về Telegram cho khách
        const telegramAdapter = this.getAdapter(Platform.TELEGRAM);
        await telegramAdapter.sendMessage(message.platformThreadId, message);
        this.logger.log(`📤 Đã chuyển tin từ LiveChat → Telegram (thread: ${message.platformThreadId})`);
      }
    } catch (error) {
      this.logger.error(`❌ Lỗi định tuyến tin nhắn: ${error.message}`);
    }
  }

  /**
   * Gửi tin nhắn chủ động từ API (không qua adapter)
   */
  async sendDirectMessage(
    platform: Platform,
    threadId: string,
    text: string,
    senderName = 'System',
  ): Promise<boolean> {
    const adapter = this.getAdapter(platform);
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
    return adapter.sendMessage(threadId, message);
  }
}