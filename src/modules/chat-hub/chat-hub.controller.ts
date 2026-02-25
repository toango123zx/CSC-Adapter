import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatHubService } from './chat-hub.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SenderType, MessageType } from '../../common/enums';

@ApiTags('Chat Hub API')
@Controller('chat')
export class ChatHubController {
  constructor(private readonly chatHubService: ChatHubService) { }

  @Post('send')
  @ApiOperation({ summary: 'Gửi tin nhắn đến Khách hàng qua API' })
  @ApiResponse({ status: 201, description: 'Đã gửi tin nhắn thành công' })
  @ApiResponse({ status: 400, description: 'Lỗi dữ liệu đầu vào' })
  async sendMessage(@Body() dto: SendMessageDto) {
    const adapter = this.chatHubService.getAdapter(dto.platform);

    const message = {
      platform: dto.platform,
      platformThreadId: dto.threadId,
      platformMessageId: `api_${Date.now()}`,
      senderType: SenderType.AGENT,
      senderName: dto.senderName || 'System API',
      messageType: dto.messageType || MessageType.TEXT,
      text: dto.text,
      mediaUrl: dto.mediaUrl,
      timestamp: new Date(),
    };

    const result = await adapter.sendMessage(dto.threadId, message);

    return {
      success: result,
      message: result ? 'Đã gửi tin nhắn' : 'Gửi tin nhắn thất bại',
    };
  }

  @Get('adapters')
  @ApiOperation({ summary: 'Xem danh sách adapter đã đăng ký' })
  getAdapters() {
    return {
      adapters: this.chatHubService.getRegisteredAdapters(),
    };
  }
}