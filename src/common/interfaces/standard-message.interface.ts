// src/common/interfaces/standard-message.interface.ts
// Interfaces chuẩn hóa cho toàn bộ hệ thống (không chứa enums)

import { Platform, SenderType, MessageType } from '../enums';

/**
 * Tin nhắn chuẩn hóa - Format chung giữa tất cả nền tảng.
 * Mọi tin nhắn từ Telegram, LiveChat, hay bất kỳ nền tảng nào
 * đều phải được chuyển về format này trước khi đi qua Hub.
 */
export interface IStandardMessage {
  platform: Platform;
  platformThreadId: string; // ID cuộc hội thoại trên nền tảng gốc
  platformMessageId: string; // ID tin nhắn trên nền tảng gốc
  senderType: SenderType;
  senderName: string;
  senderId?: string; // ID người gửi trên nền tảng gốc
  messageType: MessageType;
  text?: string; // Nội dung văn bản
  mediaUrl?: string; // URL file/ảnh nếu có
  metadata?: Record<string, any>; // Dữ liệu bổ sung tùy nền tảng
  timestamp: Date;
}

/**
 * Interface mà mỗi adapter nền tảng phải implement.
 * - parseIncomingWebhook: Chuyển payload gốc từ nền tảng → IStandardMessage
 * - sendMessage: Gửi IStandardMessage tới nền tảng đích
 */
export interface IChatAdapter {
  readonly platform: Platform;

  /** Chuyển payload webhook/event gốc → IStandardMessage */
  parseIncomingWebhook(payload: any): Promise<IStandardMessage | null>;

  /** Gửi tin nhắn chuẩn hóa đến nền tảng đích */
  sendMessage(
    destinationThreadId: string,
    message: IStandardMessage,
  ): Promise<boolean>;
}

/**
 * Interface cho bất kỳ component nào muốn nhận tin nhắn từ Hub
 * để hiển thị cho agent (ví dụ: WebSocket Gateway, SSE endpoint...).
 *
 * Bất kỳ component nào implement interface này đều có thể
 * đăng ký với ChatHubService để nhận broadcast khi có tin nhắn mới.
 */
export interface IAgentNotifier {
  /** Thông báo cho agents về tin nhắn mới từ khách hàng */
  notifyAgents(message: IStandardMessage): void;
}

/**
 * Kết quả xử lý webhook trả về cho caller.
 */
export interface WebhookResult {
  success: boolean;
  processed: boolean;
  message?: string;
  data?: Record<string, any>;
}

/**
 * Interface cho webhook handler của mỗi platform.
 * Mỗi platform cần implement interface này để nhận webhook.
 *
 * THIẾT KẾ: Strategy Pattern — mỗi handler là 1 strategy xử lý webhook
 * cho platform cụ thể. WebhookRegistryService sẽ chọn đúng handler
 * dựa trên platform identifier.
 *
 * Khi thêm platform mới:
 * 1. Tạo class implement IWebhookHandler
 * 2. Đăng ký vào WebhookRegistryService trong onModuleInit()
 * 3. Done — không cần sửa code core
 */
export interface IWebhookHandler {
  /** Platform identifier — dùng để routing */
  readonly platform: Platform;

  /**
   * Xử lý webhook payload từ platform.
   * @param payload - Raw payload từ HTTP request body
   * @param headers - HTTP headers (dùng cho signature verification nếu cần)
   * @returns Kết quả xử lý webhook
   */
  handleWebhook(
    payload: any,
    headers?: Record<string, string>,
  ): Promise<WebhookResult>;
}
