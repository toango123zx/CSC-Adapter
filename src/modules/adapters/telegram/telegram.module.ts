// src/modules/adapters/telegram/telegram.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramClientService } from './telegram-client.service';
import { TelegramStoreService } from './telegram-store.service';
import { TelegramAdapter } from './telegram.adapter';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [ConfigModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramClientService, TelegramStoreService, TelegramAdapter],
  exports: [TelegramService, TelegramClientService, TelegramStoreService, TelegramAdapter],
})
export class TelegramModule { }
