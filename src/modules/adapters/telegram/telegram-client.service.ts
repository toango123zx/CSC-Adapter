// src/modules/adapters/telegram/telegram-client.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';

@Injectable()
export class TelegramClientService implements OnModuleInit {
    private readonly logger = new Logger(TelegramClientService.name);
    private client!: TelegramClient;
    private isConnected = false;

    constructor(private readonly configService: ConfigService) { }

    async onModuleInit() {
        await this.initClient();
    }

    private async initClient() {
        const apiId = this.configService.get<number>('TELEGRAM_APP_API_ID');
        const apiHash = this.configService.get<string>('TELEGRAM_APP_API_HASH');
        const sessionString = this.configService.get<string>('TELEGRAM_SESSION_STRING', '');

        if (!apiId || !apiHash) {
            this.logger.warn('⚠️ Thiếu TELEGRAM_APP_API_ID hoặc TELEGRAM_APP_API_HASH. MTProto (UserBot) sẽ KHÔNG hoạt động.');
            return;
        }

        if (!sessionString) {
            this.logger.warn('⚠️ Thiếu TELEGRAM_SESSION_STRING. Vui lòng chạy script đăng nhập UserBot để lấy biến này.');
            return;
        }

        try {
            const stringSession = new StringSession(sessionString);
            this.client = new TelegramClient(stringSession, Number(apiId), apiHash, {
                connectionRetries: 5,
                useWSS: true,
                baseLogger: undefined, // Tắt log mặc định của GramJS tránh nhiễu
            });

            await this.client.connect(); // Connect bằng session có sẵn
            this.isConnected = true;

            const me = await this.client.getMe() as Api.User;
            this.logger.log(`👤 UserBot MTProto đã kết nối thành công: ${me.firstName} (ID: ${me.id})`);
        } catch (error) {
            this.logger.error('❌ Lỗi kết nối MTProto UserBot:', error);
        }
    }

    public get isReady(): boolean {
        return this.isConnected;
    }

    // ================================================================
    // GROUP MANAGEMENT (UserBot)
    // ================================================================

    /**
     * Tạo một Group mới và tự động lấy Chat ID.
     * @param title Tên group
     * @param users Danh sách username hoặc số điện thoại (vd: ['@username', '+84123456789']). Chú ý: Cần ít nhất 1 người ngoài mình để tạo Group trên Telegram.
     * @returns Chat ID (âm)
     */
    async createGroup(title: string, users: string[]): Promise<string | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            // API.messages.CreateChat dùng cho Basic Group. 
            // (Supergroup/Channel dùng CreateChannel)
            const result = await this.client.invoke(
                new Api.messages.CreateChat({
                    users: users,
                    title: title,
                })
            ) as unknown as Api.Updates;

            // Extract chat ID từ Updates
            const chat = result.chats[0] as Api.Chat;
            const chatId = `-${chat.id.toString()}`;

            this.logger.log(`✅ Đã tạo Group mới: "${title}" (ID: ${chatId})`);
            return chatId;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi tạo Group "${title}": ${msg}`);
            return null;
        }
    }

    /**
     * Tạo Supergroup (không cần user nào khác).
     * Dùng khi muốn tạo nhóm trống rồi tự add bot/user vào sau.
     * @param title Tên supergroup
     * @param about Mô tả (optional)
     * @returns Chat ID (dạng -100xxx)
     */
    async createSuperGroup(title: string, about?: string): Promise<string | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const result = await this.client.invoke(
                new Api.channels.CreateChannel({
                    title: title,
                    about: about || '',
                    megagroup: true, // megagroup = Supergroup (có đủ tính năng Admin)
                })
            ) as unknown as Api.Updates;

            const channel = result.chats[0] as Api.Channel;
            // Supergroup ID format: -100 + channel id
            const chatId = `-100${channel.id.toString()}`;

            this.logger.log(`✅ Đã tạo Supergroup mới: "${title}" (ID: ${chatId})`);
            return chatId;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi tạo Supergroup "${title}": ${msg}`);
            return null;
        }
    }

    /**
     * Add 1 hoặc nhiều bot vào Group, mỗi bot được tự động promote Admin.
     * @param chatId ID của group
     * @param botUsernames Danh sách username bot (vd: ['@MyBot', '@OtherBot'])
     */
    async addBotsToGroup(chatId: string, botUsernames: string[]): Promise<{ added: string[]; failed: string[] }> {
        const added: string[] = [];
        const failed: string[] = [];

        for (const botUsername of botUsernames) {
            try {
                const addResult = await this.addMembersToGroup(chatId, [botUsername]);
                if (addResult) {
                    // Tự động promote bot thành Admin
                    await this.promoteMemberToAdmin(chatId, botUsername);
                    added.push(botUsername);
                    this.logger.log(`🤖 Đã add và promote bot ${botUsername} trong Group ${chatId}`);
                } else {
                    failed.push(botUsername);
                }
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                this.logger.error(`❌ Lỗi add bot ${botUsername}: ${msg}`);
                failed.push(botUsername);
            }
        }

        return { added, failed };
    }

    /**
     * Thêm người dùng vào Group.
     * @param chatId ID của group
     * @param users Danh sách username hoặc số điện thoại
     */
    async addMembersToGroup(chatId: string, users: string[]): Promise<boolean> {
        if (!this.isConnected) return false;

        try {
            // chatId đầu vào thường có dạng âm, GramJS cần bóc tách dấu trừ nếu dùng hàm Invite/Add
            // Thử dùng API InviteToChannel (áp dụng cho Supergroup/BasicGroup nâng cấp)

            const entity = await this.client.getEntity(chatId);

            await this.client.invoke(
                new Api.channels.InviteToChannel({
                    channel: entity,
                    users: users,
                })
            );

            this.logger.log(`✅ Đã thêm ${users.length} người vào Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            // Fallback nếu là Basic Group (chưa nâng cấp Channel/Supergroup)
            try {
                const rawId = chatId.startsWith('-') ? chatId.replace('-', '') : chatId;
                const bigIntId = require('big-integer')(rawId);
                await this.client.invoke(
                    new Api.messages.AddChatUser({
                        chatId: bigIntId,
                        userId: users[0],
                        fwdLimit: 50,
                    })
                );
                this.logger.log(`✅ Đã thêm ${users[0]} vào Basic Group ${chatId}`);
                return true;
            } catch (fallbackError: unknown) {
                const msg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
                this.logger.error(`❌ Lỗi thêm người vào Group ${chatId}: ${msg}`);
                return false;
            }
        }
    }

    /**
     * Thúc đẩy (Promote) 1 user làm Admin với mọi quyền hạn trong Group.
     */
    async promoteMemberToAdmin(chatId: string, userId: string): Promise<boolean> {
        if (!this.isConnected) return false;

        try {
            const channel = await this.client.getEntity(chatId);
            const user = await this.client.getEntity(userId);

            await this.client.invoke(
                new Api.channels.EditAdmin({
                    channel: channel,
                    userId: user,
                    adminRights: new Api.ChatAdminRights({
                        changeInfo: true,
                        postMessages: true,
                        editMessages: true,
                        deleteMessages: true,
                        banUsers: true,
                        inviteUsers: true,
                        pinMessages: true,
                        addAdmins: false,
                        anonymous: false,
                        manageCall: true,
                        manageTopics: true,
                    }),
                    rank: 'Hệ Thống (Bot)',
                })
            );

            this.logger.log(`👑 Đã phong quyền Admin cho ${userId} trong Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            // Fallback cho Basic Chat (Cần migrate lên supergroup nếu error)
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi promote Admin trong Group ${chatId}: ${msg}`);
            return false;
        }
    }

    /**
     * Xóa một Group (Hoặc Channel) hoàn toàn khỏi server Telegram (Yêu cầu phải là Creator).
     * @param chatId ID của group/channel cần xóa
     */
    async deleteGroup(chatId: string): Promise<boolean> {
        if (!this.isConnected) return false;

        try {
            const entity = await this.client.getEntity(chatId);

            // Nếu là Channel/SuperGroup
            if (entity.className === 'Channel') {
                await this.client.invoke(
                    new Api.channels.DeleteChannel({
                        channel: entity,
                    })
                );
                this.logger.log(`🗑️ Đã XÓA HOÀN TOÀN SuperGroup/Channel ${chatId}`);
                return true;
            }

            // Nếu là Basic Chat: Không có hàm DeleteChat, chỉ có thể DeleteHistory và leave
            if (entity.className === 'Chat') {
                const bigIntId = require('big-integer')(chatId.replace('-', ''));
                await this.client.invoke(
                    new Api.messages.DeleteChatUser({
                        chatId: bigIntId,
                        userId: 'me',
                    })
                );
                this.logger.log(`🚪 Đã tự rời Basic Chat ${chatId} (Basic chat vô chủ tự động bị hủy)`);
                return true;
            }

            return false;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi xóa Group ${chatId}: ${msg}`);
            return false;
        }
    }
}
