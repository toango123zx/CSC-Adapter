// src/modules/adapters/livechat/livechat.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LivechatApiService } from './livechat-api.service';
import { LivechatAdapter } from './livechat.adapter';
import { LivechatWebhookHandler } from './livechat-webhook.handler';
import { LivechatManagementController } from './livechat-management.controller';

@Module({
  imports: [ConfigModule],
  controllers: [LivechatManagementController],
  providers: [LivechatApiService, LivechatAdapter, LivechatWebhookHandler],
  exports: [LivechatApiService, LivechatAdapter, LivechatWebhookHandler],
})
export class LivechatModule { }
