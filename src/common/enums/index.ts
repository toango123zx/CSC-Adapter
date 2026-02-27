// src/common/enums/index.ts
// Tất cả enums dùng chung trong hệ thống

export enum Platform {
  TELEGRAM = 'TELEGRAM',
  LIVECHAT = 'LIVECHAT',
}

export enum SenderType {
  USER = 'USER', // Khách hàng
  AGENT = 'AGENT', // Nhân viên CSKH
  SYSTEM = 'SYSTEM', // Hệ thống
  BOT = 'BOT', // Bot tự động
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  STICKER = 'STICKER',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT',
  RICH_MESSAGE = 'RICH_MESSAGE', // Card, buttons (LiveChat)
  SYSTEM_EVENT = 'SYSTEM_EVENT', // Sự kiện hệ thống (join, leave, etc.)
}
