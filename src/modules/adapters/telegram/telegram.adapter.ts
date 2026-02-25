// src/modules/adapters/telegram/telegram.adapter.ts
// Telegram Adapter - Chuyển đổi giữa Telegram format ↔ IStandardMessage
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { IChatAdapter, IStandardMessage } from 'src/common/interfaces/standard-message.interface';
import { Platform, SenderType, MessageType } from 'src/common/enums';
import { TelegramService } from './telegram.service';
import { ChatHubService } from '../../chat-hub/chat-hub.service';
import { Context } from 'telegraf';

@Injectable()
export class TelegramAdapter implements IChatAdapter, OnModuleInit {
    readonly platform = Platform.TELEGRAM;
    private readonly logger = new Logger(TelegramAdapter.name);

    constructor(
        private readonly telegramService: TelegramService,
        private readonly chatHubService: ChatHubService,
    ) { }

    onModuleInit() {
        this.chatHubService.registerAdapter(this.platform, this);
        // Gắn adapter vào service để service gọi khi nhận message từ bot
        this.telegramService.setAdapter(this);
        this.logger.log('✅ Telegram Adapter đã đăng ký với Chat Hub');
    }

    // ============ PARSE INCOMING ============

    async parseIncomingWebhook(payload: any): Promise<IStandardMessage | null> {
        // Telegram dùng polling qua Telegraf, parse được gọi trực tiếp từ service
        return this.parseTextMessage(payload);
    }

    async parseTextMessage(ctx: Context): Promise<IStandardMessage> {
        return {
            platform: this.platform,
            platformThreadId: ctx.chat.id.toString(),
            platformMessageId: ctx.message.message_id.toString(),
            senderType: SenderType.USER,
            senderName: ctx.from.first_name || 'Khách hàng',
            senderId: ctx.from.id.toString(),
            messageType: MessageType.TEXT,
            text: (ctx.message as any).text,
            timestamp: new Date(ctx.message.date * 1000),
        };
    }

    async parsePhotoMessage(ctx: Context): Promise<IStandardMessage> {
        const photos = (ctx.message as any).photo;
        const largestPhoto = photos[photos.length - 1];
        const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
        const caption = (ctx.message as any).caption || '';

        return {
            platform: this.platform,
            platformThreadId: ctx.chat.id.toString(),
            platformMessageId: ctx.message.message_id.toString(),
            senderType: SenderType.USER,
            senderName: ctx.from.first_name || 'Khách hàng',
            senderId: ctx.from.id.toString(),
            messageType: MessageType.IMAGE,
            text: caption || '📷 Đã gửi ảnh',
            mediaUrl: fileLink.href,
            metadata: { fileId: largestPhoto.file_id, width: largestPhoto.width, height: largestPhoto.height },
            timestamp: new Date(ctx.message.date * 1000),
        };
    }

    async parseDocumentMessage(ctx: Context): Promise<IStandardMessage> {
        const doc = (ctx.message as any).document;
        const fileLink = await ctx.telegram.getFileLink(doc.file_id);
        const caption = (ctx.message as any).caption || '';

        return {
            platform: this.platform,
            platformThreadId: ctx.chat.id.toString(),
            platformMessageId: ctx.message.message_id.toString(),
            senderType: SenderType.USER,
            senderName: ctx.from.first_name || 'Khách hàng',
            senderId: ctx.from.id.toString(),
            messageType: MessageType.FILE,
            text: caption || `📎 Đã gửi file: ${doc.file_name}`,
            mediaUrl: fileLink.href,
            metadata: { fileId: doc.file_id, fileName: doc.file_name, mimeType: doc.mime_type, fileSize: doc.file_size },
            timestamp: new Date(ctx.message.date * 1000),
        };
    }

    async parseStickerMessage(ctx: Context): Promise<IStandardMessage> {
        const sticker = (ctx.message as any).sticker;
        return {
            platform: this.platform,
            platformThreadId: ctx.chat.id.toString(),
            platformMessageId: ctx.message.message_id.toString(),
            senderType: SenderType.USER,
            senderName: ctx.from.first_name || 'Khách hàng',
            senderId: ctx.from.id.toString(),
            messageType: MessageType.STICKER,
            text: `${sticker.emoji || '🏷️'} Sticker`,
            metadata: { fileId: sticker.file_id, emoji: sticker.emoji, setName: sticker.set_name },
            timestamp: new Date(ctx.message.date * 1000),
        };
    }

    async parseLocationMessage(ctx: Context): Promise<IStandardMessage> {
        const location = (ctx.message as any).location;
        return {
            platform: this.platform,
            platformThreadId: ctx.chat.id.toString(),
            platformMessageId: ctx.message.message_id.toString(),
            senderType: SenderType.USER,
            senderName: ctx.from.first_name || 'Khách hàng',
            senderId: ctx.from.id.toString(),
            messageType: MessageType.LOCATION,
            text: `📍 Vị trí: ${location.latitude}, ${location.longitude}`,
            metadata: { latitude: location.latitude, longitude: location.longitude },
            timestamp: new Date(ctx.message.date * 1000),
        };
    }

    async parseContactMessage(ctx: Context): Promise<IStandardMessage> {
        const contact = (ctx.message as any).contact;
        return {
            platform: this.platform,
            platformThreadId: ctx.chat.id.toString(),
            platformMessageId: ctx.message.message_id.toString(),
            senderType: SenderType.USER,
            senderName: ctx.from.first_name || 'Khách hàng',
            senderId: ctx.from.id.toString(),
            messageType: MessageType.CONTACT,
            text: `📞 Liên hệ: ${contact.first_name} ${contact.last_name || ''} - ${contact.phone_number}`,
            metadata: { firstName: contact.first_name, lastName: contact.last_name, phoneNumber: contact.phone_number },
            timestamp: new Date(ctx.message.date * 1000),
        };
    }

    // ============ SEND MESSAGE ============

    /**
     * Gửi IStandardMessage tới user trên Telegram
     * Được gọi bởi ChatHub khi có tin nhắn từ nền tảng khác
     */
    async sendMessage(destinationThreadId: string, message: IStandardMessage): Promise<boolean> {
        return this.telegramService.sendStandardMessage(destinationThreadId, message);
    }

    // ============ HANDLE INCOMING (gọi từ TelegramService) ============

    /**
     * Xử lý tin nhắn đến từ Telegram Bot → chuyển tới Hub
     */
    async handleIncoming(message: IStandardMessage) {
        await this.chatHubService.handleIncomingMessage(message);
    }
}
