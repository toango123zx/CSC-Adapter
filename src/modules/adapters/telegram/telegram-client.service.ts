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
        } catch (error: any) {
            Logger.error('❌ Telegram client initialization failed:', 'TelegramClientService')
            Logger.error(`Error message: ${error.message}`, 'TelegramClientService')
            Logger.error(`Stack trace: ${error.stack}`, 'TelegramClientService')
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

    // ================================================================
    // RENAME GROUP (UserBot)
    // ================================================================

    /**
     * Đổi tên nhóm Telegram qua MTProto.
     * Hỗ trợ cả Basic Group (messages.EditChatAbout) và Supergroup/Channel (channels.EditTitle).
     * @param chatId ID của group (dạng âm: -xxx hoặc -100xxx)
     * @param newTitle Tên mới muốn đặt cho nhóm
     * @returns true nếu đổi tên thành công, false nếu thất bại
     */
    async renameGroup(chatId: string, newTitle: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            // Supergroup/Channel → dùng channels.EditTitle
            if (entity.className === 'Channel') {
                await this.client.invoke(
                    new Api.channels.EditTitle({
                        channel: entity,
                        title: newTitle,
                    })
                );
                this.logger.log(`✏️ Đã đổi tên Supergroup/Channel ${chatId} → "${newTitle}"`);
                return true;
            }

            // Basic Group → dùng messages.EditChatAbout (EditChatTitle không có trong GramJS, dùng invoke raw)
            if (entity.className === 'Chat') {
                const rawId = chatId.startsWith('-') ? chatId.replace('-', '') : chatId;
                const bigIntId = require('big-integer')(rawId);
                await this.client.invoke(
                    new Api.messages.EditChatTitle({
                        chatId: bigIntId,
                        title: newTitle,
                    })
                );
                this.logger.log(`✏️ Đã đổi tên Basic Group ${chatId} → "${newTitle}"`);
                return true;
            }

            this.logger.warn(`⚠️ Entity ${chatId} không phải Group hoặc Channel, không thể đổi tên.`);
            return false;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi đổi tên Group ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // INVITE LINK MANAGEMENT (UserBot)
    // ================================================================

    async createInviteLink(
        chatId: string,
        options?: {
            title?: string;
            requestNeeded?: boolean;
            usageLimit?: number;
            expireDate?: number;
        },
    ): Promise<{ inviteLink: string; requestNeeded: boolean; usageLimit?: number } | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            // Gọi API ExportChatInvite để tạo invite link với các tuỳ chọn
            const result = await this.client.invoke(
                new Api.messages.ExportChatInvite({
                    peer: entity,
                    title: options?.title,
                    requestNeeded: options?.requestNeeded ?? false,
                    usageLimit: options?.usageLimit,
                    expireDate: options?.expireDate,
                })
            ) as Api.ChatInviteExported;

            const inviteLink = result.link;
            const requestNeeded = options?.requestNeeded ?? false;
            const usageLimit = options?.usageLimit;

            // Log chi tiết loại link được tạo
            const linkType = requestNeeded
                ? '🔒 Cần duyệt'
                : usageLimit
                    ? `👥 Giới hạn ${usageLimit} người`
                    : '🌐 Công khai';

            this.logger.log(`🔗 Đã tạo invite link [${linkType}] cho Group ${chatId}: ${inviteLink}`);

            return { inviteLink, requestNeeded, usageLimit };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi tạo invite link cho Group ${chatId}: ${msg}`);
            return null;
        }
    }

    /**
     * Tạo link tham gia nhóm KHÔNG cần Admin duyệt.
     * Ai có link đều có thể join ngay lập tức.
     * @param chatId ID của group
     * @param title Tên hiển thị của link (optional)
     * @returns Object chứa inviteLink, hoặc null nếu thất bại
     */
    async createPublicInviteLink(
        chatId: string,
        title?: string,
    ): Promise<{ inviteLink: string; requestNeeded: boolean } | null> {
        this.logger.log(`🌐 Tạo link join công khai (không cần duyệt) cho Group ${chatId}...`);
        return this.createInviteLink(chatId, {
            title: title || 'Link tham gia công khai',
            requestNeeded: false,
        });
    }

    /**
     * Tạo link tham gia nhóm CẦN Admin duyệt (approval-based).
     * Khi user click link, admin sẽ nhận được yêu cầu → phải approve hoặc reject.
     * @param chatId ID của group
     * @param title Tên hiển thị của link (optional)
     * @returns Object chứa inviteLink, hoặc null nếu thất bại
     */
    async createApprovalInviteLink(
        chatId: string,
        title?: string,
    ): Promise<{ inviteLink: string; requestNeeded: boolean } | null> {
        this.logger.log(`🔒 Tạo link join cần duyệt (approval) cho Group ${chatId}...`);
        return this.createInviteLink(chatId, {
            title: title || 'Link tham gia cần duyệt',
            requestNeeded: true,
        });
    }

    /**
     * Tạo link tham gia nhóm có GIỚI HẠN số người tối đa.
     * Khi đạt đủ số lượng, link sẽ tự động hết hiệu lực.
     * @param chatId ID của group
     * @param usageLimit Số người tối đa có thể join qua link này (1 - 99999)
     * @param title Tên hiển thị của link (optional)
     * @returns Object chứa inviteLink và usageLimit, hoặc null nếu thất bại
     */
    async createLimitedInviteLink(
        chatId: string,
        usageLimit: number,
        title?: string,
    ): Promise<{ inviteLink: string; requestNeeded: boolean; usageLimit?: number } | null> {
        this.logger.log(`👥 Tạo link join giới hạn ${usageLimit} người cho Group ${chatId}...`);
        return this.createInviteLink(chatId, {
            title: title || `Link giới hạn ${usageLimit} người`,
            requestNeeded: false,
            usageLimit: usageLimit,
        });
    }

    // ================================================================
    // JOIN REQUEST HANDLING (UserBot)
    // ================================================================

    /**
     * Phê duyệt (Accept) yêu cầu tham gia nhóm của user qua MTProto.
     * Dùng khi link invite có requestNeeded = true và user đã click link → chờ duyệt.
     * @param chatId ID của group
     * @param userId Username hoặc ID của user cần duyệt
     * @returns true nếu duyệt thành công, false nếu thất bại
     */
    async approveJoinRequest(chatId: string, userId: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const peer = await this.client.getEntity(chatId);
            const user = await this.client.getEntity(userId);

            // HideChatJoinRequest với approved = true → Accept user vào nhóm
            await this.client.invoke(
                new Api.messages.HideChatJoinRequest({
                    peer: peer,
                    userId: user,
                    approved: true,
                })
            );

            this.logger.log(`✅ Đã DUYỆT yêu cầu join của user ${userId} vào Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi duyệt join request (${userId} → ${chatId}): ${msg}`);
            return false;
        }
    }

    /**
     * Từ chối (Reject) yêu cầu tham gia nhóm của user qua MTProto.
     * Dùng khi link invite có requestNeeded = true và admin muốn từ chối user.
     * @param chatId ID của group
     * @param userId Username hoặc ID của user cần từ chối
     * @returns true nếu từ chối thành công, false nếu thất bại
     */
    async rejectJoinRequest(chatId: string, userId: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const peer = await this.client.getEntity(chatId);
            const user = await this.client.getEntity(userId);

            // HideChatJoinRequest với approved = false → Reject user
            await this.client.invoke(
                new Api.messages.HideChatJoinRequest({
                    peer: peer,
                    userId: user,
                    approved: false,
                })
            );

            this.logger.log(`❌ Đã TỪ CHỐI yêu cầu join của user ${userId} vào Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi từ chối join request (${userId} → ${chatId}): ${msg}`);
            return false;
        }
    }

    // ================================================================
    // SESSION TOKEN GENERATION (MTProto)
    // Tạo Session String qua API thay vì phải chạy script thủ công.
    // Flow 2 bước: startSessionAuth() → verifySessionAuth()
    // ================================================================

    /**
     * Map lưu trữ các phiên đăng nhập đang chờ xác nhận OTP.
     * Key = phoneNumber, Value = { client, resolve/reject callbacks, timeout }
     * Tự động dọn dẹp sau 5 phút nếu không xác nhận.
     */
    private pendingSessions = new Map<string, {
        client: TelegramClient;
        phoneCodeResolve?: (code: string) => void;
        passwordResolve?: (password: string) => void;
        sessionPromise: Promise<string>;
        timeout: ReturnType<typeof setTimeout>;
        failed?: boolean; // Đánh dấu phiên đã thất bại (tránh resolve sau khi cleanup)
    }>();

    /**
     * Bước 1: Khởi tạo phiên đăng nhập Telegram và gửi mã OTP về số điện thoại.
     * Server tạo TelegramClient tạm, bắt đầu flow đăng nhập, giữ trong memory chờ OTP.
     *
     * @param apiId Telegram App API ID (lấy từ https://my.telegram.org)
     * @param apiHash Telegram App API Hash
     * @param phoneNumber Số điện thoại Telegram (kèm mã quốc gia, vd: +84971751109)
     * @returns true nếu đã gửi OTP thành công, false nếu thất bại
     *
     * ⚠️ Lưu ý bắt buộc: SĐT phải bao gồm MÃ QUỐC GIA (vd: +84 cho VN).
     * Sai: +0971751109 — Đúng: +84971751109
     *
     * ⚠️ Session string tương đương mật khẩu tài khoản.
     * Chỉ nên expose endpoint này trong môi trường internal/development.
     */
    async startSessionAuth(apiId: number, apiHash: string, phoneNumber: string): Promise<boolean> {
        // Validate: SĐT phải bắt đầu bằng + và mã quốc gia (không phải +0)
        if (!phoneNumber.startsWith('+') || phoneNumber.startsWith('+0')) {
            this.logger.error(
                `⚠️ SĐT "${phoneNumber}" không hợp lệ. Phải bao gồm mã quốc gia (vd: +84971751109 cho VN, +1... cho US).`
            );
            return false;
        }

        // Dọn dẹp phiên cũ nếu có (tránh rò rỉ memory)
        if (this.pendingSessions.has(phoneNumber)) {
            const old = this.pendingSessions.get(phoneNumber)!;
            clearTimeout(old.timeout);
            try { await old.client.disconnect(); } catch { /* ignore */ }
            this.pendingSessions.delete(phoneNumber);
            this.logger.warn(`🔄 Đã huỷ phiên đăng nhập cũ cho SĐT ${phoneNumber}`);
        }

        try {
            const stringSession = new StringSession('');
            const tempClient = new TelegramClient(stringSession, apiId, apiHash, {
                connectionRetries: 5,
                useWSS: true,
                baseLogger: undefined, // Tắt log mặc định GramJS tránh nhiễu
            });

            await tempClient.connect();

            // Tạo Promise để đợi OTP và password từ bước 2 (verifySessionAuth)
            // phoneCodeResolve / passwordResolve sẽ được gán khi client.start() yêu cầu
            let phoneCodeResolve: ((code: string) => void) | undefined;
            let passwordResolve: ((password: string) => void) | undefined;
            // Flag đánh dấu phiên đã fail sớm (SĐT sai, API key sai, etc.)
            let earlyError: Error | null = null;

            const sessionPromise = new Promise<string>((resolve, reject) => {
                tempClient.start({
                    phoneNumber: async () => phoneNumber,
                    // Khi Telegram yêu cầu mã OTP → tạo Promise chờ verifySessionAuth() gọi resolve
                    phoneCode: async () => {
                        return new Promise<string>((codeResolve) => {
                            phoneCodeResolve = codeResolve;
                            // Cập nhật vào Map để verifySessionAuth có thể gọi resolve
                            const session = this.pendingSessions.get(phoneNumber);
                            if (session) {
                                session.phoneCodeResolve = codeResolve;
                            }
                        });
                    },
                    // Khi Telegram yêu cầu mật khẩu 2FA → tạo Promise chờ verifySessionAuth()
                    password: async () => {
                        return new Promise<string>((passResolve) => {
                            passwordResolve = passResolve;
                            const session = this.pendingSessions.get(phoneNumber);
                            if (session) {
                                session.passwordResolve = passResolve;
                            }
                        });
                    },
                    onError: (err) => {
                        this.logger.error(`❌ Lỗi trong quá trình đăng nhập (${phoneNumber}): ${err.message}`);
                        // Không reject ở đây — để catch bên dưới xử lý
                    },
                }).then(() => {
                    // Đăng nhập thành công → lấy session string
                    const session = tempClient.session.save() as unknown as string;
                    resolve(session);
                }).catch((err) => {
                    earlyError = err;
                    reject(err);
                });
            });

            // ⚠️ QUAN TRỌNG: Gắn .catch() ngay lập tức để tránh Unhandled Promise Rejection crash server
            // Lỗi thực tế sẽ được xử lý khi verifySessionAuth() await sessionPromise
            sessionPromise.catch((err) => {
                this.logger.error(`❌ Phiên đăng nhập ${phoneNumber} thất bại: ${err.message}`);
                // Tự dọn dẹp phiên lỗi
                const session = this.pendingSessions.get(phoneNumber);
                if (session) {
                    session.failed = true;
                    clearTimeout(session.timeout);
                    try { tempClient.disconnect(); } catch { /* ignore */ }
                    this.pendingSessions.delete(phoneNumber);
                }
            });

            // Auto-cleanup sau 5 phút nếu không xác nhận OTP
            const timeout = setTimeout(async () => {
                this.logger.warn(`⏰ Phiên đăng nhập cho ${phoneNumber} đã hết hạn (5 phút). Tự động huỷ.`);
                try { await tempClient.disconnect(); } catch { /* ignore */ }
                this.pendingSessions.delete(phoneNumber);
            }, 5 * 60 * 1000);

            // Lưu vào Map để verifySessionAuth() có thể truy cập
            this.pendingSessions.set(phoneNumber, {
                client: tempClient,
                phoneCodeResolve,
                passwordResolve,
                sessionPromise,
                timeout,
            });

            // Đợi ngắn (3 giây) để bắt lỗi sớm: SĐT sai format, API key sai, etc.
            // Nếu GramJS reject nhanh (vd: PHONE_NUMBER_INVALID) → return false ngay
            // Nếu không có lỗi sau 3s → OTP đã được gửi thành công
            await new Promise(resolve => setTimeout(resolve, 3000));

            if (earlyError) {
                // Lỗi đã xảy ra trong 3 giây đầu → cleanup đã được .catch() xử lý
                this.logger.error(`❌ Lỗi khởi tạo phiên cho ${phoneNumber}: ${(earlyError as Error).message}`);
                return false;
            }

            this.logger.log(`📨 Đã gửi yêu cầu OTP cho SĐT ${phoneNumber}. Chờ xác nhận từ /telegram/session/verify`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi khởi tạo phiên đăng nhập cho ${phoneNumber}: ${msg}`);
            return false;
        }
    }

    /**
     * Bước 2: Xác nhận mã OTP (và password 2FA nếu có) để hoàn tất đăng nhập.
     * Trả về Session String — chuỗi dùng để cấu hình TELEGRAM_SESSION_STRING trong .env.
     *
     * @param phoneNumber Số điện thoại đã dùng ở bước 1
     * @param phoneCode Mã OTP Telegram gửi về SĐT
     * @param password Mật khẩu 2FA (nếu tài khoản có bật Two-Step Verification)
     * @returns Session string nếu thành công, null nếu thất bại
     */
    async verifySessionAuth(phoneNumber: string, phoneCode: string, password?: string): Promise<string | null> {
        const session = this.pendingSessions.get(phoneNumber);
        if (!session) {
            this.logger.error(`⚠️ Không tìm thấy phiên đăng nhập cho SĐT ${phoneNumber}. Hãy gọi /telegram/session/start trước.`);
            return null;
        }

        try {
            // Giải quyết OTP → GramJS tiếp tục flow đăng nhập
            if (session.phoneCodeResolve) {
                session.phoneCodeResolve(phoneCode);
            } else {
                this.logger.error(`⚠️ Phiên ${phoneNumber} chưa sẵn sàng nhận OTP. Thử lại sau vài giây.`);
                return null;
            }

            // Nếu có password 2FA → đợi 1 chút rồi resolve password
            if (password) {
                // Đợi ngắn để GramJS chuyển sang bước yêu cầu password
                await new Promise(resolve => setTimeout(resolve, 2000));
                const updatedSession = this.pendingSessions.get(phoneNumber);
                if (updatedSession?.passwordResolve) {
                    updatedSession.passwordResolve(password);
                }
            }

            // Đợi flow đăng nhập hoàn tất (timeout 120 giây = 2 phút)
            const sessionString = await Promise.race([
                session.sessionPromise,
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout: Xác nhận OTP quá 120 giây')), 120000)
                ),
            ]);

            // Dọn dẹp: xoá khỏi Map, huỷ timeout, ngắt kết nối client tạm
            clearTimeout(session.timeout);
            try { await session.client.disconnect(); } catch { /* ignore */ }
            this.pendingSessions.delete(phoneNumber);

            this.logger.log(`✅ Đã tạo Session String thành công cho SĐT ${phoneNumber}`);
            return sessionString;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi xác nhận OTP cho ${phoneNumber}: ${msg}`);

            // Dọn dẹp khi thất bại
            clearTimeout(session.timeout);
            try { await session.client.disconnect(); } catch { /* ignore */ }
            this.pendingSessions.delete(phoneNumber);

            return null;
        }
    }

    // ================================================================
    // REMOVE MEMBER FROM GROUP (UserBot)
    // ================================================================

    /**
     * Xóa thành viên khỏi Group qua MTProto UserBot.
     * Hỗ trợ cả Basic Group (messages.DeleteChatUser) và Supergroup/Channel (channels.EditBanned).
     *
     * ⚠️ Khác với Bot API removeMember (ban+unban):
     * MTProto có API riêng — channels.EditBanned với ChatBannedRights(viewMessages: true)
     * để kick user ra khỏi group. Sau đó unban để user có thể join lại.
     *
     * @param chatId ID của group (dạng âm: -xxx hoặc -100xxx)
     * @param userId Username hoặc ID của user cần xóa
     * @returns true nếu xóa thành công, false nếu thất bại
     */
    async removeMemberFromGroup(chatId: string, userId: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);
            const user = await this.client.getEntity(userId);

            // Supergroup/Channel → dùng channels.EditBanned
            if (entity.className === 'Channel') {
                // Bước 1: Kick user (ban với viewMessages = true = không thấy gì)
                await this.client.invoke(
                    new Api.channels.EditBanned({
                        channel: entity,
                        participant: user,
                        bannedRights: new Api.ChatBannedRights({
                            untilDate: 0,
                            viewMessages: true,   // Cấm xem tin nhắn = kick ra khỏi group
                            sendMessages: true,
                            sendMedia: true,
                            sendStickers: true,
                            sendGifs: true,
                            sendGames: true,
                            sendInline: true,
                            embedLinks: true,
                        }),
                    })
                );
                this.logger.debug(`🔒 Bước 1/2: Đã kick user ${userId} khỏi Supergroup ${chatId}`);

                // Bước 2: Unban ngay (cho phép join lại)
                await this.client.invoke(
                    new Api.channels.EditBanned({
                        channel: entity,
                        participant: user,
                        bannedRights: new Api.ChatBannedRights({
                            untilDate: 0,
                            viewMessages: false,
                            sendMessages: false,
                            sendMedia: false,
                            sendStickers: false,
                            sendGifs: false,
                            sendGames: false,
                            sendInline: false,
                            embedLinks: false,
                        }),
                    })
                );
                this.logger.log(`🚪 Đã XÓA user ${userId} khỏi Supergroup ${chatId} (không cấm join lại)`);
                return true;
            }

            // Basic Group → dùng messages.DeleteChatUser
            if (entity.className === 'Chat') {
                const rawId = chatId.startsWith('-') ? chatId.replace('-', '') : chatId;
                const bigIntId = require('big-integer')(rawId);
                await this.client.invoke(
                    new Api.messages.DeleteChatUser({
                        chatId: bigIntId,
                        userId: user,
                    })
                );
                this.logger.log(`🚪 Đã XÓA user ${userId} khỏi Basic Group ${chatId}`);
                return true;
            }

            this.logger.warn(`⚠️ Entity ${chatId} không phải Group hoặc Channel.`);
            return false;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi xóa user ${userId} khỏi Group ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // GET GROUP MEMBERS (UserBot)
    // ================================================================

    /**
     * Lấy danh sách thành viên trong Group qua MTProto.
     * Chỉ hoạt động với Supergroup/Channel (có API channels.GetParticipants).
     * Basic Group không có API tương tự — cần migrate lên Supergroup.
     *
     * @param chatId ID của Supergroup (dạng -100xxx)
     * @param limit Số thành viên tối đa cần lấy (mặc định 200)
     * @returns Danh sách thành viên hoặc null nếu thất bại
     */
    async getGroupMembers(
        chatId: string,
        limit: number = 200,
    ): Promise<Array<Record<string, unknown>> | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            if (entity.className !== 'Channel') {
                this.logger.warn(`⚠️ getGroupMembers chỉ hỗ trợ Supergroup/Channel. Entity ${chatId} là ${entity.className}.`);
                return null;
            }

            const result = await this.client.invoke(
                new Api.channels.GetParticipants({
                    channel: entity,
                    filter: new Api.ChannelParticipantsSearch({ q: '' }),
                    offset: 0,
                    limit: limit,
                    hash: require('big-integer')(0),
                })
            );

            if (result.className === 'channels.ChannelParticipantsNotModified') {
                return [];
            }

            const participants = result as Api.channels.ChannelParticipants;
            const members = participants.users.map((user) => {
                const u = user as Api.User;
                return {
                    id: u.id?.toString(),
                    firstName: u.firstName,
                    lastName: u.lastName,
                    username: u.username,
                    phone: u.phone,
                    isBot: u.bot,
                };
            });

            this.logger.log(`👥 Lấy ${members.length} thành viên từ Group ${chatId}`);
            return members;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi lấy danh sách thành viên Group ${chatId}: ${msg}`);
            return null;
        }
    }

    // ================================================================
    // SET GROUP ABOUT / DESCRIPTION (UserBot)
    // ================================================================

    /**
     * Đổi mô tả (about/description) của Group qua MTProto.
     * Hỗ trợ cả Basic Group và Supergroup/Channel.
     *
     * @param chatId ID của group
     * @param about Mô tả mới
     * @returns true nếu đổi thành công, false nếu thất bại
     */
    async setGroupAbout(chatId: string, about: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            await this.client.invoke(
                new Api.messages.EditChatAbout({
                    peer: entity,
                    about: about,
                })
            );

            this.logger.log(`✏️ Đã đổi mô tả Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi đổi mô tả Group ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // GET GROUP INFO (UserBot)
    // ================================================================

    /**
     * Lấy thông tin chi tiết của Group qua MTProto.
     * Trả về: title, about, members count, admins count, photo, etc.
     * Hỗ trợ cả Basic Group (messages.GetFullChat) và Supergroup/Channel (channels.GetFullChannel).
     */
    async getGroupInfo(chatId: string): Promise<Record<string, unknown> | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            if (entity.className === 'Channel') {
                const result = await this.client.invoke(
                    new Api.channels.GetFullChannel({ channel: entity })
                );
                const fullChat = result.fullChat as Api.ChannelFull;
                const channel = result.chats[0] as Api.Channel;
                return {
                    id: chatId,
                    title: channel.title,
                    username: channel.username,
                    about: fullChat.about,
                    participantsCount: fullChat.participantsCount,
                    adminsCount: fullChat.adminsCount,
                    bannedCount: fullChat.bannedCount,
                    kickedCount: fullChat.kickedCount,
                    isMegagroup: channel.megagroup,
                    isVerified: channel.verified,
                    isRestricted: channel.restricted,
                    date: channel.date,
                };
            }

            if (entity.className === 'Chat') {
                const rawId = chatId.startsWith('-') ? chatId.replace('-', '') : chatId;
                const bigIntId = require('big-integer')(rawId);
                const result = await this.client.invoke(
                    new Api.messages.GetFullChat({ chatId: bigIntId })
                );
                const fullChat = result.fullChat as Api.ChatFull;
                const chat = result.chats[0] as Api.Chat;
                return {
                    id: chatId,
                    title: chat.title,
                    about: fullChat.about,
                    participantsCount: chat.participantsCount,
                    date: chat.date,
                    migratedTo: (fullChat as any).migratedTo ? true : false,
                };
            }

            return null;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi lấy thông tin Group ${chatId}: ${msg}`);
            return null;
        }
    }

    // ================================================================
    // SET GROUP PHOTO (UserBot)
    // ================================================================

    /**
     * Đặt ảnh đại diện cho Group qua MTProto.
     * Upload file từ URL rồi set làm ảnh group.
     */
    async setGroupPhoto(chatId: string, photoUrl: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);
            const { CustomFile } = require('telegram/client');
            const file = await this.client.uploadFile({
                file: new CustomFile('photo.jpg', 0, photoUrl),
                workers: 1,
            });

            if (entity.className === 'Channel') {
                await this.client.invoke(
                    new Api.channels.EditPhoto({
                        channel: entity,
                        photo: new Api.InputChatUploadedPhoto({ file }),
                    })
                );
            } else {
                const rawId = chatId.startsWith('-') ? chatId.replace('-', '') : chatId;
                const bigIntId = require('big-integer')(rawId);
                await this.client.invoke(
                    new Api.messages.EditChatPhoto({
                        chatId: bigIntId,
                        photo: new Api.InputChatUploadedPhoto({ file }),
                    })
                );
            }

            this.logger.log(`📷 Đã đặt ảnh đại diện cho Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi đặt ảnh đại diện Group ${chatId}: ${msg}`);
            return false;
        }
    }

    /**
     * Xóa ảnh đại diện Group qua MTProto.
     */
    async deleteGroupPhoto(chatId: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            if (entity.className === 'Channel') {
                await this.client.invoke(
                    new Api.channels.EditPhoto({
                        channel: entity,
                        photo: new Api.InputChatPhotoEmpty(),
                    })
                );
            } else {
                const rawId = chatId.startsWith('-') ? chatId.replace('-', '') : chatId;
                const bigIntId = require('big-integer')(rawId);
                await this.client.invoke(
                    new Api.messages.EditChatPhoto({
                        chatId: bigIntId,
                        photo: new Api.InputChatPhotoEmpty(),
                    })
                );
            }

            this.logger.log(`🗑️ Đã xóa ảnh đại diện Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi xóa ảnh Group ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // MIGRATE TO SUPERGROUP (UserBot)
    // ================================================================

    /**
     * Nâng cấp Basic Group → Supergroup.
     * Sau khi migrate, Group cũ sẽ được thay thế bằng Supergroup mới (ID khác).
     * @returns Chat ID mới (dạng -100xxx) hoặc null nếu thất bại
     */
    async migrateToSupergroup(chatId: string): Promise<string | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const rawId = chatId.startsWith('-') ? chatId.replace('-', '') : chatId;
            const bigIntId = require('big-integer')(rawId);

            const result = await this.client.invoke(
                new Api.messages.MigrateChat({ chatId: bigIntId })
            ) as unknown as Api.Updates;

            // Tìm Channel mới trong kết quả
            const channel = result.chats.find((c: any) => c.className === 'Channel') as Api.Channel;
            if (channel) {
                const newChatId = `-100${channel.id.toString()}`;
                this.logger.log(`🔄 Đã migrate Basic Group ${chatId} → Supergroup ${newChatId}`);
                return newChatId;
            }

            this.logger.warn(`⚠️ Migrate thành công nhưng không tìm thấy Channel mới.`);
            return null;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi migrate Group ${chatId}: ${msg}`);
            return null;
        }
    }

    // ================================================================
    // SET GROUP USERNAME (UserBot)
    // ================================================================

    /**
     * Đặt/xóa username công khai cho Supergroup.
     * Truyền username rỗng "" để xóa username (chuyển về private).
     */
    async setGroupUsername(chatId: string, username: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            await this.client.invoke(
                new Api.channels.UpdateUsername({
                    channel: entity,
                    username: username,
                })
            );

            this.logger.log(`🏷️ Đã đặt username "${username || '(xóa)'}" cho Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi đặt username Group ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // TOGGLE SLOW MODE (UserBot)
    // ================================================================

    /**
     * Bật/tắt Slow Mode cho Supergroup.
     * @param seconds Thời gian chờ (giây). 0 = tắt. Giá trị hợp lệ: 0, 10, 30, 60, 300, 900, 3600
     */
    async toggleSlowMode(chatId: string, seconds: number): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            await this.client.invoke(
                new Api.channels.ToggleSlowMode({
                    channel: entity,
                    seconds: seconds,
                })
            );

            const status = seconds === 0 ? 'TẮT' : `BẬT (${seconds}s)`;
            this.logger.log(`⏱️ Slow Mode ${status} cho Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi toggle Slow Mode Group ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // SEND MESSAGE (UserBot)
    // ================================================================

    /**
     * Gửi tin nhắn text qua MTProto UserBot.
     * Khác với Bot API: tin nhắn sẽ hiển thị từ tài khoản UserBot, không phải bot.
     */
    async sendMessage(chatId: string, message: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            await this.client.sendMessage(chatId, { message });
            this.logger.log(`📤 UserBot đã gửi tin nhắn → ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi gửi tin nhắn ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // SEND MEDIA (UserBot)
    // ================================================================

    /**
     * Gửi media (ảnh/video/tài liệu) qua MTProto UserBot.
     * GramJS tự nhận diện loại file từ URL.
     */
    async sendMedia(chatId: string, mediaUrl: string, caption?: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            await this.client.sendFile(chatId, {
                file: mediaUrl,
                caption: caption,
            });
            this.logger.log(`📤 UserBot đã gửi media → ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi gửi media ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // DELETE MESSAGES (UserBot)
    // ================================================================

    /**
     * Xóa tin nhắn qua MTProto UserBot.
     * UserBot có thể xóa tin nhắn của mình hoặc tin người khác (nếu là admin).
     */
    async deleteMessages(chatId: string, messageIds: number[]): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            if (entity.className === 'Channel') {
                await this.client.invoke(
                    new Api.channels.DeleteMessages({
                        channel: entity,
                        id: messageIds,
                    })
                );
            } else {
                await this.client.invoke(
                    new Api.messages.DeleteMessages({
                        id: messageIds,
                        revoke: true, // Xóa cho tất cả mọi người
                    })
                );
            }

            this.logger.log(`🗑️ Đã xóa ${messageIds.length} tin nhắn trong ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi xóa tin nhắn ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // PIN / UNPIN MESSAGE (UserBot)
    // ================================================================

    /**
     * Ghim tin nhắn qua MTProto UserBot.
     * @param silent Ghim im lặng (không thông báo cho members)
     */
    async pinMessage(chatId: string, messageId: number, silent: boolean = false): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            await this.client.invoke(
                new Api.messages.UpdatePinnedMessage({
                    peer: entity,
                    id: messageId,
                    silent: silent,
                })
            );

            this.logger.log(`📌 Đã ghim message ${messageId} trong ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi ghim message ${chatId}: ${msg}`);
            return false;
        }
    }

    /**
     * Bỏ ghim tin nhắn qua MTProto UserBot.
     */
    async unpinMessage(chatId: string, messageId: number): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            await this.client.invoke(
                new Api.messages.UpdatePinnedMessage({
                    peer: entity,
                    id: messageId,
                    unpin: true,
                })
            );

            this.logger.log(`📌 Đã bỏ ghim message ${messageId} trong ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi bỏ ghim message ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // GET MESSAGE HISTORY (UserBot)
    // ================================================================

    /**
     * Lấy lịch sử tin nhắn của chat qua MTProto.
     * Bot API không có API này — chỉ MTProto mới lấy được lịch sử.
     */
    async getMessageHistory(
        chatId: string,
        limit: number = 50,
        offsetId: number = 0,
    ): Promise<Array<Record<string, unknown>> | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            const result = await this.client.invoke(
                new Api.messages.GetHistory({
                    peer: entity,
                    offsetId: offsetId,
                    offsetDate: 0,
                    addOffset: 0,
                    limit: limit,
                    maxId: 0,
                    minId: 0,
                    hash: require('big-integer')(0),
                })
            );

            if (result.className === 'messages.MessagesNotModified') {
                return [];
            }

            const messages = (result as any).messages || [];
            const formatted = messages.map((m: any) => ({
                id: m.id,
                date: m.date,
                message: m.message,
                fromId: m.fromId?.userId?.toString(),
                replyTo: m.replyTo?.replyToMsgId,
                media: m.media ? m.media.className : null,
                pinned: m.pinned || false,
            }));

            this.logger.log(`📜 Lấy ${formatted.length} tin nhắn từ ${chatId}`);
            return formatted;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi lấy lịch sử tin nhắn ${chatId}: ${msg}`);
            return null;
        }
    }

    // ================================================================
    // SEARCH MESSAGES (UserBot)
    // ================================================================

    /**
     * Tìm kiếm tin nhắn trong chat qua MTProto.
     * Bot API không có chức năng tìm kiếm — chỉ MTProto mới có.
     */
    async searchMessages(
        chatId: string,
        query: string,
        limit: number = 20,
    ): Promise<Array<Record<string, unknown>> | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            const result = await this.client.invoke(
                new Api.messages.Search({
                    peer: entity,
                    q: query,
                    filter: new Api.InputMessagesFilterEmpty(),
                    minDate: 0,
                    maxDate: 0,
                    offsetId: 0,
                    addOffset: 0,
                    limit: limit,
                    maxId: 0,
                    minId: 0,
                    hash: require('big-integer')(0),
                })
            );

            const messages = (result as any).messages || [];
            const formatted = messages.map((m: any) => ({
                id: m.id,
                date: m.date,
                message: m.message,
                fromId: m.fromId?.userId?.toString(),
            }));

            this.logger.log(`🔍 Tìm "${query}" trong ${chatId}: ${formatted.length} kết quả`);
            return formatted;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi tìm kiếm tin nhắn ${chatId}: ${msg}`);
            return null;
        }
    }

    // ================================================================
    // FORWARD MESSAGES (UserBot)
    // ================================================================

    /**
     * Chuyển tiếp tin nhắn từ chat này sang chat khác qua MTProto.
     */
    async forwardMessages(
        fromChatId: string,
        toChatId: string,
        messageIds: number[],
    ): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const fromPeer = await this.client.getEntity(fromChatId);
            const toPeer = await this.client.getEntity(toChatId);

            await this.client.invoke(
                new Api.messages.ForwardMessages({
                    fromPeer: fromPeer,
                    toPeer: toPeer,
                    id: messageIds,
                    randomId: messageIds.map(() => require('big-integer')(Math.floor(Math.random() * 1e15))),
                })
            );

            this.logger.log(`↗️ Forward ${messageIds.length} tin: ${fromChatId} → ${toChatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi forward messages: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // GET USER INFO (UserBot)
    // ================================================================

    /**
     * Lấy thông tin chi tiết user qua MTProto.
     * Bot API chỉ lấy được info user đã interact — MTProto lấy được info bất kỳ user.
     */
    async getUserInfo(userId: string): Promise<Record<string, unknown> | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const user = await this.client.getEntity(userId) as Api.User;

            const result = await this.client.invoke(
                new Api.users.GetFullUser({ id: user })
            );

            const fullUser = result.fullUser;
            return {
                id: user.id?.toString(),
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                phone: user.phone,
                isBot: user.bot,
                isVerified: user.verified,
                isRestricted: user.restricted,
                isPremium: user.premium,
                about: fullUser.about,
                commonChatsCount: fullUser.commonChatsCount,
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi lấy thông tin user ${userId}: ${msg}`);
            return null;
        }
    }

    // ================================================================
    // RESTRICT MEMBER (UserBot)
    // ================================================================

    /**
     * Hạn chế quyền thành viên trong Supergroup qua MTProto.
     * Dùng channels.EditBanned với ChatBannedRights tùy chỉnh.
     *
     * @param untilDate Unix timestamp hết hạn. 0 = vĩnh viễn.
     */
    async restrictMember(
        chatId: string,
        userId: string,
        rights: {
            sendMessages?: boolean;
            sendMedia?: boolean;
            sendStickers?: boolean;
            embedLinks?: boolean;
        },
        untilDate: number = 0,
    ): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);
            const user = await this.client.getEntity(userId);

            await this.client.invoke(
                new Api.channels.EditBanned({
                    channel: entity,
                    participant: user,
                    bannedRights: new Api.ChatBannedRights({
                        untilDate: untilDate,
                        sendMessages: rights.sendMessages ?? true,
                        sendMedia: rights.sendMedia ?? true,
                        sendStickers: rights.sendStickers ?? true,
                        sendGifs: rights.sendStickers ?? true,
                        sendGames: rights.sendStickers ?? true,
                        sendInline: rights.sendStickers ?? true,
                        embedLinks: rights.embedLinks ?? true,
                    }),
                })
            );

            this.logger.log(`🔇 Đã restrict user ${userId} trong Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi restrict ${userId} trong ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // DEMOTE ADMIN (UserBot)
    // ================================================================

    /**
     * Hạ quyền admin về member thường qua MTProto.
     * Set tất cả adminRights = false.
     */
    async demoteAdmin(chatId: string, userId: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const channel = await this.client.getEntity(chatId);
            const user = await this.client.getEntity(userId);

            await this.client.invoke(
                new Api.channels.EditAdmin({
                    channel: channel,
                    userId: user,
                    adminRights: new Api.ChatAdminRights({
                        changeInfo: false,
                        postMessages: false,
                        editMessages: false,
                        deleteMessages: false,
                        banUsers: false,
                        inviteUsers: false,
                        pinMessages: false,
                        addAdmins: false,
                        anonymous: false,
                        manageCall: false,
                        manageTopics: false,
                    }),
                    rank: '',
                })
            );

            this.logger.log(`⬇️ Đã hạ quyền admin ${userId} trong Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi demote ${userId} trong ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // REVOKE INVITE LINK (UserBot)
    // ================================================================

    /**
     * Thu hồi (revoke) một invite link — link sẽ không còn hoạt động.
     */
    async revokeInviteLink(chatId: string, link: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            await this.client.invoke(
                new Api.messages.EditExportedChatInvite({
                    peer: entity,
                    link: link,
                    revoked: true,
                })
            );

            this.logger.log(`🔒 Đã thu hồi invite link trong Group ${chatId}`);
            return true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi thu hồi invite link ${chatId}: ${msg}`);
            return false;
        }
    }

    // ================================================================
    // GET ALL INVITE LINKS (UserBot)
    // ================================================================

    /**
     * Lấy tất cả invite links của Group qua MTProto.
     */
    async getAllInviteLinks(chatId: string): Promise<Array<Record<string, unknown>> | null> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return null;
        }

        try {
            const entity = await this.client.getEntity(chatId);
            const me = await this.client.getMe() as Api.User;

            const result = await this.client.invoke(
                new Api.messages.GetExportedChatInvites({
                    peer: entity,
                    adminId: me,
                    limit: 100,
                })
            );

            const invites = (result as Api.messages.ExportedChatInvites).invites || [];
            const formatted = invites.map((inv: any) => ({
                link: inv.link,
                title: inv.title,
                date: inv.date,
                expireDate: inv.expireDate,
                usageLimit: inv.usageLimit,
                usage: inv.usage,
                requestNeeded: inv.requestNeeded,
                revoked: inv.revoked,
            }));

            this.logger.log(`🔗 Lấy ${formatted.length} invite links từ Group ${chatId}`);
            return formatted;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi lấy invite links ${chatId}: ${msg}`);
            return null;
        }
    }

    // ================================================================
    // LEAVE GROUP (UserBot)
    // ================================================================

    /**
     * Rời khỏi Group/Channel qua MTProto.
     * Hỗ trợ cả Basic Group (messages.DeleteChatUser) và Supergroup/Channel (channels.LeaveChannel).
     */
    async leaveGroup(chatId: string): Promise<boolean> {
        if (!this.isConnected) {
            this.logger.error('⚠️ UserBot chưa sẵn sàng. Cần cấu hình TELEGRAM_SESSION_STRING.');
            return false;
        }

        try {
            const entity = await this.client.getEntity(chatId);

            if (entity.className === 'Channel') {
                await this.client.invoke(
                    new Api.channels.LeaveChannel({ channel: entity })
                );
                this.logger.log(`🚪 Đã rời khỏi Supergroup/Channel ${chatId}`);
                return true;
            }

            if (entity.className === 'Chat') {
                const rawId = chatId.startsWith('-') ? chatId.replace('-', '') : chatId;
                const bigIntId = require('big-integer')(rawId);
                await this.client.invoke(
                    new Api.messages.DeleteChatUser({
                        chatId: bigIntId,
                        userId: 'me',
                    })
                );
                this.logger.log(`🚪 Đã rời khỏi Basic Group ${chatId}`);
                return true;
            }

            this.logger.warn(`⚠️ Entity ${chatId} không phải Group hoặc Channel.`);
            return false;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Lỗi rời Group ${chatId}: ${msg}`);
            return false;
        }
    }
}
