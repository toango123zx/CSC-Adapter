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

// ================================================================
// RESTRICT / PROMOTE MEMBER
// ================================================================

export class RestrictMemberDto {
    @ApiProperty({ description: 'Telegram Chat/Group ID', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Telegram User ID', example: 123456789 })
    @IsInt()
    userId!: number;

    @ApiPropertyOptional({ description: 'Cho phép gửi tin nhắn text', default: false })
    @IsOptional()
    @IsBoolean()
    canSendMessages?: boolean;

    @ApiPropertyOptional({ description: 'Cho phép gửi ảnh/video/file/sticker', default: false })
    @IsOptional()
    @IsBoolean()
    canSendMediaMessages?: boolean;

    @ApiPropertyOptional({ description: 'Cho phép gửi polls', default: false })
    @IsOptional()
    @IsBoolean()
    canSendPolls?: boolean;

    @ApiPropertyOptional({ description: 'Cho phép gửi GIF/game/sticker', default: false })
    @IsOptional()
    @IsBoolean()
    canSendOtherMessages?: boolean;

    @ApiPropertyOptional({ description: 'Cho phép thêm web page preview', default: false })
    @IsOptional()
    @IsBoolean()
    canAddWebPagePreviews?: boolean;

    @ApiPropertyOptional({ description: 'Cho phép thay đổi thông tin group', default: false })
    @IsOptional()
    @IsBoolean()
    canChangeInfo?: boolean;

    @ApiPropertyOptional({ description: 'Cho phép mời thành viên', default: false })
    @IsOptional()
    @IsBoolean()
    canInviteUsers?: boolean;

    @ApiPropertyOptional({ description: 'Cho phép ghim tin nhắn', default: false })
    @IsOptional()
    @IsBoolean()
    canPinMessages?: boolean;

    @ApiPropertyOptional({ description: 'Thời gian restrict (Unix timestamp giây, 0 = vĩnh viễn)', default: 0 })
    @IsOptional()
    @IsInt()
    untilDate?: number;
}

export class PromoteMemberDto {
    @ApiProperty({ description: 'Telegram Chat/Group ID', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Telegram User ID', example: 123456789 })
    @IsInt()
    userId!: number;

    @ApiPropertyOptional({ description: 'Quyền thay đổi thông tin group', default: false })
    @IsOptional()
    @IsBoolean()
    canChangeInfo?: boolean;

    @ApiPropertyOptional({ description: 'Quyền đăng bài (channel)', default: false })
    @IsOptional()
    @IsBoolean()
    canPostMessages?: boolean;

    @ApiPropertyOptional({ description: 'Quyền sửa bài (channel)', default: false })
    @IsOptional()
    @IsBoolean()
    canEditMessages?: boolean;

    @ApiPropertyOptional({ description: 'Quyền xóa tin nhắn', default: false })
    @IsOptional()
    @IsBoolean()
    canDeleteMessages?: boolean;

    @ApiPropertyOptional({ description: 'Quyền mời thành viên', default: false })
    @IsOptional()
    @IsBoolean()
    canInviteUsers?: boolean;

    @ApiPropertyOptional({ description: 'Quyền hạn chế thành viên', default: false })
    @IsOptional()
    @IsBoolean()
    canRestrictMembers?: boolean;

    @ApiPropertyOptional({ description: 'Quyền ghim tin nhắn', default: false })
    @IsOptional()
    @IsBoolean()
    canPinMessages?: boolean;

    @ApiPropertyOptional({ description: 'Quyền phong Admin khác', default: false })
    @IsOptional()
    @IsBoolean()
    canPromoteMembers?: boolean;

    @ApiPropertyOptional({ description: 'Quyền quản lý video chat', default: false })
    @IsOptional()
    @IsBoolean()
    canManageVideoChats?: boolean;

    @ApiPropertyOptional({ description: 'Quyền quản lý chat', default: false })
    @IsOptional()
    @IsBoolean()
    canManageChat?: boolean;
}

// ================================================================
// CHAT PHOTO
// ================================================================

export class SetChatPhotoDto {
    @ApiProperty({ description: 'Telegram Chat/Group ID', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'URL ảnh đại diện cho group', example: 'https://example.com/avatar.png' })
    @IsString()
    @IsNotEmpty()
    photoUrl!: string;
}

// ================================================================
// SEND — VIDEO / STICKER
// ================================================================

export class SendTelegramVideoDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'URL video cần gửi', example: 'https://example.com/video.mp4' })
    @IsString()
    @IsNotEmpty()
    videoUrl!: string;

    @ApiPropertyOptional({ description: 'Caption cho video' })
    @IsOptional()
    @IsString()
    caption?: string;
}

export class SendTelegramStickerDto {
    @ApiProperty({ description: 'Telegram Chat ID', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Sticker file_id hoặc URL', example: 'CAACAgIAAxkBAAI...' })
    @IsString()
    @IsNotEmpty()
    sticker!: string;
}

// ================================================================
// FORWARD / COPY MESSAGE
// ================================================================

export class ForwardMessageDto {
    @ApiProperty({ description: 'Chat ID đích (nơi nhận)', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Chat ID nguồn (nơi tin nhắn gốc)', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    fromChatId!: string;

    @ApiProperty({ description: 'ID tin nhắn cần forward', example: 42 })
    @IsInt()
    messageId!: number;
}

export class CopyMessageDto {
    @ApiProperty({ description: 'Chat ID đích (nơi nhận bản sao)', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Chat ID nguồn (nơi tin nhắn gốc)', example: '-1001234567890' })
    @IsString()
    @IsNotEmpty()
    fromChatId!: string;

    @ApiProperty({ description: 'ID tin nhắn cần copy', example: 42 })
    @IsInt()
    messageId!: number;

    @ApiPropertyOptional({ description: 'Caption mới (thay thế caption gốc)' })
    @IsOptional()
    @IsString()
    caption?: string;
}

