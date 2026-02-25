import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Platform, MessageType } from '../../../common/interfaces/standard-message.interface';

export class SendMessageDto {
  @ApiProperty({ enum: Platform, description: 'Nền tảng đích muốn gửi (TELEGRAM hoặc LIVECHAT)' })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({ description: 'ID cuộc hội thoại (Telegram Chat ID hoặc LiveChat Chat ID)', example: '123456789' })
  @IsNotEmpty()
  @IsString()
  threadId: string;

  @ApiProperty({ description: 'Nội dung tin nhắn', example: 'Chào bạn, đơn hàng của bạn đã được đóng gói!' })
  @IsNotEmpty()
  @IsString()
  text: string;

  @ApiProperty({ description: 'Tên người gửi hiển thị', required: false, example: 'Hệ thống CRM' })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiProperty({ enum: MessageType, description: 'Loại tin nhắn', required: false, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiProperty({ description: 'URL file/ảnh đính kèm', required: false })
  @IsOptional()
  @IsString()
  mediaUrl?: string;
}