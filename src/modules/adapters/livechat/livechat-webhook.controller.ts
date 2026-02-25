// src/modules/adapters/livechat/livechat-webhook.controller.ts
// Controller chuyên nhận webhook từ LiveChat
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LivechatAdapter } from './livechat.adapter';
import { ChatHubService } from '../../chat-hub/chat-hub.service';
import { Logger } from '@nestjs/common';

@ApiTags('LiveChat Webhook')
@Controller('livechat/webhook')
export class LivechatWebhookController {
    private readonly logger = new Logger(LivechatWebhookController.name);

    constructor(
        private readonly livechatAdapter: LivechatAdapter,
        private readonly chatHubService: ChatHubService,
    ) { }

    @Post('incoming')
    @ApiOperation({ summary: 'Endpoint nhận webhook từ LiveChat (cấu hình URL này trên LiveChat)' })
    async receiveWebhook(@Body() payload: any) {
        this.logger.log(`📨 LiveChat Webhook received: ${payload?.action || 'unknown'}`);
        this.logger.debug(`Payload: ${JSON.stringify(payload).substring(0, 500)}`);

        // Parse webhook → IStandardMessage
        const standardMessage = await this.livechatAdapter.parseIncomingWebhook(payload);

        if (standardMessage) {
            // Chuyển tiếp tin nhắn vào Hub để routing
            await this.chatHubService.handleIncomingMessage(standardMessage);
            return { success: true, action: payload.action, processed: true };
        }

        return {
            success: true,
            action: payload.action,
            processed: false,
            reason: 'Webhook action không chứa tin nhắn cần xử lý',
        };
    }
}
