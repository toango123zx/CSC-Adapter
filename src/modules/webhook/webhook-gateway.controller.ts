// src/modules/webhook/webhook-gateway.controller.ts
// Single Entry Point — Nhận webhook từ TẤT CẢ nền tảng qua 1 URL pattern
// Route: POST /webhook/:platform
import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    Headers,
    Logger,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookResult } from 'src/common/interfaces/standard-message.interface';

@ApiTags('Webhook Gateway')
@Controller('webhook')
export class WebhookGatewayController {
    private readonly logger = new Logger(WebhookGatewayController.name);

    constructor(
        private readonly webhookRegistry: WebhookRegistryService,
    ) { }

    /**
     * Entry point chung cho tất cả webhook.
     * Platform được xác định qua URL parameter.
     *
     * Ví dụ:
     * - POST /webhook/telegram  → TelegramWebhookHandler
     * - POST /webhook/livechat  → LivechatWebhookHandler
     * - POST /webhook/zalo      → ZaloWebhookHandler (tương lai)
     */
    @Post(':platform')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Nhận webhook từ nền tảng (Telegram, LiveChat, ...)',
        description:
            'Single entry point cho tất cả webhook. Platform xác định qua URL param. ' +
            'Mỗi platform có handler riêng xử lý payload theo format của mình.',
    })
    @ApiParam({
        name: 'platform',
        description: 'Tên platform (telegram, livechat, ...)',
        example: 'livechat',
    })
    @ApiResponse({ status: 200, description: 'Webhook đã được xử lý' })
    @ApiResponse({ status: 400, description: 'Platform chưa được đăng ký' })
    async receiveWebhook(
        @Param('platform') platform: string,
        @Body() payload: any,
        @Headers() headers: Record<string, string>,
    ): Promise<WebhookResult> {
        this.logger.log(`📨 Webhook received: platform=${platform}`);

        try {
            const handler = this.webhookRegistry.getHandler(platform);
            const result = await handler.handleWebhook(payload, headers);

            this.logger.log(
                `${result.processed ? '✅' : '⏭️'} Webhook ${platform}: processed=${result.processed}`,
            );

            return result;
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Webhook ${platform} lỗi: ${errorMsg}`);

            return {
                success: false,
                processed: false,
                message: errorMsg,
            };
        }
    }

    /**
     * Xem danh sách các platform đã đăng ký webhook handler.
     * Dùng để debug và kiểm tra hệ thống.
     */
    @Get('platforms')
    @ApiOperation({ summary: 'Danh sách platform đã đăng ký webhook handler' })
    getRegisteredPlatforms() {
        return {
            platforms: this.webhookRegistry.getRegisteredPlatforms(),
            total: this.webhookRegistry.getRegisteredPlatforms().length,
        };
    }
}
