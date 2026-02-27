// src/modules/adapters/livechat/livechat-api.service.ts
// HTTP Client cho LiveChat API - Chỉ lo giao tiếp với API bên ngoài
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LIVECHAT_API_BASE_URL,
  LivechatApiType,
} from 'src/common/constants/livechat.constants';
import {
  LivechatApiResponse,
  LivechatConnectionResult,
  AgentRoutingStatus,
} from './livechat-api.types';

@Injectable()
export class LivechatApiService {
  private readonly logger = new Logger(LivechatApiService.name);
  private readonly base64Token: string;

  constructor(private readonly configService: ConfigService) {
    this.base64Token = this.configService.get<string>(
      'LIVECHAT_BASE64_TOKEN',
      '',
    );
  }

  // ============ HELPER ============

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Basic ${this.base64Token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Gọi một action trên LiveChat API.
   * @param action - Tên action (ví dụ: 'list_chats', 'send_event')
   * @param body - Payload body
   * @param apiType - Loại API: 'agent' hoặc 'configuration'
   */
  async apiCall(
    action: string,
    body: Record<string, unknown> = {},
    apiType: LivechatApiType = LivechatApiType.AGENT,
  ): Promise<LivechatApiResponse> {
    try {
      const url = `${LIVECHAT_API_BASE_URL}/${apiType}/action/${action}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as LivechatApiResponse;

      if (data.error) {
        this.logger.error(`❌ API ${action}: ${JSON.stringify(data.error)}`);
      }

      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ API ${action} failed: ${message}`);
      throw error;
    }
  }

  // ============ CONNECTION ============

  async testConnection(): Promise<LivechatConnectionResult> {
    try {
      const data = await this.apiCall('list_chats');

      if (!data.error) {
        this.logger.log('✅ LiveChat connection successful!');
        return { success: true, message: 'Kết nối LiveChat thành công!', data };
      } else {
        const errorMsg = data.error.message || 'Unknown error';
        this.logger.error(`❌ LiveChat connection failed: ${errorMsg}`);
        return { success: false, message: `Lỗi: ${errorMsg}`, data };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ LiveChat connection test failed: ${message}`);
      return { success: false, message: `Lỗi kết nối: ${message}` };
    }
  }

  // ============ CHATS ============

  async listChats(
    filters?: Record<string, unknown>,
  ): Promise<LivechatApiResponse> {
    return this.apiCall('list_chats', { filters });
  }

  async getChat(
    chatId: string,
    threadId?: string,
  ): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = { chat_id: chatId };
    if (threadId) body['thread_id'] = threadId;
    return this.apiCall('get_chat', body);
  }

  async listArchives(
    filters?: Record<string, unknown>,
    pageId?: string,
  ): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = {};
    if (filters) body['filters'] = filters;
    if (pageId) body['page_id'] = pageId;
    return this.apiCall('list_archives', body);
  }

  async startChat(
    users?: Record<string, unknown>[],
    thread?: Record<string, unknown>,
  ): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = {};
    if (users) body['users'] = users;
    if (thread) body['thread'] = thread;
    return this.apiCall('start_chat', body);
  }

  async resumeChat(
    chatId: string,
    thread?: Record<string, unknown>,
  ): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = { chat: { id: chatId } };
    if (thread) {
      (body['chat'] as Record<string, unknown>)['thread'] = thread;
    }
    return this.apiCall('resume_chat', body);
  }

  async deactivateChat(chatId: string): Promise<LivechatApiResponse> {
    return this.apiCall('deactivate_chat', { id: chatId });
  }

  async followChat(chatId: string): Promise<LivechatApiResponse> {
    return this.apiCall('follow_chat', { id: chatId });
  }

  async unfollowChat(chatId: string): Promise<LivechatApiResponse> {
    return this.apiCall('unfollow_chat', { id: chatId });
  }

  // ============ EVENTS & MESSAGES ============

  async sendMessage(
    chatId: string,
    text: string,
  ): Promise<LivechatApiResponse> {
    return this.apiCall('send_event', {
      chat_id: chatId,
      event: { type: 'message', text },
    });
  }

  async sendFile(
    chatId: string,
    fileUrl: string,
    contentType: string,
    fileName: string,
  ): Promise<LivechatApiResponse> {
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

  async sendRichMessage(
    chatId: string,
    richMessage: Record<string, unknown>,
  ): Promise<LivechatApiResponse> {
    return this.apiCall('send_event', {
      chat_id: chatId,
      event: { type: 'rich_message', ...richMessage },
    });
  }

  async sendSystemMessage(
    chatId: string,
    text: string,
  ): Promise<LivechatApiResponse> {
    return this.apiCall('send_event', {
      chat_id: chatId,
      event: { type: 'system_message', text },
    });
  }

  async listThreads(
    chatId: string,
    sortOrder?: string,
    pageId?: string,
  ): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = { chat_id: chatId };
    if (sortOrder) body['sort_order'] = sortOrder;
    if (pageId) body['page_id'] = pageId;
    return this.apiCall('list_threads', body);
  }

  // ============ AGENT STATUS ============

  async setRoutingStatus(
    status: AgentRoutingStatus,
  ): Promise<LivechatApiResponse> {
    const result = await this.apiCall('set_routing_status', { status });
    this.logger.log(`🔄 Agent status: ${status}`);
    return result;
  }

  async getRoutingStatus(agentId?: string): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = {};
    if (agentId) body['agent_id'] = agentId;
    return this.apiCall('get_routing_status', body);
  }

  // ============ CUSTOMERS ============

  async getCustomer(customerId: string): Promise<LivechatApiResponse> {
    return this.apiCall('get_customer', { id: customerId });
  }

  async listCustomers(
    pageId?: string,
    limit?: number,
    filters?: Record<string, unknown>,
  ): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = {};
    if (pageId) body['page_id'] = pageId;
    if (limit) body['limit'] = limit;
    if (filters) body['filters'] = filters;
    return this.apiCall('list_customers', body);
  }

  async updateCustomer(
    customerId: string,
    name?: string,
    email?: string,
  ): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = { id: customerId };
    if (name) body['name'] = name;
    if (email) body['email'] = email;
    return this.apiCall('update_customer', body);
  }

  async banCustomer(
    customerId: string,
    days: number,
  ): Promise<LivechatApiResponse> {
    return this.apiCall('ban_customer', { id: customerId, ban: { days } });
  }

  // ============ AGENTS ============

  async listAgents(): Promise<LivechatApiResponse> {
    return this.apiCall('list_agents', {});
  }

  // ============ CANNED RESPONSES ============

  async listCannedResponses(groupId = 0): Promise<LivechatApiResponse> {
    return this.apiCall('list_canned_responses', { group_id: groupId });
  }

  // ============ TAGS ============

  async tagChat(chatId: string, tag: string): Promise<LivechatApiResponse> {
    return this.apiCall('tag_thread', { chat_id: chatId, tag });
  }

  async untagChat(chatId: string, tag: string): Promise<LivechatApiResponse> {
    return this.apiCall('untag_thread', { chat_id: chatId, tag });
  }

  async listTags(groupId = 0): Promise<LivechatApiResponse> {
    return this.apiCall('list_tags', { group_id: groupId });
  }

  // ============ TRANSFER ============

  async transferChat(
    chatId: string,
    targetAgentIds: string[],
    force = false,
  ): Promise<LivechatApiResponse> {
    return this.apiCall('transfer_chat', {
      id: chatId,
      target: { ids: targetAgentIds },
      force,
    });
  }

  // ============ TYPING INDICATOR ============

  async sendTypingIndicator(
    chatId: string,
    isTyping: boolean,
  ): Promise<LivechatApiResponse> {
    return this.apiCall('send_typing_indicator', {
      chat_id: chatId,
      is_typing: isTyping,
    });
  }

  // ============ WEBHOOKS (Configuration API) ============

  async registerWebhook(
    url: string,
    action: string,
    secretKey: string,
    ownerClientId: string,
    type: 'license' | 'bot' = 'license',
    additionalData?: string[],
  ): Promise<LivechatApiResponse> {
    const body: Record<string, unknown> = {
      url,
      action,
      secret_key: secretKey,
      owner_client_id: ownerClientId,
      type,
    };
    if (additionalData) body['additional_data'] = additionalData;
    return this.apiCall(
      'register_webhook',
      body,
      LivechatApiType.CONFIGURATION,
    );
  }

  async listWebhooks(): Promise<LivechatApiResponse> {
    return this.apiCall('list_webhooks', {}, LivechatApiType.CONFIGURATION);
  }

  async unregisterWebhook(webhookId: string): Promise<LivechatApiResponse> {
    return this.apiCall(
      'unregister_webhook',
      { id: webhookId },
      LivechatApiType.CONFIGURATION,
    );
  }

  // ============ PROPERTIES ============

  async updateChatProperties(
    chatId: string,
    properties: Record<string, unknown>,
  ): Promise<LivechatApiResponse> {
    return this.apiCall('update_chat_properties', { id: chatId, properties });
  }

  async getChatProperties(chatId: string): Promise<Record<string, unknown>> {
    const chat = await this.getChat(chatId);
    return (chat?.['properties'] as Record<string, unknown>) || {};
  }

  // ============ GROUPS (Configuration API) ============

  async listGroups(): Promise<LivechatApiResponse> {
    return this.apiCall('list_groups', {}, LivechatApiType.CONFIGURATION);
  }
}
