// src/modules/adapters/telegram/telegram-webhook.handler.ts
// Telegram Webhook Handler — Implement IWebhookHandler cho Strategy Pattern
// Đăng ký vào WebhookRegistryService để nhận webhook qua entry point chung
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
    IWebhookHandler,
    WebhookResult,
} from 'src/common/interfaces/standard-message.interface';
import { Platform } from 'src/common/enums';
import { TelegramAdapter } from './telegram.adapter';
import { ChatHubService } from '../../chat-hub/chat-hub.service';
import { WebhookRegistryService } from '../../webhook/webhook-registry.service';

@Injectable()
export class TelegramWebhookHandler implements IWebhookHandler, OnModuleInit {
    readonly platform = Platform.TELEGRAM;
    private readonly logger = new Logger(TelegramWebhookHandler.name);

    constructor(
        private readonly telegramAdapter: TelegramAdapter,
        private readonly chatHubService: ChatHubService,
        private readonly webhookRegistry: WebhookRegistryService,
    ) { }

    onModuleInit() {
        this.webhookRegistry.register(this);
        this.logger.log('✅ TelegramWebhookHandler đã đăng ký với WebhookRegistry');
    }

    /**
     * Xử lý webhook payload từ Telegram.
     *
     * NOTE: Telegram chủ yếu dùng Telegraf polling/webhook mode riêng
     * (xem TelegramAdapter.setupListeners()). Handler này cung cấp
     * thêm 1 entry point thống nhất qua WebhookGatewayController.
     */
    async handleWebhook(
        payload: any,
        headers?: Record<string, string>,
    ): Promise<WebhookResult> {
        try {
            this.logger.log('📨 Xử lý Telegram webhook payload');

            // Parse payload qua adapter (IChatAdapter.parseIncomingWebhook)
            const standardMessage =
                await this.telegramAdapter.parseIncomingWebhook(payload);

            if (standardMessage) {
                await this.chatHubService.handleIncomingMessage(standardMessage);
                return {
                    success: true,
                    processed: true,
                    message: 'Telegram webhook đã được xử lý',
                };
            }

            return {
                success: true,
                processed: false,
                message: 'Payload không chứa tin nhắn cần xử lý',
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi xử lý Telegram webhook: ${errorMsg}`);
            return {
                success: false,
                processed: false,
                message: errorMsg,
            };
        }
    }
}
