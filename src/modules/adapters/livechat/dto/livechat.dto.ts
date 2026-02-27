// src/modules/adapters/livechat/dto/livechat.dto.ts
// DTOs cho LiveChat Management Controller — Validation + Swagger docs
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
} from 'class-validator';

// ============ MESSAGES ============

export class SendLivechatMessageDto {
  @ApiProperty({ description: 'ID của chat', example: 'QLRD0P2QQ0' })
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Xin chào, tôi có thể giúp gì?',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class SendLivechatFileDto {
  @ApiProperty({ description: 'ID của chat' })
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @ApiProperty({ description: 'URL của file' })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiProperty({
    description: 'Content type (MIME)',
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @ApiProperty({ description: 'Tên file', example: 'document.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;
}

export class SendLivechatRichMessageDto {
  @ApiProperty({ description: 'ID của chat' })
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @ApiProperty({ description: 'Rich message object (card, buttons...)' })
  richMessage!: Record<string, unknown>;
}

export class SendLivechatSystemMessageDto {
  @ApiProperty({ description: 'ID của chat' })
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @ApiProperty({ description: 'Nội dung system message' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}

// ============ CHAT MANAGEMENT ============

export class StartChatDto {
  @ApiPropertyOptional({ description: 'Danh sách users' })
  @IsOptional()
  users?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Thread config' })
  @IsOptional()
  thread?: Record<string, unknown>;
}

// ============ AGENT STATUS ============

export class SetAgentStatusDto {
  @ApiProperty({
    description: 'Trạng thái agent',
    enum: ['accepting_chats', 'not_accepting_chats', 'offline'],
    example: 'accepting_chats',
  })
  @IsString()
  @IsNotEmpty()
  status!: 'accepting_chats' | 'not_accepting_chats' | 'offline';
}

// ============ CUSTOMER ============

export class UpdateCustomerDto {
  @ApiPropertyOptional({ description: 'Tên customer', example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Email customer',
    example: 'customer@email.com',
  })
  @IsOptional()
  @IsString()
  email?: string;
}

export class BanCustomerDto {
  @ApiProperty({ description: 'Số ngày ban', example: 7 })
  @IsNumber()
  days!: number;
}

// ============ TAGS ============

export class TagDto {
  @ApiProperty({ description: 'Tên tag', example: 'vip' })
  @IsString()
  @IsNotEmpty()
  tag!: string;
}

// ============ TRANSFER ============

export class TransferChatDto {
  @ApiProperty({
    description: 'Danh sách agent IDs đích',
    example: ['agent1@company.com'],
  })
  @IsArray()
  @IsString({ each: true })
  targetAgentIds!: string[];

  @ApiPropertyOptional({ description: 'Có ép chuyển không', default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

// ============ WEBHOOK ============

export class RegisterWebhookDto {
  @ApiProperty({
    example: 'https://YOUR_NGROK_URL.ngrok-free.app/livechat/webhook/incoming',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({ example: 'incoming_chat_thread' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({ example: 'my_secret_key' })
  @IsString()
  @IsNotEmpty()
  secretKey!: string;

  @ApiProperty({
    description: 'Client ID của App trên LiveChat Developer Console',
    example: 'YOUR_CLIENT_ID',
  })
  @IsString()
  @IsNotEmpty()
  ownerClientId!: string;

  @ApiPropertyOptional({ enum: ['license', 'bot'], default: 'license' })
  @IsOptional()
  @IsString()
  type?: 'license' | 'bot';
}
