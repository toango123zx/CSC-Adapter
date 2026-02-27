// src/modules/adapters/livechat/livechat-api.types.ts
// Type definitions cho LiveChat API responses và internal types

/**
 * LiveChat API error response
 */
export interface LivechatApiError {
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Kết quả trả về từ mọi LiveChat API call
 */
export interface LivechatApiResponse<T = unknown> {
  error?: LivechatApiError;
  [key: string]: unknown;
}

/**
 * Agent routing status
 */
export type AgentRoutingStatus =
  | 'accepting_chats'
  | 'not_accepting_chats'
  | 'offline';

/**
 * Kết quả test connection
 */
export interface LivechatConnectionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * LiveChat user trong chat
 */
export interface LivechatUser {
  id: string;
  name?: string;
  email?: string;
  type: 'agent' | 'customer';
}

/**
 * LiveChat event trong thread
 */
export interface LivechatEvent {
  id: string;
  type: string;
  text?: string;
  url?: string;
  author_id: string;
  created_at: string;
  properties?: Record<string, unknown>;
}

/**
 * LiveChat chat thread
 */
export interface LivechatThread {
  id: string;
  events?: LivechatEvent[];
  properties?: Record<string, unknown>;
}

/**
 * LiveChat chat object
 */
export interface LivechatChat {
  id: string;
  users?: LivechatUser[];
  thread?: LivechatThread;
  threads?: LivechatThread[];
  properties?: Record<string, unknown>;
}

/**
 * Webhook incoming payload từ LiveChat
 */
export interface LivechatWebhookPayload {
  action: string;
  secret_key?: string;
  payload: {
    chat_id?: string;
    thread_id?: string;
    chat?: LivechatChat;
    event?: LivechatEvent;
  };
}
