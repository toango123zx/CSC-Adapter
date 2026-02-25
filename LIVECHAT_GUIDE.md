# Hướng Dẫn Sử Dụng LiveChat API

## 📋 Thông Tin Token

Token của bạn đã được cấu hình trong file `.env`:
- **Account ID**: 72f548bb-70c3-489c-bbc3-30f1fcb36d71
- **Entity ID**: toango123zx@gmail.com
- **Token**: us-south1:KbqNU5pfqRs5nrc2Le0XW4p-KNY
- **Base64 Token**: NzJmNTQ4YmItNzBjMy00ODljLWJiYzMtMzBmMWZjYjM2ZDcxOnVzLXNvdXRoMTpLYnFOVTVwZnFSczVucmMyTGUwWFc0cC1LTlk=

## 🚀 Cách Sử Dụng

### 1. Kiểm Tra Kết Nối

Để test xem token có hoạt động không:

```typescript
import { LivechatService } from './modules/adapters/livechat/livechat.service';

// Trong controller hoặc service của bạn
async testLiveChat() {
  const isConnected = await this.livechatService.testConnection();
  console.log('LiveChat kết nối:', isConnected ? '✅ Thành công' : '❌ Thất bại');
}
```

### 2. Lấy Danh Sách Chats Đang Hoạt Động

```typescript
async getActiveChats() {
  const chats = await this.livechatService.getActiveChats();
  console.log('Các chat đang hoạt động:', chats);
  return chats;
}
```

### 3. Gửi Tin Nhắn Đến Customer

```typescript
async sendMessageToCustomer(chatId: string, message: string) {
  const result = await this.livechatService.sendMessage(chatId, message);
  console.log('Tin nhắn đã gửi:', result);
  return result;
}
```

### 4. Lấy Thông Tin Chi Tiết Chat

```typescript
async getChatInfo(chatId: string) {
  const chatDetails = await this.livechatService.getChatDetails(chatId);
  console.log('Chi tiết chat:', chatDetails);
  return chatDetails;
}
```

### 5. Lấy Lịch Sử Chat

```typescript
async getHistory(chatId: string) {
  const history = await this.livechatService.getChatHistory(chatId);
  console.log('Lịch sử chat:', history);
  return history;
}
```

### 6. Cập Nhật Trạng Thái Agent

```typescript
async updateStatus() {
  // accepting_chats: Sẵn sàng nhận chat
  // not_accepting_chats: Không nhận chat mới
  // offline: Offline
  
  await this.livechatService.setRoutingStatus('accepting_chats');
  console.log('Đã cập nhật trạng thái agent');
}
```

### 7. Lấy Thông Tin Customer

```typescript
async getCustomerInfo(customerId: string) {
  const customer = await this.livechatService.getCustomer(customerId);
  console.log('Thông tin customer:', customer);
  return customer;
}
```

## 📝 Ví Dụ Thực Tế

### Tạo Controller để Test API

Tạo file controller mới để test các chức năng LiveChat:

```typescript
// src/modules/adapters/livechat/livechat.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { LivechatService } from './livechat.service';

@Controller('livechat')
export class LivechatController {
  constructor(private readonly livechatService: LivechatService) {}

  @Get('test')
  async testConnection() {
    const isConnected = await this.livechatService.testConnection();
    return { success: isConnected };
  }

  @Get('chats')
  async getActiveChats() {
    return await this.livechatService.getActiveChats();
  }

  @Post('send')
  async sendMessage(@Body() body: { chatId: string; message: string }) {
    return await this.livechatService.sendMessage(body.chatId, body.message);
  }

  @Get('chat/:chatId')
  async getChatDetails(@Param('chatId') chatId: string) {
    return await this.livechatService.getChatDetails(chatId);
  }

  @Get('history/:chatId')
  async getChatHistory(@Param('chatId') chatId: string) {
    return await this.livechatService.getChatHistory(chatId);
  }

  @Post('status')
  async setStatus(@Body() body: { status: string }) {
    return await this.livechatService.setRoutingStatus(
      body.status as 'accepting_chats' | 'not_accepting_chats' | 'offline'
    );
  }

  @Get('customer/:customerId')
  async getCustomer(@Param('customerId') customerId: string) {
    return await this.livechatService.getCustomer(customerId);
  }
}
```

### Thêm Controller vào Module

Cập nhật `livechat.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LivechatGateway } from './livechat.gateway';
import { LivechatService } from './livechat.service';
import { LivechatController } from './livechat.controller';

@Module({
  imports: [ConfigModule],
  controllers: [LivechatController],
  providers: [LivechatGateway, LivechatService],
  exports: [LivechatService],
})
export class LivechatModule {}
```

## 🧪 Test API Endpoints

Sau khi chạy ứng dụng, bạn có thể test các endpoints:

1. **Test kết nối:**
   ```bash
   GET http://localhost:3000/livechat/test
   ```

2. **Lấy danh sách chats:**
   ```bash
   GET http://localhost:3000/livechat/chats
   ```

3. **Gửi tin nhắn:**
   ```bash
   POST http://localhost:3000/livechat/send
   Content-Type: application/json
   
   {
     "chatId": "CHAT_ID_HERE",
     "message": "Hello from API!"
   }
   ```

4. **Cập nhật trạng thái:**
   ```bash
   POST http://localhost:3000/livechat/status
   Content-Type: application/json
   
   {
     "status": "accepting_chats"
   }
   ```

## 🔐 Authentication

Token được sử dụng theo format Bearer Token trong headers:
```
Authorization: Bearer us-south1:KbqNU5pfqRs5nrc2Le0XW4p-KNY
X-Author-Id: toango123zx@gmail.com
```

## 📚 API Documentation

LiveChat API v3.5 sử dụng các endpoints sau:

- **Base URL**: `https://api.livechatinc.com/v3.5`
- **Agent API**: `/agent/action/{action_name}`
- **Customer API**: `/customer/action/{action_name}`

## ⚠️ Lưu Ý

1. **Token Security**: Không commit file `.env` lên Git. File `.env.example` đã được tạo làm template.

2. **Rate Limiting**: LiveChat có giới hạn số request/giây. Cần implement retry logic nếu cần.

3. **WebSocket**: Để nhận events real-time (incoming messages), cần implement WebSocket connection (đã có placeholder trong service).

4. **Error Handling**: Tất cả methods đều có try-catch và logging errors.

## 🔗 Tài Liệu Tham Khảo

- [LiveChat Agent Chat API](https://developers.livechat.com/docs/messaging/agent-chat-api/)
- [LiveChat Authentication](https://developers.livechat.com/docs/authorization/)
- [LiveChat RTM API](https://developers.livechat.com/docs/messaging/agent-chat-api/rtm-reference/)

## 🎯 Scopes của Token

Token của bạn có TOÀN BỘ quyền (các scopes quan trọng):
- ✅ Đọc/ghi chats
- ✅ Quản lý agents
- ✅ Quản lý customers
- ✅ Webhooks
- ✅ Canned responses
- ✅ Tags, groups, properties
- ✅ Reports và analytics
- ✅ Và nhiều quyền khác...

## 🚦 Bắt Đầu

1. **Cài đặt dependencies:**
   ```bash
   pnpm install
   ```

2. **Chạy ứng dụng:**
   ```bash
   pnpm run start:dev
   ```

3. **Test kết nối:**
   ```bash
   curl http://localhost:3000/livechat/test
   ```

Nếu nhận được `{"success": true}` là đã kết nối thành công! 🎉
