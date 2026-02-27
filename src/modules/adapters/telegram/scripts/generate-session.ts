// Tệp lệnh chạy để lấy TELEGRAM_SESSION_STRING
// Cần chạy bằng lệnh: ts-node src/modules/adapters/telegram/scripts/generate-session.ts
import { StringSession } from 'telegram/sessions';
import { TelegramClient } from 'telegram';
// @ts-ignore
import input from 'input';
import * as dotenv from 'dotenv';
dotenv.config();

const apiId = Number(process.env.TELEGRAM_APP_API_ID);
const apiHash = process.env.TELEGRAM_APP_API_HASH;

if (!apiId || !apiHash) {
    console.error('❌ Lỗi: Bạn chưa cung cấp TELEGRAM_APP_API_ID và TELEGRAM_APP_API_HASH trong file .env');
    process.exit(1);
}

const stringSession = new StringSession('');

(async () => {
    console.log('Khởi tạo Telegram Client...');
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text('Vui lòng nhập số điện thoại (vd: +84901234567): '),
        password: async () => await input.text('Nhập mật khẩu 2FA (nếu có): '),
        phoneCode: async () => await input.text('Nhập mã OTP Telegram gửi về: '),
        onError: (err) => console.log(err),
    });

    console.log('✅ Đăng nhập thành công!');
    const sessionString = client.session.save() as unknown as string;
    console.log('\n================================');
    console.log('👇 LƯU LẠI CHUỖI NÀY VÀO FILE .env LÀM "TELEGRAM_SESSION_STRING" 👇\n');
    console.log(sessionString);
    console.log('\n================================');

    await client.sendMessage('me', { message: 'Đã tạo Session String thành công!' });
    process.exit(0);
})();
