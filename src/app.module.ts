import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatHubModule } from './modules/chat-hub/chat-hub.module';
import { TelegramModule } from './modules/adapters/telegram/telegram.module';
import { LivechatModule } from './modules/adapters/livechat/livechat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ChatHubModule,   // Hub load trước
    TelegramModule,  // Các adapter load sau
    LivechatModule,
  ],
})
export class AppModule {}