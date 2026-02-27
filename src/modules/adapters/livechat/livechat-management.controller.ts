// src/modules/adapters/livechat/livechat-management.controller.ts
// Controller quản lý LiveChat: chats, messages, agents, customers, tags, webhooks, groups
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { LivechatApiService } from './livechat-api.service';
import {
  SendLivechatMessageDto,
  SendLivechatFileDto,
  SendLivechatRichMessageDto,
  SendLivechatSystemMessageDto,
  StartChatDto,
  SetAgentStatusDto,
  UpdateCustomerDto,
  BanCustomerDto,
  TagDto,
  TransferChatDto,
  RegisterWebhookDto,
} from './dto/livechat.dto';

@ApiTags('LiveChat Management')
@Controller('livechat')
export class LivechatManagementController {
  private readonly logger = new Logger(LivechatManagementController.name);

  constructor(private readonly livechatApi: LivechatApiService) {}

  // ============ CONNECTION ============

  @Get('test')
  @ApiOperation({ summary: 'Test kết nối LiveChat API' })
  async testConnection() {
    return this.livechatApi.testConnection();
  }

  // ============ CHATS ============

  @Get('chats')
  @ApiOperation({ summary: 'Lấy danh sách chats đang hoạt động' })
  async listChats() {
    return this.livechatApi.listChats();
  }

  @Get('chat/:chatId')
  @ApiOperation({ summary: 'Lấy chi tiết một chat' })
  @ApiParam({ name: 'chatId', description: 'ID của chat' })
  async getChat(@Param('chatId') chatId: string) {
    return this.livechatApi.getChat(chatId);
  }

  @Get('archives')
  @ApiOperation({ summary: 'Lấy lịch sử chats (archives)' })
  async listArchives() {
    return this.livechatApi.listArchives();
  }

  @Get('chat/:chatId/threads')
  @ApiOperation({ summary: 'Lấy danh sách threads của chat' })
  @ApiParam({ name: 'chatId', description: 'ID của chat' })
  async listThreads(@Param('chatId') chatId: string) {
    return this.livechatApi.listThreads(chatId);
  }

  @Post('chat/start')
  @ApiOperation({ summary: 'Bắt đầu chat mới' })
  async startChat(@Body() body: StartChatDto) {
    return this.livechatApi.startChat(body.users, body.thread);
  }

  @Post('chat/:chatId/resume')
  @ApiOperation({ summary: 'Tiếp tục (resume) chat' })
  @ApiParam({ name: 'chatId', description: 'ID của chat' })
  async resumeChat(@Param('chatId') chatId: string) {
    return this.livechatApi.resumeChat(chatId);
  }

  @Post('chat/:chatId/deactivate')
  @ApiOperation({ summary: 'Đóng (deactivate) chat' })
  @ApiParam({ name: 'chatId', description: 'ID của chat' })
  async deactivateChat(@Param('chatId') chatId: string) {
    return this.livechatApi.deactivateChat(chatId);
  }

  @Post('chat/:chatId/follow')
  @ApiOperation({ summary: 'Follow chat (nhận thông báo)' })
  async followChat(@Param('chatId') chatId: string) {
    return this.livechatApi.followChat(chatId);
  }

  @Post('chat/:chatId/unfollow')
  @ApiOperation({ summary: 'Unfollow chat' })
  async unfollowChat(@Param('chatId') chatId: string) {
    return this.livechatApi.unfollowChat(chatId);
  }

  // ============ MESSAGES ============

  @Post('send')
  @ApiOperation({ summary: 'Gửi tin nhắn text đến chat' })
  async sendMessage(@Body() body: SendLivechatMessageDto) {
    return this.livechatApi.sendMessage(body.chatId, body.message);
  }

  @Post('send-file')
  @ApiOperation({ summary: 'Gửi file đến chat' })
  async sendFile(@Body() body: SendLivechatFileDto) {
    return this.livechatApi.sendFile(
      body.chatId,
      body.fileUrl,
      body.contentType,
      body.fileName,
    );
  }

  @Post('send-rich-message')
  @ApiOperation({ summary: 'Gửi rich message (card, buttons)' })
  async sendRichMessage(@Body() body: SendLivechatRichMessageDto) {
    return this.livechatApi.sendRichMessage(body.chatId, body.richMessage);
  }

  @Post('send-system-message')
  @ApiOperation({ summary: 'Gửi system message' })
  async sendSystemMessage(@Body() body: SendLivechatSystemMessageDto) {
    return this.livechatApi.sendSystemMessage(body.chatId, body.text);
  }

  // ============ AGENT STATUS ============

  @Post('status')
  @ApiOperation({ summary: 'Cập nhật trạng thái agent' })
  async setStatus(@Body() body: SetAgentStatusDto) {
    return this.livechatApi.setRoutingStatus(body.status);
  }

  @Get('status')
  @ApiOperation({ summary: 'Lấy trạng thái agent hiện tại' })
  async getStatus(@Query('agentId') agentId?: string) {
    return this.livechatApi.getRoutingStatus(agentId);
  }

  // ============ CUSTOMERS ============

  @Get('customers')
  @ApiOperation({ summary: 'Lấy danh sách customers' })
  async listCustomers() {
    return this.livechatApi.listCustomers();
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Lấy thông tin customer' })
  @ApiParam({ name: 'customerId', description: 'ID của customer' })
  async getCustomer(@Param('customerId') customerId: string) {
    return this.livechatApi.getCustomer(customerId);
  }

  @Post('customer/:customerId/update')
  @ApiOperation({ summary: 'Cập nhật thông tin customer' })
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() body: UpdateCustomerDto,
  ) {
    return this.livechatApi.updateCustomer(customerId, body.name, body.email);
  }

  @Post('customer/:customerId/ban')
  @ApiOperation({ summary: 'Ban customer' })
  async banCustomer(
    @Param('customerId') customerId: string,
    @Body() body: BanCustomerDto,
  ) {
    return this.livechatApi.banCustomer(customerId, body.days);
  }

  // ============ AGENTS ============

  @Get('agents')
  @ApiOperation({ summary: 'Lấy danh sách agents' })
  async listAgents() {
    return this.livechatApi.listAgents();
  }

  // ============ TAGS ============

  @Get('tags')
  @ApiOperation({ summary: 'Lấy danh sách tags' })
  async listTags(@Query('groupId') groupId?: number) {
    return this.livechatApi.listTags(groupId || 0);
  }

  @Post('chat/:chatId/tag')
  @ApiOperation({ summary: 'Gắn tag cho chat' })
  async tagChat(@Param('chatId') chatId: string, @Body() body: TagDto) {
    return this.livechatApi.tagChat(chatId, body.tag);
  }

  @Post('chat/:chatId/untag')
  @ApiOperation({ summary: 'Gỡ tag của chat' })
  async untagChat(@Param('chatId') chatId: string, @Body() body: TagDto) {
    return this.livechatApi.untagChat(chatId, body.tag);
  }

  // ============ TRANSFER ============

  @Post('chat/:chatId/transfer')
  @ApiOperation({ summary: 'Chuyển chat sang agent khác' })
  async transferChat(
    @Param('chatId') chatId: string,
    @Body() body: TransferChatDto,
  ) {
    return this.livechatApi.transferChat(
      chatId,
      body.targetAgentIds,
      body.force,
    );
  }

  // ============ CANNED RESPONSES ============

  @Get('canned-responses')
  @ApiOperation({ summary: 'Lấy danh sách canned responses' })
  async listCannedResponses(@Query('groupId') groupId?: number) {
    return this.livechatApi.listCannedResponses(groupId || 0);
  }

  // ============ GROUPS ============

  @Get('groups')
  @ApiOperation({ summary: 'Lấy danh sách groups' })
  async listGroups() {
    return this.livechatApi.listGroups();
  }

  // ============ WEBHOOKS ============

  @Get('webhooks')
  @ApiOperation({ summary: 'Lấy danh sách webhooks' })
  async listWebhooks() {
    return this.livechatApi.listWebhooks();
  }

  @Post('webhook/register')
  @ApiOperation({ summary: 'Đăng ký webhook mới' })
  async registerWebhook(@Body() body: RegisterWebhookDto) {
    return this.livechatApi.registerWebhook(
      body.url,
      body.action,
      body.secretKey,
      body.ownerClientId,
      body.type || 'license',
    );
  }

  @Post('webhook/:webhookId/unregister')
  @ApiOperation({ summary: 'Xóa webhook' })
  async unregisterWebhook(@Param('webhookId') webhookId: string) {
    return this.livechatApi.unregisterWebhook(webhookId);
  }
}
