// src/modules/adapters/telegram/dto/telegram-mtproto.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, IsBoolean, IsInt } from 'class-validator';

/**
 * Tạo Group chỉ có mình (+ optional bots).
 * Sử dụng Supergroup (channels.CreateChannel) vì Basic Group yêu cầu tối thiểu 1 user khác.
 */
export class CreateSoloGroupDto {
    @ApiProperty({ description: 'Tên của Group mới', example: 'Phòng CSKH - Khách VIP' })
    @IsString()
    @IsNotEmpty()
    title!: string;

    @ApiPropertyOptional({ description: 'Mô tả group', example: 'Nhóm hỗ trợ khách hàng VIP' })
    @IsOptional()
    @IsString()
    about?: string;

    @ApiPropertyOptional({
        description: 'Danh sách username bot cần thêm vào (tự động được phong Admin)',
        example: ['@CskhSystemBot', '@NotifyBot']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    botUsernames?: string[];
}

/**
 * Tạo Group có mình + 1 hoặc nhiều người (+ optional bots).
 * Sử dụng Basic Group (messages.CreateChat) hoặc Supergroup tùy tình huống.
 */
export class CreateGroupWithUsersDto {
    @ApiProperty({ description: 'Tên của Group mới', example: 'Hỗ trợ - Nguyễn Văn A' })
    @IsString()
    @IsNotEmpty()
    title!: string;

    @ApiProperty({
        description: 'Danh sách username hoặc SĐT của người dùng cần add ngay khi tạo',
        example: ['@khachhang1', '+84901234567']
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    users!: string[];

    @ApiPropertyOptional({
        description: 'Danh sách username bot cần thêm vào (tự động được phong Admin)',
        example: ['@CskhSystemBot']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    botUsernames?: string[];
}

export class AddMembersDto {
    @ApiProperty({ description: 'ID của Group/Supergroup', example: '-100123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({
        description: 'Danh sách username hoặc số điện thoại',
        example: ['@nguyenvana', '+8498111222']
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    users!: string[];
}

export class DeleteGroupDto {
    @ApiProperty({ description: 'ID của Group/Supergroup cần xóa', example: '-100123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;
}

// ================================================================
// RENAME GROUP (MTProto)
// ================================================================

/**
 * DTO đổi tên Group qua MTProto UserBot.
 */
export class RenameGroupDto {
    @ApiProperty({ description: 'ID của Group/Supergroup cần đổi tên', example: '-100123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Tên mới cho Group', example: 'CSKH - Phòng hỗ trợ VIP' })
    @IsString()
    @IsNotEmpty()
    newTitle!: string;
}

// ================================================================
// INVITE LINK (MTProto)
// ================================================================

/**
 * DTO tạo invite link qua MTProto UserBot.
 * Hỗ trợ tuỳ chọn: cần duyệt, giới hạn người, hết hạn.
 */
export class CreateMtprotoInviteLinkDto {
    @ApiProperty({ description: 'ID của Group/Supergroup', example: '-100123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiPropertyOptional({ description: 'Tên hiển thị của link (ví dụ: "Link sự kiện")', example: 'Link mời tháng 3' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ description: 'Cần Admin duyệt khi user join (true/false)', default: false })
    @IsOptional()
    @IsBoolean()
    requestNeeded?: boolean;

    @ApiPropertyOptional({ description: 'Số người tối đa có thể join qua link này (1 - 99999)' })
    @IsOptional()
    @IsInt()
    usageLimit?: number;

    @ApiPropertyOptional({ description: 'Thời gian hết hạn (Unix timestamp giây, vd: 1714521600)' })
    @IsOptional()
    @IsInt()
    expireDate?: number;
}

// ================================================================
// JOIN REQUEST (MTProto)
// ================================================================

/**
 * DTO xử lý yêu cầu tham gia nhóm qua MTProto UserBot.
 * Dùng cho cả approve và reject.
 */
export class JoinRequestActionDto {
    @ApiProperty({ description: 'ID của Group/Supergroup', example: '-100123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Username hoặc ID của user cần duyệt/từ chối', example: '@nguyenvana' })
    @IsString()
    @IsNotEmpty()
    userId!: string;
}

// ================================================================
// SESSION TOKEN GENERATION (MTProto)
// ================================================================

/**
 * DTO bước 1: Khởi tạo phiên đăng nhập Telegram.
 * Server sẽ gửi mã OTP về số điện thoại → client cần gọi VerifySessionDto để hoàn tất.
 */
export class StartSessionDto {
    @ApiProperty({ description: 'Telegram App API ID (lấy từ https://my.telegram.org)', example: 30144129 })
    @IsInt()
    @IsNotEmpty()
    apiId!: number;

    @ApiProperty({ description: 'Telegram App API Hash (lấy từ https://my.telegram.org)', example: '69705ceef69ae3f115c71b935176cb0a' })
    @IsString()
    @IsNotEmpty()
    apiHash!: string;

    @ApiProperty({ description: 'Số điện thoại đăng ký Telegram (bao gồm mã quốc gia)', example: '+84901234567' })
    @IsString()
    @IsNotEmpty()
    phoneNumber!: string;
}

/**
 * DTO bước 2: Xác nhận mã OTP để lấy Session String.
 * Gửi phoneCode mà Telegram gửi về số điện thoại ở bước 1.
 * Nếu tài khoản có bật 2FA → cần gửi kèm password.
 */
export class VerifySessionDto {
    @ApiProperty({ description: 'Số điện thoại đã dùng ở bước 1 (để server map lại phiên)', example: '+84901234567' })
    @IsString()
    @IsNotEmpty()
    phoneNumber!: string;

    @ApiProperty({ description: 'Mã OTP mà Telegram gửi về số điện thoại', example: '12345' })
    @IsString()
    @IsNotEmpty()
    phoneCode!: string;

    @ApiPropertyOptional({ description: 'Mật khẩu 2FA (nếu tài khoản có bật Two-Step Verification)' })
    @IsOptional()
    @IsString()
    password?: string;
}

// ================================================================
// REMOVE MEMBER (MTProto)
// ================================================================

/**
 * DTO xóa thành viên khỏi Group qua MTProto UserBot.
 * Hỗ trợ cả Basic Group và Supergroup/Channel.
 */
export class RemoveMemberDto {
    @ApiProperty({ description: 'ID của Group/Supergroup', example: '-100123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Username hoặc ID của user cần xóa', example: '@nguyenvana' })
    @IsString()
    @IsNotEmpty()
    userId!: string;
}

// ================================================================
// SET GROUP ABOUT / DESCRIPTION (MTProto)
// ================================================================

/**
 * DTO đổi mô tả (about) Group qua MTProto UserBot.
 */
export class SetGroupAboutDto {
    @ApiProperty({ description: 'ID của Group/Supergroup', example: '-100123456789' })
    @IsString()
    @IsNotEmpty()
    chatId!: string;

    @ApiProperty({ description: 'Mô tả mới cho Group', example: 'Nhóm hỗ trợ khách hàng VIP - Phòng CSKH' })
    @IsString()
    @IsNotEmpty()
    about!: string;
}

