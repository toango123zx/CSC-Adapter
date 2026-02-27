// src/modules/adapters/telegram/telegram.types.ts
// Type definitions cho Telegram message formats, stored data, và API responses

import { IStandardMessage } from 'src/common/interfaces/standard-message.interface';

// ============ TELEGRAM MESSAGE TYPES (parse from ctx) ============

export interface TelegramTextMessage {
    text: string;
    caption?: string;
}

export interface TelegramPhotoMessage {
    photo: Array<{ file_id: string; width: number; height: number }>;
    caption?: string;
}

export interface TelegramDocumentMessage {
    document: {
        file_id: string;
        file_name: string;
        mime_type: string;
        file_size: number;
    };
    caption?: string;
}

export interface TelegramStickerMessage {
    sticker: {
        file_id: string;
        emoji?: string;
        set_name?: string;
    };
}

export interface TelegramLocationMessage {
    location: {
        latitude: number;
        longitude: number;
    };
}

export interface TelegramContactMessage {
    contact: {
        first_name: string;
        last_name?: string;
        phone_number: string;
    };
}

// ============ BOT INFO ============

export interface TelegramBotInfo {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
}

// ============ CONVERSATION STORE TYPES ============

/** Loại chat Telegram */
export type TelegramChatType = 'private' | 'group' | 'supergroup' | 'channel';

/**
 * Conversation = 1 cuộc hội thoại với 1 user hoặc 1 group.
 * Được tạo khi user /start hoặc gửi tin nhắn đầu tiên.
 */
export interface TelegramConversation {
    chatId: string;
    chatType: TelegramChatType;
    customerName: string;
    customerId: string;
    languageCode?: string;
    startedAt: Date;
    lastMessageAt: Date;
    messageCount: number;
    isActive: boolean;
}

/** Tin nhắn đã lưu = IStandardMessage + direction */
export interface TelegramStoredMessage extends IStandardMessage {
    /** incoming = khách gửi đến, outgoing = agent reply */
    direction: 'incoming' | 'outgoing';
}

/** Thống kê tổng quan */
export interface TelegramStats {
    totalConversations: number;
    activeConversations: number;
    privateChats: number;
    groupChats: number;
    totalMessages: number;
    incomingMessages: number;
    outgoingMessages: number;
}

/** Filter khi query conversations */
export interface ConversationFilter {
    chatType?: TelegramChatType;
    isActive?: boolean;
}
