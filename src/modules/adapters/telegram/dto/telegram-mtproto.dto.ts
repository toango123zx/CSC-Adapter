// src/modules/adapters/telegram/dto/telegram-mtproto.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

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
