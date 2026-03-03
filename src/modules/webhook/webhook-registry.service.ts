// src/modules/webhook/webhook-registry.service.ts
// Registry Pattern — Quản lý tất cả webhook handlers
// Mỗi adapter module tự đăng ký handler của mình khi khởi tạo
import { Injectable, Logger } from '@nestjs/common';
import { IWebhookHandler } from 'src/common/interfaces/standard-message.interface';

@Injectable()
export class WebhookRegistryService {
    private readonly logger = new Logger(WebhookRegistryService.name);
    private readonly handlers: Map<string, IWebhookHandler> = new Map();

    /**
     * Đăng ký 1 webhook handler cho platform.
     * Gọi bởi mỗi adapter trong onModuleInit().
     */
    register(handler: IWebhookHandler): void {
        const key = handler.platform.toUpperCase();

        if (this.handlers.has(key)) {
            this.logger.warn(`⚠️ Webhook handler cho ${key} đã tồn tại, sẽ bị ghi đè`);
        }

        this.handlers.set(key, handler);
        this.logger.log(`✅ Đã đăng ký webhook handler: ${key}`);
    }

    /**
     * Lấy handler theo platform.
     * @throws Error nếu platform chưa được đăng ký
     */
    getHandler(platform: string): IWebhookHandler {
        const key = platform.toUpperCase();
        const handler = this.handlers.get(key);
        if (!handler) {
            throw new Error(
                `Webhook handler cho platform "${platform}" chưa được đăng ký. ` +
                `Các platform hiện có: [${this.getRegisteredPlatforms().join(', ')}]`,
            );
        }
        return handler;
    }

    /**
     * Kiểm tra platform đã đăng ký handler chưa.
     */
    hasHandler(platform: string): boolean {
        return this.handlers.has(platform.toUpperCase());
    }

    /**
     * Danh sách platform đã đăng ký webhook handler.
     */
    getRegisteredPlatforms(): string[] {
        return Array.from(this.handlers.keys());
    }
}
