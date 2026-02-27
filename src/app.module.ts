import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatHubModule } from './modules/chat-hub/chat-hub.module';
import { AgentGatewayModule } from './modules/agent-gateway/agent-gateway.module';
import { TelegramModule } from './modules/adapters/telegram/telegram.module';
import { LivechatModule } from './modules/adapters/livechat/livechat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Core — load trước
    ChatHubModule,
    AgentGatewayModule,

    // Adapters — mỗi adapter tự đăng ký với Hub
    TelegramModule,
    LivechatModule,
  ],
})
export class AppModule { }
