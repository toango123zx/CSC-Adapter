// src/modules/adapters/telegram/dto/telegram.dto.ts
// DTOs cho Telegram Controller — Validation + Swagger docs
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsInt, IsBoolean } from 'class-validator';

// ================================================================
// SEND
// ================================================================

export class SendTelegramTextDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({
        description: 'Nội dung tin nhắn',
        example: 'Xin chào, tôi có thể giúp gì?',
    })
    @IsString()
    @IsNotEmpty()
    text!: string;
}

export class SendTelegramPhotoDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({
        description: 'URL ảnh cần gửi',
        example: 'https://example.com/image.png',
    })
    @IsString()
    @IsNotEmpty()
    photoUrl!: string;

    @ApiPropertyOptional({ description: 'Caption cho ảnh' })
    @IsOptional()
    @IsString()
    caption?: string;
}

export class SendTelegramDocumentDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({
        description: 'URL file cần gửi',
        example: 'https://example.com/document.pdf',
    })
    @IsString()
    @IsNotEmpty()
    documentUrl!: string;

    @ApiPropertyOptional({ description: 'Caption cho file' })
    @IsOptional()
    @IsString()
    caption?: string;
}

export class SendTelegramLocationDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Vĩ độ', example: 10.762622 })
    @IsNumber()
    latitude!: number;

    @ApiProperty({ description: 'Kinh độ', example: 106.660172 })
    @IsNumber()
    longitude!: number;
}

export class SendTelegramContactDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Số điện thoại', example: '+84901234567' })
    @IsString()
    @IsNotEmpty()
    phoneNumber!: string;

    @ApiProperty({ description: 'Tên', example: 'Nguyễn Văn A' })
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @ApiPropertyOptional({ description: 'Họ', example: 'Nguyễn' })
    @IsOptional()
    @IsString()
    lastName?: string;
}

// ================================================================
// GROUP MANAGEMENT
// ================================================================

export class ChatIdDto {
    @ApiProperty({ description: 'Telegram Chat/Group ID', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;
}

export class SetChatTitleDto {
    @ApiProperty({ description: 'Telegram Chat/Group ID', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Tên mới cho group', example: 'CSKH - Nhóm hỗ trợ' })
    @IsString()
    @IsNotEmpty()
    title!: string;
}

export class SetChatDescriptionDto {
    @ApiProperty({ description: 'Telegram Chat/Group ID', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({
        description: 'Mô tả mới cho group',
        example: 'Nhóm hỗ trợ khách hàng VIP',
    })
    @IsString()
    @IsNotEmpty()
    description!: string;
}

export class CreateInviteLinkDto {
    @ApiProperty({ description: 'Telegram Chat/Group ID', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiPropertyOptional({ description: 'Tên hiển thị của link (ví dụ: Link sự kiện)' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Thời gian hết hạn (Unix timestamp giây, vd: 1714521600)' })
    @IsOptional()
    @IsInt()
    expireDate?: number;

    @ApiPropertyOptional({ description: 'Số người tối đa có thể tham gia qua link này (từ 1 đến 99999)' })
    @IsOptional()
    @IsInt()
    memberLimit?: number;

    @ApiPropertyOptional({ description: 'Cần Admin duyệt (true/false, không dùng chung với memberLimit)', default: false })
    @IsOptional()
    @IsBoolean()
    createsJoinRequest?: boolean;
}

// ================================================================
// MEMBER MANAGEMENT
// ================================================================

export class MemberActionDto {
    @ApiProperty({ description: 'Telegram Chat/Group ID', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Telegram User ID', example: 123456789 })
    @IsInt()
    userId!: number;
}

// ================================================================
// MESSAGE MANAGEMENT
// ================================================================

export class EditMessageDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'ID tin nhắn cần edit', example: 42 })
    @IsInt()
    messageId!: number;

    @ApiProperty({ description: 'Nội dung mới', example: 'Tin nhắn đã chỉnh sửa' })
    @IsString()
    @IsNotEmpty()
    newText!: string;
}

export class MessageActionDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'ID tin nhắn', example: 42 })
    @IsInt()
    messageId!: number;
}
