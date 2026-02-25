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
  platformThreadId: string;     // ID cuộc hội thoại trên nền tảng gốc
  platformMessageId: string;    // ID tin nhắn trên nền tảng gốc
  senderType: SenderType;
  senderName: string;
  senderId?: string;            // ID người gửi trên nền tảng gốc
  messageType: MessageType;
  text?: string;                // Nội dung văn bản
  mediaUrl?: string;            // URL file/ảnh nếu có
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
  sendMessage(destinationThreadId: string, message: IStandardMessage): Promise<boolean>;
}