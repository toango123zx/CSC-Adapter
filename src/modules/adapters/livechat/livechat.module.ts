// src/modules/adapters/livechat/livechat.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LivechatApiService } from './livechat-api.service';
import { LivechatAdapter } from './livechat.adapter';
import { LivechatGateway } from './livechat.gateway';
import { LivechatWebhookController } from './livechat-webhook.controller';
import { LivechatManagementController } from './livechat-management.controller';

@Module({
  imports: [ConfigModule],
  controllers: [LivechatWebhookController, LivechatManagementController],
  providers: [LivechatApiService, LivechatAdapter, LivechatGateway],
  exports: [LivechatApiService, LivechatAdapter],
})
export class LivechatModule { }