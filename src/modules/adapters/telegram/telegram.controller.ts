// src/modules/adapters/telegram/telegram.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';

class TelegramSendDto {
  chatId: string;
  text: string;
}

class TelegramSendPhotoDto {
  chatId: string;
  photoUrl: string;
  caption?: string;
}

@ApiTags('Telegram API')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) { }

  @Get('bot-info')
  @ApiOperation({ summary: 'Xem thông tin Bot Telegram' })
  async getBotInfo(): Promise<any> {
    const info = await this.telegramService.getBotInfo();
    return { success: true, data: info };
  }

  @Post('send')
  @ApiOperation({ summary: 'Gửi tin nhắn text trực tiếp qua Telegram' })
  @ApiResponse({ status: 201, description: 'Đã gửi thành công' })
  async sendMessage(@Body() body: TelegramSendDto) {
    const result = await this.telegramService.sendDirectText(body.chatId, body.text);
    return { success: result, message: result ? 'Đã gửi tin nhắn' : 'Gửi thất bại' };
  }

  @Post('send-photo')
  @ApiOperation({ summary: 'Gửi ảnh trực tiếp qua Telegram' })
  async sendPhoto(@Body() body: TelegramSendPhotoDto) {
    const result = await this.telegramService.sendDirectPhoto(body.chatId, body.photoUrl, body.caption);
    return { success: result, message: result ? 'Đã gửi ảnh' : 'Gửi ảnh thất bại' };
  }
}
