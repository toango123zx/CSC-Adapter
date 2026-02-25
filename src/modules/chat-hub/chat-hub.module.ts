import { Module, Global } from '@nestjs/common';
import { ChatHubService } from './chat-hub.service';
import { ChatHubController } from './chat-hub.controller';

@Global()
@Module({
  controllers: [ChatHubController], // <-- THÊM DÒNG NÀY
  providers: [ChatHubService],
  exports: [ChatHubService],
})
export class ChatHubModule {}