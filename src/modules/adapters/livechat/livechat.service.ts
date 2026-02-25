// src/modules/adapters/livechat/livechat.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * LivechatService - Quản lý API calls đến LiveChat
 * 
 * Authentication: Basic auth với base64 encoded token
 * API: https://api.livechatinc.com/v3.5/agent/action/{action}
 */
@Injectable()
export class LivechatService {
  private readonly logger = new Logger(LivechatService.name);
  private readonly accountId: string;
  private readonly entityId: string;
  private readonly token: string;
  private readonly base64Token: string;
  private readonly apiUrl = 'https://api.livechatinc.com/v3.5';

  constructor(private configService: ConfigService) {
    this.accountId = this.configService.get<string>('LIVECHAT_ACCOUNT_ID');
    this.entityId = this.configService.get<string>('LIVECHAT_ENTITY_ID');
    this.token = this.configService.get<string>('LIVECHAT_TOKEN');
    this.base64Token = this.configService.get<string>('LIVECHAT_BASE64_TOKEN');
  }

  // ============ HELPER ============

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Basic ${this.base64Token}`,
      'Content-Type': 'application/json',
    };
  }

  private async apiCall(action: string, body: any = {}): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/agent/action/${action}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        this.logger.error(`❌ API ${action}: ${JSON.stringify(data.error)}`);
      }

      return data;
    } catch (error) {
      this.logger.error(`❌ API ${action} failed: ${error.message}`);
      throw error;
    }
  }

  // ============ CONNECTION ============

  /**
   * Test kết nối API
   */
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await fetch(`${this.apiUrl}/agent/action/list_chats`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (response.ok && !data.error) {
        this.logger.log('✅ LiveChat connection successful!');
        return { success: true, message: 'Kết nối LiveChat thành công!', data };
      } else {
        const errorMsg = data.error?.message || 'Unknown error';
        this.logger.error(`❌ LiveChat connection failed: ${errorMsg}`);
        return { success: false, message: `Lỗi: ${errorMsg}`, data };
      }
    } catch (error) {
      this.logger.error(`❌ LiveChat connection test failed: ${error.message}`);
      return { success: false, message: `Lỗi kết nối: ${error.message}` };
    }
  }

  // ============ CHATS ============

  /**
   * Lấy danh sách chats đang hoạt động
   */
  async listChats(filters?: Record<string, any>): Promise<any> {
    return this.apiCall('list_chats', { filters });
  }

  /**
   * Lấy chi tiết một chat
   */
  async getChat(chatId: string, threadId?: string): Promise<any> {
    const body: any = { chat_id: chatId };
    if (threadId) body.thread_id = threadId;
    return this.apiCall('get_chat', body);
  }

  /**
   * Lấy danh sách archives (lịch sử chat)
   */
  async listArchives(filters?: Record<string, any>, pageId?: string): Promise<any> {
    const body: any = {};
    if (filters) body.filters = filters;
    if (pageId) body.page_id = pageId;
    return this.apiCall('list_archives', body);
  }

  /**
   * Bắt đầu chat mới
   */
  async startChat(users?: any[], thread?: any): Promise<any> {
    const body: any = {};
    if (users) body.users = users;
    if (thread) body.thread = thread;
    return this.apiCall('start_chat', body);
  }

  /**
   * Tiếp tục chat (resume)
   */
  async resumeChat(chatId: string, thread?: any): Promise<any> {
    const body: any = { chat: { id: chatId } };
    if (thread) body.chat.thread = thread;
    return this.apiCall('resume_chat', body);
  }

  /**
   * Deactivate (đóng) chat
   */
  async deactivateChat(chatId: string): Promise<any> {
    return this.apiCall('deactivate_chat', { id: chatId });
  }

  /**
   * Follow chat (nhận thông báo)
   */
  async followChat(chatId: string): Promise<any> {
    return this.apiCall('follow_chat', { id: chatId });
  }

  /**
   * Unfollow chat
   */
  async unfollowChat(chatId: string): Promise<any> {
    return this.apiCall('unfollow_chat', { id: chatId });
  }

  // ============ EVENTS & MESSAGES ============

  /**
   * Gửi tin nhắn text
   */
  async sendMessage(chatId: string, text: string): Promise<any> {
    return this.apiCall('send_event', {
      chat_id: chatId,
      event: {
        type: 'message',
        text: text,
      },
    });
  }

  /**
   * Gửi file
   */
  async sendFile(chatId: string, fileUrl: string, contentType: string, fileName: string): Promise<any> {
    return this.apiCall('send_event', {
      chat_id: chatId,
      event: {
        type: 'file',
        url: fileUrl,
        content_type: contentType,
        name: fileName,
      },
    });
  }

  /**
   * Gửi rich message (card, buttons, etc.)
   */
  async sendRichMessage(chatId: string, richMessage: any): Promise<any> {
    return this.apiCall('send_event', {
      chat_id: chatId,
      event: {
        type: 'rich_message',
        ...richMessage,
      },
    });
  }

  /**
   * Gửi system message
   */
  async sendSystemMessage(chatId: string, text: string): Promise<any> {
    return this.apiCall('send_event', {
      chat_id: chatId,
      event: {
        type: 'system_message',
        text: text,
      },
    });
  }

  /**
   * Lấy danh sách threads của chat
   */
  async listThreads(chatId: string, sortOrder?: string, pageId?: string): Promise<any> {
    const body: any = { chat_id: chatId };
    if (sortOrder) body.sort_order = sortOrder;
    if (pageId) body.page_id = pageId;
    return this.apiCall('list_threads', body);
  }

  // ============ AGENT STATUS ============

  /**
   * Cập nhật trạng thái routing
   */
  async setRoutingStatus(status: 'accepting_chats' | 'not_accepting_chats' | 'offline'): Promise<any> {
    const result = await this.apiCall('set_routing_status', { status });
    this.logger.log(`🔄 Agent status: ${status}`);
    return result;
  }

  /**
   * Lấy trạng thái routing hiện tại
   */
  async getRoutingStatus(agentId?: string): Promise<any> {
    const body: any = {};
    if (agentId) body.agent_id = agentId;
    return this.apiCall('get_routing_status', body);
  }

  // ============ CUSTOMERS ============

  /**
   * Lấy thông tin customer
   */
  async getCustomer(customerId: string): Promise<any> {
    return this.apiCall('get_customer', { id: customerId });
  }

  /**
   * Lấy danh sách customers
   */
  async listCustomers(pageId?: string, limit?: number, filters?: any): Promise<any> {
    const body: any = {};
    if (pageId) body.page_id = pageId;
    if (limit) body.limit = limit;
    if (filters) body.filters = filters;
    return this.apiCall('list_customers', body);
  }

  /**
   * Cập nhật thông tin customer
   */
  async updateCustomer(customerId: string, name?: string, email?: string, props?: Record<string, string>): Promise<any> {
    const body: any = { id: customerId };
    if (name) body.name = name;
    if (email) body.email = email;
    if (props) body.session_fields = Object.entries(props).map(([key, value]) => ({ [key]: value }));
    return this.apiCall('update_customer', body);
  }

  /**
   * Ban customer
   */
  async banCustomer(customerId: string, days: number): Promise<any> {
    return this.apiCall('ban_customer', {
      id: customerId,
      ban: { days },
    });
  }

  // ============ AGENTS ============

  /**
   * Lấy danh sách agents
   */
  async listAgents(): Promise<any> {
    return this.apiCall('list_agents', {});
  }

  // ============ CANNED RESPONSES ============

  /**
   * Lấy danh sách canned responses
   */
  async listCannedResponses(groupId = 0): Promise<any> {
    return this.apiCall('list_canned_responses', { group_id: groupId });
  }

  // ============ TAGS ============

  /**
   * Gắn tag cho chat
   */
  async tagChat(chatId: string, tag: string): Promise<any> {
    return this.apiCall('tag_thread', { chat_id: chatId, tag });
  }

  /**
   * Gỡ tag của chat
   */
  async untagChat(chatId: string, tag: string): Promise<any> {
    return this.apiCall('untag_thread', { chat_id: chatId, tag });
  }

  /**
   * Lấy danh sách tags
   */
  async listTags(groupId = 0): Promise<any> {
    return this.apiCall('list_tags', { group_id: groupId });
  }

  // ============ TRANSFER ============

  /**
   * Chuyển chat sang agent khác
   */
  async transferChat(chatId: string, targetAgentIds: string[], force = false): Promise<any> {
    return this.apiCall('transfer_chat', {
      id: chatId,
      target: {
        ids: targetAgentIds,
      },
      force,
    });
  }

  // ============ TYPING INDICATOR ============

  /**
   * Gửi typing indicator
   */
  async sendTypingIndicator(chatId: string, isTyping: boolean): Promise<any> {
    return this.apiCall('send_typing_indicator', {
      chat_id: chatId,
      is_typing: isTyping,
    });
  }

  // ============ WEBHOOKS ============

  /**
   * Đăng ký webhook
   */
  async registerWebhook(
    url: string,
    action: string,
    secretKey: string,
    additionalData?: string[],
  ): Promise<any> {
    const body: any = {
      url,
      action,
      secret_key: secretKey,
    };
    if (additionalData) body.additional_data = additionalData;
    return this.apiCall('register_webhook', body);
  }

  /**
   * Lấy danh sách webhooks đã đăng ký
   */
  async listWebhooks(): Promise<any> {
    return this.apiCall('list_webhooks', {});
  }

  /**
   * Xóa webhook
   */
  async unregisterWebhook(webhookId: string): Promise<any> {
    return this.apiCall('unregister_webhook', { id: webhookId });
  }

  // ============ PROPERTIES ============

  /**
   * Cập nhật properties của chat
   */
  async updateChatProperties(chatId: string, properties: Record<string, any>): Promise<any> {
    return this.apiCall('update_chat_properties', {
      id: chatId,
      properties,
    });
  }

  /**
   * Lấy properties của chat
   */
  async getChatProperties(chatId: string): Promise<any> {
    const chat = await this.getChat(chatId);
    return chat?.properties || {};
  }

  // ============ GROUPS ============

  /**
   * Lấy danh sách groups
   */
  async listGroups(): Promise<any> {
    return this.apiCall('list_groups', {});
  }
}