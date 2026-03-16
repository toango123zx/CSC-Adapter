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
  SendTelegramVideoDto,
  SendTelegramStickerDto,
  ChatIdDto,
  CreateInviteLinkDto,
  SetChatTitleDto,
  SetChatDescriptionDto,
  SetChatPhotoDto,
  MemberActionDto,
  RestrictMemberDto,
  PromoteMemberDto,
  EditMessageDto,
  MessageActionDto,
  ForwardMessageDto,
  CopyMessageDto,
} from './dto/telegram.dto';
import {
  CreateSoloGroupDto,
  CreateGroupWithUsersDto,
  AddMembersDto,
  DeleteGroupDto,
  RenameGroupDto,
  CreateMtprotoInviteLinkDto,
  JoinRequestActionDto,
  StartSessionDto,
  VerifySessionDto,
  RemoveMemberDto,
  SetGroupAboutDto,
  SetGroupPhotoDto as MtprotoSetGroupPhotoDto,
  SetGroupUsernameDto,
  ToggleSlowModeDto,
  MtprotoSendMessageDto,
  MtprotoSendMediaDto,
  MtprotoDeleteMessagesDto,
  MtprotoPinMessageDto,
  MtprotoGetHistoryDto,
  MtprotoSearchMessagesDto,
  MtprotoForwardMessagesDto,
  GetUserInfoDto,
  MtprotoRestrictMemberDto,
  RevokeInviteLinkDto,
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

  @Patch('groups/mtproto/rename')
  @ApiOperation({
    summary: '(MTProto) Đổi tên Group qua UserBot',
    description: 'Đổi tên nhóm Telegram qua MTProto. Hỗ trợ cả Basic Group và Supergroup/Channel.',
  })
  async renameGroupMtproto(
    @Body() dto: RenameGroupDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.renameGroup(dto.chatId, dto.newTitle);
    return {
      success: result,
      message: result ? `Đã đổi tên group thành "${dto.newTitle}"` : 'Đổi tên thất bại. Kiểm tra lại quyền và ID group.',
    };
  }

  @Post('groups/mtproto/invite-link')
  @ApiOperation({
    summary: '(MTProto) Tạo invite link tuỳ chỉnh cho Group',
    description: 'Tạo link mời qua MTProto UserBot. Có thể tuỳ chỉnh: cần duyệt, giới hạn người, hết hạn.',
  })
  async createMtprotoInviteLink(
    @Body() dto: CreateMtprotoInviteLinkDto,
  ): Promise<ApiResponse<{ inviteLink: string; requestNeeded: boolean; usageLimit?: number }>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.createInviteLink(dto.chatId, {
      title: dto.title,
      requestNeeded: dto.requestNeeded,
      usageLimit: dto.usageLimit,
      expireDate: dto.expireDate,
    });

    if (!result) {
      return { success: false, error: 'Tạo invite link thất bại' };
    }
    return { success: true, data: result };
  }

  @Post('groups/mtproto/invite-link/public')
  @ApiOperation({
    summary: '(MTProto) Tạo link join KHÔNG cần duyệt',
    description: 'Ai có link đều có thể join group ngay, không cần Admin approve.',
  })
  async createPublicInviteLink(
    @Body() dto: { chatId: string; title?: string },
  ): Promise<ApiResponse<{ inviteLink: string; requestNeeded: boolean }>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.createPublicInviteLink(dto.chatId, dto.title);
    if (!result) {
      return { success: false, error: 'Tạo link công khai thất bại' };
    }
    return { success: true, data: result };
  }

  @Post('groups/mtproto/invite-link/approval')
  @ApiOperation({
    summary: '(MTProto) Tạo link join CẦN Admin duyệt',
    description: 'Khi user click link → Admin nhận yêu cầu → phải approve hoặc reject.',
  })
  async createApprovalInviteLink(
    @Body() dto: { chatId: string; title?: string },
  ): Promise<ApiResponse<{ inviteLink: string; requestNeeded: boolean }>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.createApprovalInviteLink(dto.chatId, dto.title);
    if (!result) {
      return { success: false, error: 'Tạo link cần duyệt thất bại' };
    }
    return { success: true, data: result };
  }

  @Post('groups/mtproto/invite-link/limited')
  @ApiOperation({
    summary: '(MTProto) Tạo link join có GIỚI HẠN số người',
    description: 'Khi đạt đủ số lượng người join, link sẽ tự động hết hiệu lực.',
  })
  async createLimitedInviteLink(
    @Body() dto: CreateMtprotoInviteLinkDto,
  ): Promise<ApiResponse<{ inviteLink: string; requestNeeded: boolean; usageLimit?: number }>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    if (!dto.usageLimit || dto.usageLimit < 1) {
      return { success: false, error: 'usageLimit phải >= 1' };
    }

    const result = await this.telegramClientService.createLimitedInviteLink(
      dto.chatId,
      dto.usageLimit,
      dto.title,
    );
    if (!result) {
      return { success: false, error: 'Tạo link giới hạn thất bại' };
    }
    return { success: true, data: result };
  }

  @Post('groups/mtproto/approve-join')
  @ApiOperation({
    summary: '(MTProto) Phê duyệt yêu cầu tham gia nhóm',
    description: 'Accept user vào nhóm khi họ join bằng link cần duyệt (requestNeeded = true).',
  })
  async approveJoinMtproto(
    @Body() dto: JoinRequestActionDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.approveJoinRequest(dto.chatId, dto.userId);
    return {
      success: result,
      message: result ? `Đã duyệt user ${dto.userId} vào group` : 'Duyệt yêu cầu thất bại',
    };
  }

  @Post('groups/mtproto/reject-join')
  @ApiOperation({
    summary: '(MTProto) Từ chối yêu cầu tham gia nhóm',
    description: 'Reject user khi họ join bằng link cần duyệt (requestNeeded = true).',
  })
  async rejectJoinMtproto(
    @Body() dto: JoinRequestActionDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.rejectJoinRequest(dto.chatId, dto.userId);
    return {
      success: result,
      message: result ? `Đã từ chối user ${dto.userId}` : 'Từ chối yêu cầu thất bại',
    };
  }

  // ================================================================
  // SESSION TOKEN MANAGEMENT (MTProto)
  // ================================================================

  @Post('session/start')
  @ApiOperation({
    summary: '(MTProto) Bước 1: Khởi tạo đăng nhập Telegram — gửi OTP về SĐT',
    description: 'Tạo phiên đăng nhập tạm thời. Telegram sẽ gửi mã OTP về số điện thoại. Sau đó gọi /telegram/session/verify để hoàn tất.',
  })
  async startSession(
    @Body() dto: StartSessionDto,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.telegramClientService.startSessionAuth(
      dto.apiId,
      dto.apiHash,
      dto.phoneNumber,
    );

    if (!result) {
      return { success: false, error: 'Không thể gửi OTP. Kiểm tra lại apiId, apiHash và số điện thoại.' };
    }

    return {
      success: true,
      data: {
        message: `Đã gửi OTP về SĐT ${dto.phoneNumber}. Gọi POST /telegram/session/verify với phoneCode để hoàn tất.`,
      },
    };
  }

  @Post('session/verify')
  @ApiOperation({
    summary: '(MTProto) Bước 2: Xác nhận OTP — lấy Session String',
    description: 'Gửi mã OTP nhận được từ bước 1 để lấy TELEGRAM_SESSION_STRING. Nếu có 2FA, gửi kèm password.',
  })
  async verifySession(
    @Body() dto: VerifySessionDto,
  ): Promise<ApiResponse<{ sessionString: string }>> {
    const sessionString = await this.telegramClientService.verifySessionAuth(
      dto.phoneNumber,
      dto.phoneCode,
      dto.password,
    );

    if (!sessionString) {
      return { success: false, error: 'Xác nhận OTP thất bại. Kiểm tra lại mã OTP hoặc gọi /telegram/session/start lại.' };
    }

    return {
      success: true,
      data: { sessionString },
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

  @Delete('members/remove')
  @ApiOperation({
    summary: 'Xóa thành viên khỏi group — KHÔNG cấm join lại (ban + unban ngay)',
    description: 'Logic: banChatMember() → unbanChatMember() ngay lập tức. User bị xóa nhưng vẫn có thể join lại qua link mời. Khác với kick (ban vĩnh viễn).',
  })
  async removeMember(
    @Body() dto: MemberActionDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.removeMember(dto.chatId, dto.userId);
    return {
      success: result,
      message: result ? 'Đã xóa user khỏi group (không cấm join lại)' : 'Xóa thất bại (bot cần quyền admin)',
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

  @Post('members/restrict')
  @ApiOperation({
    summary: 'Giới hạn quyền thành viên (mute/restrict)',
    description: 'Truyền tất cả permissions = false để mute hoàn toàn. Truyền tất cả = true để khôi phục quyền.',
  })
  async restrictMember(
    @Body() dto: RestrictMemberDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.restrictMember(
      dto.chatId,
      dto.userId,
      {
        can_send_messages: dto.canSendMessages,
        can_send_media_messages: dto.canSendMediaMessages,
        can_send_polls: dto.canSendPolls,
        can_send_other_messages: dto.canSendOtherMessages,
        can_add_web_page_previews: dto.canAddWebPagePreviews,
        can_change_info: dto.canChangeInfo,
        can_invite_users: dto.canInviteUsers,
        can_pin_messages: dto.canPinMessages,
      },
      dto.untilDate,
    );
    return {
      success: result,
      message: result ? 'Đã restrict thành viên' : 'Restrict thất bại',
    };
  }

  @Post('members/promote')
  @ApiOperation({
    summary: 'Phong hoặc hạ quyền Admin cho thành viên',
    description: 'Truyền tất cả rights = true để phong full admin. Truyền tất cả = false để hạ quyền.',
  })
  async promoteMember(
    @Body() dto: PromoteMemberDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.promoteMember(
      dto.chatId,
      dto.userId,
      {
        can_change_info: dto.canChangeInfo,
        can_post_messages: dto.canPostMessages,
        can_edit_messages: dto.canEditMessages,
        can_delete_messages: dto.canDeleteMessages,
        can_invite_users: dto.canInviteUsers,
        can_restrict_members: dto.canRestrictMembers,
        can_pin_messages: dto.canPinMessages,
        can_promote_members: dto.canPromoteMembers,
        can_manage_video_chats: dto.canManageVideoChats,
        can_manage_chat: dto.canManageChat,
      },
    );
    return {
      success: result,
      message: result ? 'Đã cập nhật quyền admin' : 'Cập nhật quyền thất bại',
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

  @Get('chats/:chatId/admins')
  @ApiOperation({ summary: 'Lấy danh sách admin của group/supergroup' })
  async getChatAdministrators(
    @Param('chatId') chatId: string,
  ): Promise<ApiResponse<Record<string, unknown>[]>> {
    try {
      const admins = await this.telegramService.getChatAdministrators(chatId);
      return { success: true, data: admins };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  // ================================================================
  // GROUP PHOTO
  // ================================================================

  @Patch('groups/photo')
  @ApiOperation({ summary: 'Đặt ảnh đại diện cho group (bot phải là admin)' })
  async setChatPhoto(
    @Body() dto: SetChatPhotoDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.setChatPhoto(dto.chatId, dto.photoUrl);
    return {
      success: result,
      message: result ? 'Đã đặt ảnh đại diện group' : 'Đặt ảnh thất bại',
    };
  }

  @Delete('groups/photo')
  @ApiOperation({ summary: 'Xóa ảnh đại diện group' })
  async deleteChatPhoto(
    @Body() dto: ChatIdDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.deleteChatPhoto(dto.chatId);
    return {
      success: result,
      message: result ? 'Đã xóa ảnh đại diện group' : 'Xóa ảnh thất bại',
    };
  }

  // ================================================================
  // MTPROTO — REMOVE MEMBER / GET MEMBERS / SET ABOUT
  // ================================================================

  @Delete('groups/mtproto/remove-member')
  @ApiOperation({
    summary: '(MTProto) Xóa thành viên khỏi Group — KHÔNG cấm join lại',
    description: 'Xóa user khỏi group qua MTProto UserBot. Hỗ trợ cả Basic Group và Supergroup. User vẫn có thể join lại qua link mời.',
  })
  async removeMemberMtproto(
    @Body() dto: RemoveMemberDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.removeMemberFromGroup(dto.chatId, dto.userId);
    return {
      success: result,
      message: result ? `Đã xóa user ${dto.userId} khỏi group (không cấm join lại)` : 'Xóa thành viên thất bại',
    };
  }

  @Get('groups/mtproto/:chatId/members')
  @ApiOperation({
    summary: '(MTProto) Lấy danh sách thành viên trong Group',
    description: 'Chỉ hỗ trợ Supergroup/Channel. Basic Group cần migrate lên Supergroup.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số thành viên tối đa (mặc định 200)' })
  async getGroupMembers(
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<Record<string, unknown>[] | null>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const members = await this.telegramClientService.getGroupMembers(
      chatId,
      limit ? parseInt(limit, 10) : 200,
    );
    if (!members) {
      return { success: false, error: 'Không thể lấy danh sách thành viên. Kiểm tra ID group và quyền.' };
    }
    return { success: true, data: members };
  }

  @Patch('groups/mtproto/about')
  @ApiOperation({
    summary: '(MTProto) Đổi mô tả (about) Group',
    description: 'Đổi mô tả/description cho Group qua MTProto. Hỗ trợ cả Basic Group và Supergroup.',
  })
  async setGroupAboutMtproto(
    @Body() dto: SetGroupAboutDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }

    const result = await this.telegramClientService.setGroupAbout(dto.chatId, dto.about);
    return {
      success: result,
      message: result ? 'Đã đổi mô tả group' : 'Đổi mô tả thất bại',
    };
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

  @Post('messages/unpin-all')
  @ApiOperation({ summary: 'Bỏ ghim TẤT CẢ tin nhắn trong chat' })
  async unpinAllMessages(
    @Body() dto: ChatIdDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.unpinAllMessages(dto.chatId);
    return {
      success: result,
      message: result ? 'Đã bỏ ghim tất cả tin nhắn' : 'Bỏ ghim thất bại',
    };
  }

  @Post('messages/forward')
  @ApiOperation({
    summary: 'Chuyển tiếp tin nhắn sang chat khác',
    description: 'Tin nhắn forward sẽ hiển thị "Forwarded from ..." ở phía người nhận.',
  })
  async forwardMessage(
    @Body() dto: ForwardMessageDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.forwardMessage(
      dto.chatId,
      dto.fromChatId,
      dto.messageId,
    );
    return {
      success: result,
      message: result ? 'Đã forward tin nhắn' : 'Forward thất bại',
    };
  }

  @Post('messages/copy')
  @ApiOperation({
    summary: 'Sao chép tin nhắn sang chat khác (không hiện "Forwarded from")',
    description: 'Giống forward nhưng tin nhắn mới trông như tin nhắn bình thường, không ghi nguồn.',
  })
  async copyMessage(
    @Body() dto: CopyMessageDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.copyMessage(
      dto.chatId,
      dto.fromChatId,
      dto.messageId,
      dto.caption,
    );
    return {
      success: result,
      message: result ? 'Đã copy tin nhắn' : 'Copy thất bại',
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
  // SEND — VIDEO
  // ================================================================

  @Post('send-video')
  @ApiOperation({ summary: 'Gửi video qua Telegram' })
  async sendVideo(
    @Body() dto: SendTelegramVideoDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.sendVideo(
      dto.chatId,
      dto.videoUrl,
      dto.caption,
    );
    return {
      success: result,
      message: result ? 'Đã gửi video' : 'Gửi video thất bại',
    };
  }

  // ================================================================
  // SEND — STICKER
  // ================================================================

  @Post('send-sticker')
  @ApiOperation({ summary: 'Gửi sticker qua Telegram' })
  async sendSticker(
    @Body() dto: SendTelegramStickerDto,
  ): Promise<ApiResponse> {
    const result = await this.telegramService.sendSticker(dto.chatId, dto.sticker);
    return {
      success: result,
      message: result ? 'Đã gửi sticker' : 'Gửi sticker thất bại',
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

  // ================================================================
  // MTPROTO — GROUP INFO & SETTINGS
  // ================================================================

  @Get('groups/mtproto/:chatId/info')
  @ApiOperation({ summary: '(MTProto) Lấy thông tin chi tiết Group' })
  async getGroupInfoMtproto(
    @Param('chatId') chatId: string,
  ): Promise<ApiResponse<Record<string, unknown> | null>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const data = await this.telegramClientService.getGroupInfo(chatId);
    return data ? { success: true, data } : { success: false, error: 'Không thể lấy thông tin group.' };
  }

  @Patch('groups/mtproto/photo')
  @ApiOperation({ summary: '(MTProto) Đặt ảnh đại diện Group' })
  async setGroupPhotoMtproto(
    @Body() dto: MtprotoSetGroupPhotoDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.setGroupPhoto(dto.chatId, dto.photoUrl);
    return { success: result, message: result ? 'Đã đặt ảnh group' : 'Đặt ảnh thất bại' };
  }

  @Delete('groups/mtproto/photo/:chatId')
  @ApiOperation({ summary: '(MTProto) Xóa ảnh đại diện Group' })
  async deleteGroupPhotoMtproto(
    @Param('chatId') chatId: string,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.deleteGroupPhoto(chatId);
    return { success: result, message: result ? 'Đã xóa ảnh group' : 'Xóa ảnh thất bại' };
  }

  @Post('groups/mtproto/migrate/:chatId')
  @ApiOperation({
    summary: '(MTProto) Nâng cấp Basic Group → Supergroup',
    description: 'Migrate basic group thành supergroup. Group cũ sẽ bị thay thế — ID mới sẽ khác.',
  })
  async migrateToSupergroup(
    @Param('chatId') chatId: string,
  ): Promise<ApiResponse<{ newChatId: string } | null>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const newChatId = await this.telegramClientService.migrateToSupergroup(chatId);
    return newChatId
      ? { success: true, data: { newChatId } }
      : { success: false, error: 'Migrate thất bại. Group có thể đã là Supergroup.' };
  }

  @Patch('groups/mtproto/username')
  @ApiOperation({
    summary: '(MTProto) Đặt/xóa username công khai cho Supergroup',
    description: 'Truyền username rỗng "" để chuyển group về private.',
  })
  async setGroupUsernameMtproto(
    @Body() dto: SetGroupUsernameDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.setGroupUsername(dto.chatId, dto.username);
    return { success: result, message: result ? 'Đã đặt username group' : 'Đặt username thất bại' };
  }

  @Patch('groups/mtproto/slow-mode')
  @ApiOperation({
    summary: '(MTProto) Bật/tắt Slow Mode',
    description: 'Giá trị hợp lệ: 0 (tắt), 10, 30, 60, 300, 900, 3600 giây.',
  })
  async toggleSlowModeMtproto(
    @Body() dto: ToggleSlowModeDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.toggleSlowMode(dto.chatId, dto.seconds);
    return { success: result, message: result ? `Slow Mode: ${dto.seconds === 0 ? 'TẮT' : dto.seconds + 's'}` : 'Thay đổi Slow Mode thất bại' };
  }

  // ================================================================
  // MTPROTO — MESSAGES
  // ================================================================

  @Post('messages/mtproto/send')
  @ApiOperation({
    summary: '(MTProto) Gửi tin nhắn text từ UserBot',
    description: 'Tin nhắn sẽ hiển thị từ tài khoản UserBot, KHÔNG phải bot.',
  })
  async sendMessageMtproto(
    @Body() dto: MtprotoSendMessageDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.sendMessage(dto.chatId, dto.message);
    return { success: result, message: result ? 'UserBot đã gửi tin nhắn' : 'Gửi thất bại' };
  }

  @Post('messages/mtproto/send-media')
  @ApiOperation({
    summary: '(MTProto) Gửi media từ UserBot',
    description: 'Hỗ trợ ảnh/video/tài liệu. GramJS tự nhận diện loại file.',
  })
  async sendMediaMtproto(
    @Body() dto: MtprotoSendMediaDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.sendMedia(dto.chatId, dto.mediaUrl, dto.caption);
    return { success: result, message: result ? 'UserBot đã gửi media' : 'Gửi media thất bại' };
  }

  @Delete('messages/mtproto/delete')
  @ApiOperation({
    summary: '(MTProto) Xóa tin nhắn qua UserBot',
    description: 'Xóa cho tất cả mọi người. UserBot có thể xóa tin nhắn của mình hoặc người khác (nếu là admin).',
  })
  async deleteMessagesMtproto(
    @Body() dto: MtprotoDeleteMessagesDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.deleteMessages(dto.chatId, dto.messageIds);
    return { success: result, message: result ? `Đã xóa ${dto.messageIds.length} tin nhắn` : 'Xóa thất bại' };
  }

  @Post('messages/mtproto/pin')
  @ApiOperation({ summary: '(MTProto) Ghim tin nhắn qua UserBot' })
  async pinMessageMtproto(
    @Body() dto: MtprotoPinMessageDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.pinMessage(dto.chatId, dto.messageId, dto.silent);
    return { success: result, message: result ? 'Đã ghim tin nhắn' : 'Ghim thất bại' };
  }

  @Post('messages/mtproto/unpin')
  @ApiOperation({ summary: '(MTProto) Bỏ ghim tin nhắn qua UserBot' })
  async unpinMessageMtproto(
    @Body() dto: MtprotoPinMessageDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.unpinMessage(dto.chatId, dto.messageId);
    return { success: result, message: result ? 'Đã bỏ ghim tin nhắn' : 'Bỏ ghim thất bại' };
  }

  @Post('messages/mtproto/history')
  @ApiOperation({
    summary: '(MTProto) Lấy lịch sử tin nhắn',
    description: 'Chức năng ĐỘC QUYỀN MTProto — Bot API không hỗ trợ lấy lịch sử tin nhắn.',
  })
  async getMessageHistoryMtproto(
    @Body() dto: MtprotoGetHistoryDto,
  ): Promise<ApiResponse<Array<Record<string, unknown>> | null>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const data = await this.telegramClientService.getMessageHistory(dto.chatId, dto.limit, dto.offsetId);
    return data ? { success: true, data } : { success: false, error: 'Không thể lấy lịch sử tin nhắn.' };
  }

  @Post('messages/mtproto/search')
  @ApiOperation({
    summary: '(MTProto) Tìm kiếm tin nhắn trong chat',
    description: 'Chức năng ĐỘC QUYỀN MTProto — Bot API không hỗ trợ tìm kiếm tin nhắn.',
  })
  async searchMessagesMtproto(
    @Body() dto: MtprotoSearchMessagesDto,
  ): Promise<ApiResponse<Array<Record<string, unknown>> | null>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const data = await this.telegramClientService.searchMessages(dto.chatId, dto.query, dto.limit);
    return data ? { success: true, data } : { success: false, error: 'Tìm kiếm thất bại.' };
  }

  @Post('messages/mtproto/forward')
  @ApiOperation({ summary: '(MTProto) Chuyển tiếp tin nhắn qua UserBot' })
  async forwardMessagesMtproto(
    @Body() dto: MtprotoForwardMessagesDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.forwardMessages(dto.fromChatId, dto.toChatId, dto.messageIds);
    return { success: result, message: result ? `Forward ${dto.messageIds.length} tin nhắn thành công` : 'Forward thất bại' };
  }

  // ================================================================
  // MTPROTO — USER & MEMBER
  // ================================================================

  @Get('users/mtproto/:userId/info')
  @ApiOperation({
    summary: '(MTProto) Lấy thông tin chi tiết user bất kỳ',
    description: 'MTProto có thể lấy info bất kỳ user — không cần user đã interact với bot.',
  })
  async getUserInfoMtproto(
    @Param('userId') userId: string,
  ): Promise<ApiResponse<Record<string, unknown> | null>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const data = await this.telegramClientService.getUserInfo(userId);
    return data ? { success: true, data } : { success: false, error: 'Không thể lấy thông tin user.' };
  }

  @Post('members/mtproto/restrict')
  @ApiOperation({
    summary: '(MTProto) Hạn chế quyền thành viên trong Supergroup',
    description: 'Dùng channels.EditBanned với ChatBannedRights tùy chỉnh.',
  })
  async restrictMemberMtproto(
    @Body() dto: MtprotoRestrictMemberDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.restrictMember(
      dto.chatId, dto.userId,
      { sendMessages: dto.sendMessages, sendMedia: dto.sendMedia, sendStickers: dto.sendStickers, embedLinks: dto.embedLinks },
      dto.untilDate,
    );
    return { success: result, message: result ? 'Đã restrict thành viên' : 'Restrict thất bại' };
  }

  @Post('members/mtproto/demote')
  @ApiOperation({
    summary: '(MTProto) Hạ quyền admin về member thường',
    description: 'Set tất cả adminRights = false.',
  })
  async demoteAdminMtproto(
    @Body() dto: RemoveMemberDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.demoteAdmin(dto.chatId, dto.userId);
    return { success: result, message: result ? 'Đã hạ quyền admin' : 'Hạ quyền thất bại' };
  }

  // ================================================================
  // MTPROTO — INVITE LINK & LEAVE
  // ================================================================

  @Post('groups/mtproto/invite-link/revoke')
  @ApiOperation({ summary: '(MTProto) Thu hồi invite link — link bị vô hiệu hóa' })
  async revokeInviteLinkMtproto(
    @Body() dto: RevokeInviteLinkDto,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.revokeInviteLink(dto.chatId, dto.link);
    return { success: result, message: result ? 'Đã thu hồi invite link' : 'Thu hồi thất bại' };
  }

  @Get('groups/mtproto/:chatId/invite-links')
  @ApiOperation({ summary: '(MTProto) Lấy tất cả invite links của Group' })
  async getAllInviteLinksMtproto(
    @Param('chatId') chatId: string,
  ): Promise<ApiResponse<Array<Record<string, unknown>> | null>> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const data = await this.telegramClientService.getAllInviteLinks(chatId);
    return data ? { success: true, data } : { success: false, error: 'Không thể lấy danh sách invite links.' };
  }

  @Post('groups/mtproto/leave/:chatId')
  @ApiOperation({
    summary: '(MTProto) UserBot rời khỏi Group',
    description: 'Hỗ trợ cả Basic Group và Supergroup/Channel.',
  })
  async leaveGroupMtproto(
    @Param('chatId') chatId: string,
  ): Promise<ApiResponse> {
    if (!this.telegramClientService.isReady) {
      return { success: false, error: 'UserBot MTProto chưa được cấu hình.' };
    }
    const result = await this.telegramClientService.leaveGroup(chatId);
    return { success: result, message: result ? 'Đã rời khỏi group' : 'Rời group thất bại' };
  }
}
