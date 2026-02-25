// src/common/interfaces/standard-message.interface.ts

export enum Platform {
  TELEGRAM = 'TELEGRAM',
  LIVECHAT = 'LIVECHAT',
}

export enum SenderType {
  USER = 'USER',     // Khách hàng
  AGENT = 'AGENT',   // Nhân viên CSKH
  SYSTEM = 'SYSTEM', // Hệ thống
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  STICKER = 'STICKER',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT',
  SYSTEM_EVENT = 'SYSTEM_EVENT', // Sự kiện hệ thống (join, leave, etc.)
}

export interface IStandardMessage {
  platform: Platform;
  platformThreadId: string;   // ID cuộc hội thoại trên nền tảng gốc (Telegram chatId, LiveChat chatId)
  platformMessageId: string;  // ID tin nhắn trên nền tảng gốc
  senderType: SenderType;
  senderName: string;
  senderId?: string;          // ID người gửi trên nền tảng gốc
  messageType: MessageType;
  text?: string;              // Nội dung văn bản
  mediaUrl?: string;          // URL file/ảnh nếu có
  metadata?: Record<string, any>; // Dữ liệu bổ sung tùy nền tảng
  timestamp: Date;
}

export interface IChatAdapter {
  platform: Platform;
  sendMessage(destinationThreadId: string, message: IStandardMessage): Promise<boolean>;
  parseWebhook(payload: any): Promise<IStandardMessage>;
}