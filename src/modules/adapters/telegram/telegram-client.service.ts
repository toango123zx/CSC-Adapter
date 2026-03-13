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
            Logger.error(`Error messag  e: ${error.message}`, 'TelegramClientService')
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
}

