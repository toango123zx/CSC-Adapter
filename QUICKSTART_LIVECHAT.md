# Quick Start - Test LiveChat Integration

## Bước 1: Khởi động ứng dụng

```bash
pnpm run start:dev
```

## Bước 2: Test kết nối

Mở trình duyệt hoặc sử dụng curl/Postman để test:

### 1. Test Connection
```bash
# Browser
http://localhost:3000/livechat/test

# curl
curl http://localhost:3000/livechat/test
```

**Kết quả mong đợi:**
```json
{
  "success": true,
  "message": "Kết nối LiveChat thành công!"
}
```

### 2. Lấy danh sách chats
```bash
curl http://localhost:3000/livechat/chats
```

### 3. Cập nhật trạng thái agent
```bash
curl -X POST http://localhost:3000/livechat/status \
  -H "Content-Type: application/json" \
  -d '{"status":"accepting_chats"}'
```

### 4. Gửi tin nhắn (cần có chatId)
```bash
curl -X POST http://localhost:3000/livechat/send \
  -H "Content-Type: application/json" \
  -d '{"chatId":"YOUR_CHAT_ID","message":"Xin chào!"}'
```

## Các API Endpoints có sẵn:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/livechat/test` | Kiểm tra kết nối |
| GET | `/livechat/chats` | Lấy danh sách chats |
| POST | `/livechat/send` | Gửi tin nhắn |
| GET | `/livechat/chat/:chatId` | Chi tiết chat |
| GET | `/livechat/history/:chatId` | Lịch sử chat |
| POST | `/livechat/status` | Cập nhật trạng thái |
| GET | `/livechat/customer/:customerId` | Thông tin customer |

## Troubleshooting

### Nếu gặp lỗi "Authorization failed"
- Kiểm tra file `.env` đã có đầy đủ thông tin token chưa
- Đảm bảo token chưa hết hạn

### Nếu gặp lỗi "Cannot find module"
```bash
pnpm install
```

### Xem logs
Ứng dụng sẽ tự động log các hoạt động của LiveChat service trong console.

## Xem chi tiết

Đọc file `LIVECHAT_GUIDE.md` để biết thêm chi tiết về cách sử dụng API.
