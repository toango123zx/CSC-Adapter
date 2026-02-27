// src/common/constants/livechat.constants.ts
// Constants cho LiveChat API

export const LIVECHAT_API_BASE_URL = 'https://api.livechatinc.com/v3.5';

/**
 * Hai loại API endpoint của LiveChat:
 * - AGENT: Quản lý chats, gửi tin nhắn, routing status...
 * - CONFIGURATION: Quản lý webhooks, groups, agents, tags...
 */
export enum LivechatApiType {
  AGENT = 'agent',
  CONFIGURATION = 'configuration',
}

/**
 * Các webhook actions phổ biến của LiveChat v3.5
 * Dùng khi đăng ký webhook qua Configuration API
 */
export enum LivechatWebhookAction {
  INCOMING_CHAT = 'incoming_chat',
  INCOMING_EVENT = 'incoming_event',
  INCOMING_CHAT_THREAD = 'incoming_chat_thread',
  CHAT_DEACTIVATED = 'chat_deactivated',
  CHAT_ACCESS_UPDATED = 'chat_access_updated',
  CHAT_PROPERTIES_UPDATED = 'chat_properties_updated',
  CHAT_TRANSFERRED = 'chat_transferred',
  AGENT_CREATED = 'agent_created',
  AGENT_DELETED = 'agent_deleted',
  AGENT_UPDATED = 'agent_updated',
  CUSTOMER_CREATED = 'customer_created',
}

/**
 * Loại webhook: license-level hoặc bot-level
 */
export enum LivechatWebhookType {
  LICENSE = 'license',
  BOT = 'bot',
}
