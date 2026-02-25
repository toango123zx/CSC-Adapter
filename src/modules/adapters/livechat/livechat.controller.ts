// src/modules/adapters/livechat/livechat.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { LivechatService } from './livechat.service';

@ApiTags('LiveChat API')
@Controller('livechat')
export class LivechatController {
  constructor(private readonly livechatService: LivechatService) {}

  // ============ CONNECTION ============

  @Get('test')
  @ApiOperation({ summary: 'Test kết nối LiveChat API' })
  async testConnection() {
    return this.livechatService.testConnection();
  }

  // ============ CHATS ============

  @Get('chats')
  @ApiOperation({ summary: 'Lấy danh sách chats đang hoạt động' })
  async listChats() {
    return this.livechatService.listChats();
  }

  @Get('chat/:chatId')
  @ApiOperation({ summary: 'Lấy chi tiết một chat' })
  @ApiParam({ name: 'chatId', description: 'ID của chat' })
  async getChat(@Param('chatId') chatId: string) {
    return this.livechatService.getChat(chatId);
  }

  @Get('archives')
  @ApiOperation({ summary: 'Lấy lịch sử chats (archives)' })
  async listArchives() {
    return this.livechatService.listArchives();
  }

  @Get('chat/:chatId/threads')
  @ApiOperation({ summary: 'Lấy danh sách threads của chat' })
  @ApiParam({ name: 'chatId', description: 'ID của chat' })
  async listThreads(@Param('chatId') chatId: string) {
    return this.livechatService.listThreads(chatId);
  }

  @Post('chat/start')
  @ApiOperation({ summary: 'Bắt đầu chat mới' })
  async startChat(@Body() body: { users?: any[]; thread?: any }) {
    return this.livechatService.startChat(body.users, body.thread);
  }

  @Post('chat/:chatId/resume')
  @ApiOperation({ summary: 'Tiếp tục (resume) chat' })
  @ApiParam({ name: 'chatId', description: 'ID của chat' })
  async resumeChat(@Param('chatId') chatId: string) {
    return this.livechatService.resumeChat(chatId);
  }

  @Post('chat/:chatId/deactivate')
  @ApiOperation({ summary: 'Đóng (deactivate) chat' })
  @ApiParam({ name: 'chatId', description: 'ID của chat' })
  async deactivateChat(@Param('chatId') chatId: string) {
    return this.livechatService.deactivateChat(chatId);
  }

  @Post('chat/:chatId/follow')
  @ApiOperation({ summary: 'Follow chat (nhận thông báo)' })
  async followChat(@Param('chatId') chatId: string) {
    return this.livechatService.followChat(chatId);
  }

  @Post('chat/:chatId/unfollow')
  @ApiOperation({ summary: 'Unfollow chat' })
  async unfollowChat(@Param('chatId') chatId: string) {
    return this.livechatService.unfollowChat(chatId);
  }

  // ============ MESSAGES ============

  @Post('send')
  @ApiOperation({ summary: 'Gửi tin nhắn text đến chat' })
  async sendMessage(@Body() body: { chatId: string; message: string }) {
    return this.livechatService.sendMessage(body.chatId, body.message);
  }

  @Post('send-file')
  @ApiOperation({ summary: 'Gửi file đến chat' })
  async sendFile(@Body() body: { chatId: string; fileUrl: string; contentType: string; fileName: string }) {
    return this.livechatService.sendFile(body.chatId, body.fileUrl, body.contentType, body.fileName);
  }

  @Post('send-rich-message')
  @ApiOperation({ summary: 'Gửi rich message (card, buttons)' })
  async sendRichMessage(@Body() body: { chatId: string; richMessage: any }) {
    return this.livechatService.sendRichMessage(body.chatId, body.richMessage);
  }

  @Post('send-system-message')
  @ApiOperation({ summary: 'Gửi system message' })
  async sendSystemMessage(@Body() body: { chatId: string; text: string }) {
    return this.livechatService.sendSystemMessage(body.chatId, body.text);
  }

  // ============ AGENT STATUS ============

  @Post('status')
  @ApiOperation({ summary: 'Cập nhật trạng thái agent' })
  async setStatus(@Body() body: { status: 'accepting_chats' | 'not_accepting_chats' | 'offline' }) {
    return this.livechatService.setRoutingStatus(body.status);
  }

  @Get('status')
  @ApiOperation({ summary: 'Lấy trạng thái agent hiện tại' })
  async getStatus(@Query('agentId') agentId?: string) {
    return this.livechatService.getRoutingStatus(agentId);
  }

  // ============ CUSTOMERS ============

  @Get('customers')
  @ApiOperation({ summary: 'Lấy danh sách customers' })
  async listCustomers() {
    return this.livechatService.listCustomers();
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Lấy thông tin customer' })
  @ApiParam({ name: 'customerId', description: 'ID của customer' })
  async getCustomer(@Param('customerId') customerId: string) {
    return this.livechatService.getCustomer(customerId);
  }

  @Post('customer/:customerId/update')
  @ApiOperation({ summary: 'Cập nhật thông tin customer' })
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() body: { name?: string; email?: string },
  ) {
    return this.livechatService.updateCustomer(customerId, body.name, body.email);
  }

  @Post('customer/:customerId/ban')
  @ApiOperation({ summary: 'Ban customer' })
  async banCustomer(
    @Param('customerId') customerId: string,
    @Body() body: { days: number },
  ) {
    return this.livechatService.banCustomer(customerId, body.days);
  }

  // ============ AGENTS ============

  @Get('agents')
  @ApiOperation({ summary: 'Lấy danh sách agents' })
  async listAgents() {
    return this.livechatService.listAgents();
  }

  // ============ TAGS ============

  @Get('tags')
  @ApiOperation({ summary: 'Lấy danh sách tags' })
  async listTags(@Query('groupId') groupId?: number) {
    return this.livechatService.listTags(groupId || 0);
  }

  @Post('chat/:chatId/tag')
  @ApiOperation({ summary: 'Gắn tag cho chat' })
  async tagChat(@Param('chatId') chatId: string, @Body() body: { tag: string }) {
    return this.livechatService.tagChat(chatId, body.tag);
  }

  @Post('chat/:chatId/untag')
  @ApiOperation({ summary: 'Gỡ tag của chat' })
  async untagChat(@Param('chatId') chatId: string, @Body() body: { tag: string }) {
    return this.livechatService.untagChat(chatId, body.tag);
  }

  // ============ TRANSFER ============

  @Post('chat/:chatId/transfer')
  @ApiOperation({ summary: 'Chuyển chat sang agent khác' })
  async transferChat(
    @Param('chatId') chatId: string,
    @Body() body: { targetAgentIds: string[]; force?: boolean },
  ) {
    return this.livechatService.transferChat(chatId, body.targetAgentIds, body.force);
  }

  // ============ CANNED RESPONSES ============

  @Get('canned-responses')
  @ApiOperation({ summary: 'Lấy danh sách canned responses' })
  async listCannedResponses(@Query('groupId') groupId?: number) {
    return this.livechatService.listCannedResponses(groupId || 0);
  }

  // ============ GROUPS ============

  @Get('groups')
  @ApiOperation({ summary: 'Lấy danh sách groups' })
  async listGroups() {
    return this.livechatService.listGroups();
  }

  // ============ WEBHOOKS ============

  @Get('webhooks')
  @ApiOperation({ summary: 'Lấy danh sách webhooks' })
  async listWebhooks() {
    return this.livechatService.listWebhooks();
  }

  @Post('webhook/register')
  @ApiOperation({ summary: 'Đăng ký webhook mới' })
  async registerWebhook(@Body() body: { url: string; action: string; secretKey: string }) {
    return this.livechatService.registerWebhook(body.url, body.action, body.secretKey);
  }

  @Post('webhook/:webhookId/unregister')
  @ApiOperation({ summary: 'Xóa webhook' })
  async unregisterWebhook(@Param('webhookId') webhookId: string) {
    return this.livechatService.unregisterWebhook(webhookId);
  }

  // ============ WEBHOOK RECEIVER ============

  @Post('webhook/incoming')
  @ApiOperation({ summary: 'Endpoint nhận webhook từ LiveChat (cấu hình URL này trên LiveChat)' })
  async receiveWebhook(@Body() payload: any) {
    // Log webhook đến
    console.log('📨 LiveChat Webhook received:', JSON.stringify(payload).substring(0, 500));
    return { success: true, received: true };
  }
}