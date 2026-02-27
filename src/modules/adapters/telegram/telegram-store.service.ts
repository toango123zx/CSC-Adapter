// src/modules/adapters/telegram/telegram-store.service.ts
// In-memory Conversation Store — Lưu conversations + messages
// Thiết kế interface-first: dễ thay bằng DB (TypeORM/Prisma) sau này
import { Injectable, Logger } from '@nestjs/common';
import { IStandardMessage } from 'src/common/interfaces/standard-message.interface';
import {
    TelegramConversation,
    TelegramStoredMessage,
    TelegramStats,
    TelegramChatType,
    ConversationFilter,
} from './telegram.types';

@Injectable()
export class TelegramStoreService {
    private readonly logger = new Logger(TelegramStoreService.name);

    /** Map chatId → conversation metadata */
    private readonly conversations = new Map<string, TelegramConversation>();

    /** Map chatId → ordered messages */
    private readonly messages = new Map<string, TelegramStoredMessage[]>();

    // ============ CONVERSATION MANAGEMENT ============

    /**
     * Tạo hoặc cập nhật conversation khi có tin nhắn mới.
     * - Lần đầu: tạo conversation mới
     * - Lần sau: cập nhật lastMessageAt + messageCount
     */
    upsertConversation(
        chatId: string,
        chatType: TelegramChatType,
        customerName: string,
        customerId: string,
        languageCode?: string,
    ): TelegramConversation {
        const existing = this.conversations.get(chatId);

        if (existing) {
            existing.lastMessageAt = new Date();
            existing.messageCount += 1;
            existing.isActive = true;
            // Cập nhật tên nếu user đổi tên
            existing.customerName = customerName;
            return existing;
        }

        const conversation: TelegramConversation = {
            chatId,
            chatType,
            customerName,
            customerId,
            languageCode,
            startedAt: new Date(),
            lastMessageAt: new Date(),
            messageCount: 1,
            isActive: true,
        };

        this.conversations.set(chatId, conversation);
        this.messages.set(chatId, []);

        this.logger.log(
            `📝 Conversation mới: ${customerName} (${chatType}, chatId: ${chatId})`,
        );

        return conversation;
    }

    // ============ MESSAGE STORAGE ============

    /**
     * Lưu 1 tin nhắn vào store.
     * @param direction - 'incoming' (khách gửi) hoặc 'outgoing' (agent reply)
     */
    storeMessage(
        message: IStandardMessage,
        direction: 'incoming' | 'outgoing',
    ): void {
        const chatId = message.platformThreadId;

        const storedMsg: TelegramStoredMessage = {
            ...message,
            direction,
        };

        const chatMessages = this.messages.get(chatId);
        if (chatMessages) {
            chatMessages.push(storedMsg);
        } else {
            this.messages.set(chatId, [storedMsg]);
        }
    }

    // ============ QUERY: CONVERSATIONS ============

    /**
     * Lấy danh sách conversations, có filter.
     * Sắp xếp theo lastMessageAt giảm dần (mới nhất trước).
     */
    getConversations(filter?: ConversationFilter): TelegramConversation[] {
        let results = Array.from(this.conversations.values());

        if (filter?.chatType) {
            results = results.filter((c) => c.chatType === filter.chatType);
        }

        if (filter?.isActive !== undefined) {
            results = results.filter((c) => c.isActive === filter.isActive);
        }

        // Sort mới nhất trước
        return results.sort(
            (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
        );
    }

    /**
     * Lấy chi tiết 1 conversation.
     */
    getConversation(chatId: string): TelegramConversation | undefined {
        return this.conversations.get(chatId);
    }

    // ============ QUERY: MESSAGES ============

    /**
     * Lấy lịch sử tin nhắn của 1 conversation.
     * @param limit - Giới hạn số tin nhắn (mặc định 50)
     * @param offset - Bỏ qua bao nhiêu tin nhắn (pagination)
     */
    getMessages(
        chatId: string,
        limit = 50,
        offset = 0,
    ): { messages: TelegramStoredMessage[]; total: number } {
        const chatMessages = this.messages.get(chatId) || [];

        return {
            messages: chatMessages.slice(offset, offset + limit),
            total: chatMessages.length,
        };
    }

    // ============ STATS ============

    /**
     * Thống kê tổng quan.
     */
    getStats(): TelegramStats {
        const allConvos = Array.from(this.conversations.values());
        const allMessages = Array.from(this.messages.values()).flat();

        return {
            totalConversations: allConvos.length,
            activeConversations: allConvos.filter((c) => c.isActive).length,
            privateChats: allConvos.filter((c) => c.chatType === 'private').length,
            groupChats: allConvos.filter(
                (c) => c.chatType === 'group' || c.chatType === 'supergroup',
            ).length,
            totalMessages: allMessages.length,
            incomingMessages: allMessages.filter((m) => m.direction === 'incoming')
                .length,
            outgoingMessages: allMessages.filter((m) => m.direction === 'outgoing')
                .length,
        };
    }
}
