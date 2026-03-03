// src/modules/adapters/livechat/livechat-webhook.handler.ts
// LiveChat Webhook Handler — Implement IWebhookHandler cho Strategy Pattern
// Thay thế livechat-webhook.controller.ts cũ
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
    IWebhookHandler,
    WebhookResult,
} from 'src/common/interfaces/standard-message.interface';
import { Platform } from 'src/common/enums';
import { LivechatAdapter } from './livechat.adapter';
import { ChatHubService } from '../../chat-hub/chat-hub.service';
import { WebhookRegistryService } from '../../webhook/webhook-registry.service';
import { LivechatWebhookPayload } from './livechat-api.types';

@Injectable()
export class LivechatWebhookHandler implements IWebhookHandler, OnModuleInit {
    readonly platform = Platform.LIVECHAT;
    private readonly logger = new Logger(LivechatWebhookHandler.name);

    constructor(
        private readonly livechatAdapter: LivechatAdapter,
        private readonly chatHubService: ChatHubService,
        private readonly webhookRegistry: WebhookRegistryService,
    ) { }

    onModuleInit() {
        this.webhookRegistry.register(this);
        this.logger.log('✅ LivechatWebhookHandler đã đăng ký với WebhookRegistry');
    }

    /**
     * Xử lý webhook payload từ LiveChat.
     * Logic chuyển từ livechat-webhook.controller.ts cũ.
     */
    async handleWebhook(
        payload: any,
        headers?: Record<string, string>,
    ): Promise<WebhookResult> {
        try {
            const webhookPayload = payload as LivechatWebhookPayload;

            this.logger.log(
                `📨 LiveChat Webhook received: ${webhookPayload?.action || 'unknown'}`,
            );
            this.logger.debug(
                `Payload: ${JSON.stringify(webhookPayload).substring(0, 500)}`,
            );

            // Parse webhook → IStandardMessage qua LivechatAdapter
            const standardMessage =
                await this.livechatAdapter.parseIncomingWebhook(webhookPayload);

            if (standardMessage) {
                // Chuyển tiếp tin nhắn vào Hub để routing
                await this.chatHubService.handleIncomingMessage(standardMessage);
                return {
                    success: true,
                    processed: true,
                    message: `LiveChat webhook action "${webhookPayload.action}" đã được xử lý`,
                    data: { action: webhookPayload.action },
                };
            }

            return {
                success: true,
                processed: false,
                message: 'Webhook action không chứa tin nhắn cần xử lý',
                data: { action: webhookPayload?.action },
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi xử lý LiveChat webhook: ${errorMsg}`);
            return {
                success: false,
                processed: false,
                message: errorMsg,
            };
        }
    }
}
