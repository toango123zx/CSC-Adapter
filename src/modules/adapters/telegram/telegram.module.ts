// src/modules/adapters/telegram/telegram.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramAdapter } from './telegram.adapter';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [ConfigModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramAdapter],
  exports: [TelegramService, TelegramAdapter],
})
export class TelegramModule { }