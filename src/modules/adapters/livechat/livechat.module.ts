import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LivechatGateway } from './livechat.gateway';
import { LivechatService } from './livechat.service';
import { LivechatController } from './livechat.controller';

@Module({
  imports: [ConfigModule],
  controllers: [LivechatController],
  providers: [LivechatGateway, LivechatService],
  exports: [LivechatService],
})
export class LivechatModule {}