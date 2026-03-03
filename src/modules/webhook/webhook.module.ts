// src/modules/webhook/webhook.module.ts
// Webhook Module — Single entry point cho tất cả webhook từ các nền tảng
// @Global() để mọi adapter module đều có thể inject WebhookRegistryService
import { Module, Global } from '@nestjs/common';
import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookGatewayController } from './webhook-gateway.controller';

@Global()
@Module({
    controllers: [WebhookGatewayController],
    providers: [WebhookRegistryService],
    exports: [WebhookRegistryService],
})
export class WebhookModule { }
