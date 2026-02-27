// src/modules/adapters/telegram/telegram.controller.ts
// REST API cho Telegram — Send + Conversations + Groups + Members + Messages
import { Controller, Get, Post, Delete, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiQuery } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { TelegramClientService } from './telegram-client.service';
import { TelegramStoreService } from './telegram-store.service';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  TelegramBotInfo,
  TelegramConversation,
  TelegramStoredMessage,
  TelegramStats,
  TelegramChatType,
} from './telegram.types';
import {
  SendTelegramTextDto,
  SendTelegramPhotoDto,
  SendTelegramDocumentDto,
  SendTelegramLocationDto,
  SendTelegramContactDto,
  ChatIdDto,
  CreateInviteLinkDto,
  SetChatTitleDto,
  SetChatDescriptionDto,
  MemberActionDto,
  EditMessageDto,
  MessageActionDto,
} from './dto/telegram.dto';
import {
  CreateSoloGroupDto,
  CreateGroupWithUsersDto,
  AddMembersDto,
  DeleteGroupDto,
} from './dto/telegram-mtproto.dto';

@ApiTags('Telegram API')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramClientService: TelegramClientService,
    private readonly storeService: TelegramStoreService,
  ) { }

  // ================================================================
  // COMPLETELY AUTOMATED GROUP MANAGEMENT (MTProto / UserBot)
  // ================================================================

  @Post('groups/create-solo')
  @ApiOperation({
    summary: '(MTProto) Tạo Group chỉ có mình + optional bots',
    description: 'Tạo Supergroup trống (không cần user khách nào). Có thể tự động add 1 hoặc nhiều Bot vào và phong Admin.',
  })
  async createSoloGroup(
    @Body() dto: CreateSoloGroupDto,
  ): Promise<ApiResponse<{ chatId: string; bots?: { added: string[]; failed: string[] } }>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình. (Thiếu TELEGRAM_SESSION_STRING)' };
    }

    // 1. Tạo Supergroup (không cần user nào, chỉ mình)
    const chatId = await this.telegramClientService.createSuperGroup(dto.title, dto.about);
    if (!chatId) {
      return { success: false, error: 'Tạo Supergroup thất bại' };
    }

    // 2. Nếu có bots, add vào và promote Admin
    let botsResult: { added: string[]; failed: string[] } | undefined;
    if (dto.botUsernames && dto.botUsernames.length > 0) {
      botsResult = await this.telegramClientService.addBotsToGroup(chatId, dto.botUsernames);
    }

    return { success: true, data: { chatId, bots: botsResult } };
  }

  @Post('groups/create-with-users')
  @ApiOperation({
    summary: '(MTProto) Tạo Group có mình + 1 hoặc nhiều người + optional bots',
    description: 'Tạo Basic Group với danh sách users. Tùy chọn thêm 1 hoặc nhiều Bot (tự động phong Admin).',
  })
  async createGroupWithUsers(
    @Body() dto: CreateGroupWithUsersDto,
  ): Promise<ApiResponse<{ chatId: string; bots?: { added: string[]; failed: string[] } }>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình. (Thiếu TELEGRAM_SESSION_STRING)' };
    }

    // 1. Tạo Group với danh sách users
    const chatId = await this.telegramClientService.createGroup(dto.title, dto.users);
    if (!chatId) {
      return { success: false, error: 'Tạo group thất bại' };
    }

    // 2. Nếu có bots, add vào và promote Admin
    let botsResult: { added: string[]; failed: string[] } | undefined;
    if (dto.botUsernames && dto.botUsernames.length > 0) {
      botsResult = await this.telegramClientService.addBotsToGroup(chatId, dto.botUsernames);
    }

    return { success: true, data: { chatId, bots: botsResult } };
  }

  @Post('groups/add-members')
  @ApiOperation({ summary: '(MTProto) Add user/số điện thoại trực tiếp vào Group' })
  async addMembers(
    @Body() dto: AddMembersDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.addMembersToGroup(dto.chatId, dto.users);
    return {
      success: result,
      message: result ? 'Đã thêm thành viên thành công' : 'Thêm thành viên thất bại. Đảm bảo user không tắt chế độ mời.',
    };
  }

  @Delete('groups/delete-completely')
  @ApiOperation({ summary: '(MTProto) Xóa xổ Group hoàn toàn khỏi Telegram Server (Cần quyền Creator)' })
  async deleteGroupCompletely(
    @Body() dto: DeleteGroupDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.deleteGroup(dto.chatId);
    return {
      success: result,
      message: result ? 'Đã xóa hoàn toàn Group' : 'Xóa thất bại. Kiểm tra lại ID và quyền Creator.',
    };
  }

  // ================================================================
  // BOT INFO
  // ================================================================

  @Get('bot-info')
  @ApiOperation({ summary: 'Xem thông tin Bot Telegram' })
  async getBotInfo(): Promise<ApiResponse<TelegramBotInfo>> {
    try {
      const info = await this.telegramService.getBotInfo();
      return { success: true, data: info };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  // ================================================================
  // CONVERSATIONS — QUERY
  // ================================================================

  @Get('conversations')
  @ApiOperation({ summary: 'Danh sách tất cả cuộc hội thoại Telegram' })
  @ApiQuery({ name: 'type', required: false, enum: ['private', 'group', 'supergroup', 'channel'] })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  getConversations(
    @Query('type') chatType?: TelegramChatType,
    @Query('active') active?: string,
  ): ApiResponse<TelegramConversation[]> {
    const isActive = active !== undefined ? active === 'true' : undefined;
    const conversations = this.storeService.getConversations({ chatType, isActive });
    return { success: true, data: conversations };
  }

  @Get('conversations/private')
  @ApiOperation({ summary: 'Danh sách chat 1-1 với người dùng' })
  getPrivateChats(): ApiResponse<TelegramConversation[]> {
    const conversations = this.storeService.getConversations({ chatType: 'private' });
    return { success: true, data: conversations };
  }

  @Get('conversations/groups')
  @ApiOperation({ summary: 'Danh sách group/supergroup chats' })
  getGroupChats(): ApiResponse<TelegramConversation[]> {
    const all = this.storeService.getConversations();
    const groups = all.filter(
      (c) => c.chatType === 'group' || c.chatType === 'supergroup',
    );
    return { success: true, data: groups };
  }

  @Get('conversations/:chatId')
  @ApiOperation({ summary: 'Chi tiết 1 cuộc hội thoại' })
  getConversation(
    @Param('chatId') chatId: string,
  ): ApiResponse<TelegramConversation> {
    const conversation = this.storeService.getConversation(chatId);
    if (!conversation) {
      return { success: false, error: `Không tìm thấy conversation: ${chatId}` };
    }
    return { success: true, data: conversation };
  }

  @Get('conversations/:chatId/messages')
  @ApiOperation({ summary: 'Lịch sử tin nhắn của 1 cuộc hội thoại' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getMessages(
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): ApiResponse<{ messages: TelegramStoredMessage[]; total: number }> {
    const conversation = this.storeService.getConversation(chatId);
    if (!conversation) {
      return { success: false, error: `Không tìm thấy conversation: ${chatId}` };
    }
    const result = this.storeService.getMessages(
      chatId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    return { success: true, data: result };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng quan Telegram' })
  getStats(): ApiResponse<TelegramStats> {
    return { success: true, data: this.storeService.getStats() };
  }

  // ================================================================
  // CHAT / GROUP INFO
  // ================================================================

  @Get('chats/:chatId/info')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết chat/group từ Telegram API' })
  async getChatInfo(
    @Param('chatId') chatId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    try {
      const chat = await this.telegramService.getChat(chatId);
      return { success: true, data: chat };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  @Get('chats/:chatId/member-count')
  @ApiOperation({ summary: 'Số lượng thành viên trong group' })
  async getChatMemberCount(
    @Param('chatId') chatId: string,
  ): Promise<ApiResponse<{ count: number }>> {
    try {
      const count = await this.telegramService.getChatMemberCount(chatId);
      return { success: true, data: { count } };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  // ================================================================
  // GROUP MANAGEMENT
  // ================================================================

  @Patch('groups/title')
  @ApiOperation({ summary: 'Đổi tên group (bot phải là admin)' })
  async setChatTitle(
    @Body() dto: SetChatTitleDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.setChatTitle(dto.chatId, dto.title);
    return {
      success: result,
      message: result ? 'Đã đổi tên group' : 'Đổi tên thất bại (bot cần quyền admin)',
    };
  }

  @Patch('groups/description')
  @ApiOperation({ summary: 'Đổi mô tả group (bot phải là admin)' })
  async setChatDescription(
    @Body() dto: SetChatDescriptionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.setChatDescription(
      dto.chatId,
      dto.description,
    );
    return {
      success: result,
      message: result ? 'Đã đổi mô tả group' : 'Đổi mô tả thất bại',
    };
  }

  @Post('groups/invite-link')
  @ApiOperation({ summary: 'Tạo link mời vào group (có thể có điều kiện)' })
  async createInviteLink(
    @Body() dto: CreateInviteLinkDto,
  ): Promise<ApiResponse<{ inviteLink: string }>> {
    const result = await this.telegramService.createInviteLink(dto.chatId, {
      name: dto.name,
      expire_date: dto.expireDate,
      member_limit: dto.memberLimit,
      creates_join_request: dto.createsJoinRequest,
    });
    if (!result) {
      return { success: false, error: 'Tạo link mời thất bại' };
    }
    return { success: true, data: result };
  }

  @Post('groups/approve-join')
  @ApiOperation({ summary: 'Phê duyệt yêu cầu tham gia group' })
  async approveJoin(
    @Body() dto: MemberActionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.approveChatJoinRequest(
      dto.chatId,
      dto.userId,
    );
    return {
      success: result,
      message: result ? 'Đã duyệt yêu cầu' : 'Duyệt thất bại',
    };
  }

  @Post('groups/decline-join')
  @ApiOperation({ summary: 'Từ chối yêu cầu tham gia group' })
  async declineJoin(
    @Body() dto: MemberActionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.declineChatJoinRequest(
      dto.chatId,
      dto.userId,
    );
    return {
      success: result,
      message: result ? 'Đã từ chối yêu cầu' : 'Từ chối thất bại',
    };
  }

  @Post('groups/leave')
  @ApiOperation({ summary: 'Bot rời khỏi group' })
  async leaveChat(
    @Body() dto: ChatIdDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.leaveChat(dto.chatId);
    return {
      success: result,
      message: result ? 'Bot đã rời group' : 'Rời group thất bại',
    };
  }

  // ================================================================
  // MEMBER MANAGEMENT
  // ================================================================

  @Post('members/kick')
  @ApiOperation({ summary: 'Kick (ban) user khỏi group (bot phải là admin)' })
  async kickMember(
    @Body() dto: MemberActionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.kickMember(dto.chatId, dto.userId);
    return {
      success: result,
      message: result ? 'Đã kick user khỏi group' : 'Kick thất bại (bot cần quyền admin)',
    };
  }

  @Post('members/unban')
  @ApiOperation({ summary: 'Unban user — cho phép tham gia lại group' })
  async unbanMember(
    @Body() dto: MemberActionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.unbanMember(dto.chatId, dto.userId);
    return {
      success: result,
      message: result ? 'Đã unban user' : 'Unban thất bại',
    };
  }

  @Get('members/:chatId/:userId')
  @ApiOperation({ summary: 'Xem thông tin thành viên trong group' })
  async getChatMember(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    try {
      const member = await this.telegramService.getChatMember(
        chatId,
        parseInt(userId, 10),
      );
      return { success: true, data: member };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  // ================================================================
  // MESSAGE MANAGEMENT
  // ================================================================

  @Patch('messages/edit')
  @ApiOperation({ summary: 'Chỉnh sửa tin nhắn đã gửi (chỉ tin nhắn của bot)' })
  async editMessage(
    @Body() dto: EditMessageDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.editMessage(
      dto.chatId,
      dto.messageId,
      dto.newText,
    );
    return {
      success: result,
      message: result ? 'Đã chỉnh sửa tin nhắn' : 'Edit thất bại',
    };
  }

  @Delete('messages/delete')
  @ApiOperation({ summary: 'Xóa tin nhắn (bot có thể xóa tin của mình, hoặc tin user nếu là admin)' })
  async deleteMessage(
    @Body() dto: MessageActionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.deleteMessage(
      dto.chatId,
      dto.messageId,
    );
    return {
      success: result,
      message: result ? 'Đã xóa tin nhắn' : 'Xóa thất bại',
    };
  }

  @Post('messages/pin')
  @ApiOperation({ summary: 'Ghim tin nhắn trong chat' })
  async pinMessage(
    @Body() dto: MessageActionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.pinMessage(
      dto.chatId,
      dto.messageId,
    );
    return {
      success: result,
      message: result ? 'Đã ghim tin nhắn' : 'Ghim thất bại',
    };
  }

  @Post('messages/unpin')
  @ApiOperation({ summary: 'Bỏ ghim tin nhắn' })
  async unpinMessage(
    @Body() dto: MessageActionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.unpinMessage(
      dto.chatId,
      dto.messageId,
    );
    return {
      success: result,
      message: result ? 'Đã bỏ ghim tin nhắn' : 'Bỏ ghim thất bại',
    };
  }

  // ================================================================
  // SEND — TEXT
  // ================================================================

  @Post('send')
  @ApiOperation({ summary: 'Gửi tin nhắn text qua Telegram' })
  @SwaggerResponse({ status: 201, description: 'Đã gửi thành công' })
  async sendMessage(
    @Body() dto: SendTelegramTextDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.sendText(dto.chatId, dto.text);
    return {
      success: result,
      message: result ? 'Đã gửi tin nhắn' : 'Gửi thất bại',
    };
  }

  // ================================================================
  // SEND — PHOTO
  // ================================================================

  @Post('send-photo')
  @ApiOperation({ summary: 'Gửi ảnh qua Telegram' })
  async sendPhoto(
    @Body() dto: SendTelegramPhotoDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.sendPhoto(
      dto.chatId,
      dto.photoUrl,
      dto.caption,
    );
    return {
      success: result,
      message: result ? 'Đã gửi ảnh' : 'Gửi ảnh thất bại',
    };
  }

  // ================================================================
  // SEND — DOCUMENT
  // ================================================================

  @Post('send-document')
  @ApiOperation({ summary: 'Gửi file/tài liệu qua Telegram' })
  async sendDocument(
    @Body() dto: SendTelegramDocumentDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.sendDocument(
      dto.chatId,
      dto.documentUrl,
      dto.caption,
    );
    return {
      success: result,
      message: result ? 'Đã gửi file' : 'Gửi file thất bại',
    };
  }

  // ================================================================
  // SEND — LOCATION
  // ================================================================

  @Post('send-location')
  @ApiOperation({ summary: 'Gửi vị trí qua Telegram' })
  async sendLocation(
    @Body() dto: SendTelegramLocationDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.sendLocation(
      dto.chatId,
      dto.latitude,
      dto.longitude,
    );
    return {
      success: result,
      message: result ? 'Đã gửi vị trí' : 'Gửi vị trí thất bại',
    };
  }

  // ================================================================
  // SEND — CONTACT
  // ================================================================

  @Post('send-contact')
  @ApiOperation({ summary: 'Gửi thông tin liên hệ qua Telegram' })
  async sendContact(
    @Body() dto: SendTelegramContactDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.sendContact(
      dto.chatId,
      dto.phoneNumber,
      dto.firstName,
      dto.lastName,
    );
    return {
      success: result,
      message: result ? 'Đã gửi liên hệ' : 'Gửi liên hệ thất bại',
    };
  }
}
