export interface ServerInfo {
    name: string;
    description: string;
    allow_invite: boolean;
    max_users: number;
    current_users: number;
    max_file_size: number;
    max_attachments: number;
    icon: string;
    tenor_enabled: boolean;
}

export interface Channel {
    id: number;
    name: string;
    description: string;
    position: number;
    group_id: number;
    group_name: string;
    is_voice: boolean;
    type?: string;
    permissions?: ChannelPermission[];
    participants: VoiceParticipant[] | null;
    last_message_at?: string;
}

export interface ChannelGroup {
    id: number;
    name: string;
    channels: Channel[];
}

export type AttachmentType = "file" | "image" | "video" | "audio";

export interface Attachment {
    id: number;
    message_id: number;
    type: AttachmentType;
    file_name: string;
    file_size: number;
    file_path: string;
    mime_type: string;
    file_hash: string;
    thumbnail_path?: string;
    created_at: string;
    updated_at: string;
}

export interface TaggedUser {
    user_id: string;
    username: string;
    nickname: string;
}

export interface Message {
    id: number;
    channel_id: number;
    author_id: string;
    username: string;
    content: string;
    created_at: string;
    updated_at: string;
    attachments: Attachment[];
    pinned: boolean;
    tagged_users?: TaggedUser[];
}

export interface MessageSearchResponse {
    id: number;
    channel_id: number;
    channel_name: string;
    author_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    username: string;
    nickname: string;
    attachments: Attachment[];
    pinned: boolean;
}

export interface SearchMessagesRequest {
    query: string;
    channel_id?: number;
    author_id?: string;
    limit?: number;
    offset?: number;
}

// Response interface for deleteMessage
export interface DeleteMessageResponse {
    message: string;
    message_id: number;
    channel_id: number;
}

export interface EditMessageRequest {
    message_id: number;
    content: string;
}

export interface User {
    id: string;
    username: string;
    nickname: string;
    roles: Role[];
    is_online: boolean;
    profile_picture_url?: string;
}

export type Permission =
    // Basic permissions
    | "send_messages"
    | "read_messages"
    | "create_invites"
    | "manage_invites"
    // Channel permissions
    | "create_channels"
    | "delete_channels"
    | "manage_channels"
    | "join_voice"
    | "speak_in_voice"
    | "manage_voice"
    // User management permissions
    | "kick_users"
    | "ban_users"
    | "manage_users"
    | "assign_roles"
    // Server management permissions
    | "manage_server"
    | "manage_roles"
    | "view_audit_log";

export interface Role {
    id: string;
    name: string;
    color: string;
    rank: number;
    permissions: Permission[];
    assignable: boolean;
    display_role_members: boolean;
}

export interface CreateChannelRequest {
    name: string;
    is_voice: boolean;
    description?: string;
    group_id: number;
    position?: number;
}

export interface UpdateChannelRequest {
    channel_id: number;
    group_id?: number;
    name?: string;
    description?: string;
    position?: number;
}

export interface VoiceRoom {
    id: number;
    channel_id: number;
    channel_name: string;
    is_active: boolean;
    participants: VoiceParticipant[];
    created_at: string;
}

export interface VoiceParticipant {
    id: number;
    user_id: string;
    username: string;
    nickname: string;
    is_muted: boolean;
    is_deafened: boolean;
    is_speaking: boolean;
    joined_at: string;
    profile_picture_url?: string;
}

export interface ChannelPermissionRequest {
    channel_id: number;
    user_id?: string;
    role_name?: string;
    can_read?: boolean;
    can_write?: boolean;
    can_pin?: boolean;
    is_admin?: boolean;
}

export interface ChannelPermissionDeleteRequest {
    channel_id: number;
    user_id?: string;
    role_name?: string;
}

export interface ChannelPermission {
    id: number;
    channel_id: number;
    user_id?: string;
    role_name?: string;
    can_read: boolean;
    can_write: boolean;
    can_pin: boolean;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateRoleRequest {
    id: string;
    name: string;
    color: string;
    permissions: Permission[];
    rank: number;
    assignable: boolean;
    display_role_members: boolean;
}

export interface UpdateRoleRequest {
    id: string;
    name?: string;
    color?: string;
    rank?: number;
    permissions?: Permission[];
    display_role_members?: boolean;
}

export interface CreateInviteRequest {
    created_by: string;
    expires_in: number;
    max_uses: number;
}

export interface InviteResponse {
    invite_code: string;
    expires_at?: string;
    max_uses: number;
}

export interface Invite {
    code: string;
    created_by: string;
    created_at: string;
    expires_at?: string;
    max_uses: number;
    uses: number;
}

export interface UploadProfilePictureResponse {
    message: string;
    profile_url: string;
    hash: string;
}

interface ApiRequestOptions {
    method?: string;
    body?: FormData | string;
    headers?: Record<string, string>;
    requiresAuth?: boolean;
}

export interface UpdateServerConfigRequest {
    name?: string;
    description?: string;
    allow_invite?: boolean;
    max_users?: number;
    max_file_size?: number;
    max_attachments?: number;
}

export interface UpdateServerConfigResponse {
    message: string;
    name: string;
    description: string;
    allow_invite: boolean;
    max_users: number;
    max_file_size: number;
    max_attachments: number;
}

async function apiRequest<T>(
    serverUrl: string,
    endpoint: string,
    userId?: string,
    options: ApiRequestOptions = {},
): Promise<T> {
    const { method = "GET", body, headers = {}, requiresAuth = true } = options;
    const requestHeaders: Record<string, string> = { ...headers };

    if (requiresAuth && userId) {
        requestHeaders.Authorization = `Bearer ${userId}`;
    }

    const response = await fetch(`${serverUrl}${endpoint}`, {
        method,
        headers: requestHeaders,
        body,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed: ${response.statusText}`);
    }

    return response.json();
}

// Get server metadata
export async function getServerInfo(serverUrl: string): Promise<ServerInfo> {
    return apiRequest<ServerInfo>(serverUrl, "/server", undefined, {
        requiresAuth: false,
    });
}

// Get all channels and groups
export async function getChannels(
    serverUrl: string,
    userId: string,
): Promise<{ groups: ChannelGroup[] }> {
    return apiRequest<{ groups: ChannelGroup[] }>(
        serverUrl,
        "/channels",
        userId,
    );
}

// Get messages for a channel
export async function getChannelMessages(
    serverUrl: string,
    userId: string,
    channelId: number,
    limit: number = 50,
    offset: number = 0,
): Promise<{ messages: Message[]; count: number }> {
    const endpoint = `/channels/messages?channel_id=${channelId}&limit=${limit}&offset=${offset}`;
    return apiRequest<{ messages: Message[]; count: number }>(
        serverUrl,
        endpoint,
        userId,
    );
}

// Get all users
export async function getUsers(
    serverUrl: string,
    userId: string,
): Promise<{ users: User[]; count: number }> {
    return apiRequest<{ users: User[]; count: number }>(
        serverUrl,
        "/users",
        userId,
    );
}

// Send a message with optional attachments
export async function sendMessageWithAttachments(
    serverUrl: string,
    userId: string,
    channelId: number,
    content: string,
    files?: File[],
): Promise<Message> {
    const formData = new FormData();
    formData.append("channel_id", channelId.toString());
    formData.append("content", content);

    if (files && files.length > 0) {
        files.forEach((file) => {
            formData.append(`attachments`, file);
        });
    }

    return apiRequest<Message>(serverUrl, "/messages/send", userId, {
        method: "POST",
        body: formData,
    });
}

// Delete a message
export async function deleteMessage(
    serverUrl: string,
    userId: string,
    messageId: number,
): Promise<{ message: string; message_id: number; channel_id: number }> {
    const endpoint = `/messages/delete?message_id=${messageId}`;
    return apiRequest<{
        message: string;
        message_id: number;
        channel_id: number;
    }>(serverUrl, endpoint, userId, { method: "DELETE" });
}

export async function editMessage(
    serverUrl: string,
    userId: string,
    messageId: number,
    content: string,
): Promise<Message> {
    return apiRequest<Message>(serverUrl, "/messages/edit", userId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message_id: messageId,
            content: content,
        }),
    });
}

// Create a new channel
export async function createChannel(
    serverUrl: string,
    userId: string,
    request: CreateChannelRequest,
): Promise<Channel> {
    return apiRequest<Channel>(serverUrl, "/channels/create", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
}

// Update a channel
export async function updateChannel(
    serverUrl: string,
    userId: string,
    request: UpdateChannelRequest,
): Promise<Channel> {
    return apiRequest<Channel>(serverUrl, "/channels/update", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
}

export async function deleteChannel(
    serverUrl: string,
    userId: string,
    channelId: number,
): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(
        serverUrl,
        "/channels/delete",
        userId,
        {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel_id: channelId }),
        },
    );
}

// Get attachment URL for display/download
export function getAttachmentUrl(
    serverUrl: string,
    attachment: Attachment,
): string {
    return `${serverUrl}${attachment.file_path}`;
}

// Get thumbnail URL if available
export function getThumbnailUrl(
    serverUrl: string,
    attachment: Attachment,
): string | null {
    if (!attachment.thumbnail_path) return null;
    return `${serverUrl}${attachment.thumbnail_path}`;
}

// Check if attachment is an image
export function isImageAttachment(attachment: Attachment): boolean {
    return attachment.type === "image";
}

// Check if attachment is a video
export function isVideoAttachment(attachment: Attachment): boolean {
    return attachment.type === "video";
}

// Check if attachment is audio
export function isAudioAttachment(attachment: Attachment): boolean {
    return attachment.type === "audio";
}

// Format file size for display
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Helper function to check if user has permission based on their roles
export function hasPermission(
    user: User | null | undefined,
    permission: Permission,
): boolean {
    if (!user) return false;
    return user.roles.some((role) => role.permissions.includes(permission));
}

// Update user nickname
export async function updateUserNickname(
    serverUrl: string,
    userId: string,
    targetUserId: string,
    nickname: string,
): Promise<{ message: string; user: User }> {
    return apiRequest<{ message: string; user: User }>(
        serverUrl,
        "/user/nickname",
        userId,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: targetUserId,
                nickname: nickname,
            }),
        },
    );
}

// Assign role to user
export async function assignRole(
    serverUrl: string,
    userId: string,
    targetUserId: string,
    roleId: string,
): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(serverUrl, "/roles/assign", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: targetUserId,
            role_id: roleId,
        }),
    });
}

// Remove role from user
export async function removeRole(
    serverUrl: string,
    userId: string,
    targetUserId: string,
    roleId: string,
): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(serverUrl, "/roles/remove", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: targetUserId,
            role_id: roleId,
        }),
    });
}

// Get channel permissions
export async function getChannelPermissions(
    serverUrl: string,
    userId: string,
    channelId: number,
): Promise<{ permissions: ChannelPermission[] }> {
    const endpoint = `/channels/permissions?channel_id=${channelId}`;
    return apiRequest<{ permissions: ChannelPermission[] }>(
        serverUrl,
        endpoint,
        userId,
    );
}

// Set channel permission
export async function setChannelPermission(
    serverUrl: string,
    userId: string,
    request: ChannelPermissionRequest,
): Promise<ChannelPermission> {
    return apiRequest<ChannelPermission>(
        serverUrl,
        "/channels/permissions/set",
        userId,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
        },
    );
}

// Delete channel permission
export async function deleteChannelPermission(
    serverUrl: string,
    userId: string,
    request: ChannelPermissionDeleteRequest,
): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(
        serverUrl,
        "/channels/permissions/delete",
        userId,
        {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
        },
    );
}

// Get all roles
export async function getRoles(
    serverUrl: string,
    userId: string,
): Promise<{ roles: Role[] }> {
    const roles = await apiRequest<Role[]>(serverUrl, "/roles/list", userId);
    return { roles };
}

// Helper function to check if user can read a channel
export function canReadChannel(
    channel: Channel,
    user: User | null | undefined,
): boolean {
    if (!user) return false;

    if (!channel.permissions || channel.permissions.length === 0) {
        return true; // No permissions set means public access
    }

    // Check user-specific permissions first (highest priority)
    const userPermission = channel.permissions.find(
        (p) => p.user_id === user.id,
    );
    if (userPermission) {
        return userPermission.can_read;
    }

    // Check role-based permissions
    const userRoleNames = user.roles.map((role) => role.name);
    for (const roleName of userRoleNames) {
        const rolePermission = channel.permissions.find(
            (p) => p.role_name === roleName && !p.user_id,
        );
        if (rolePermission) {
            return rolePermission.can_read;
        }
    }

    // If there are any permissions set but none match the user or their roles,
    // deny access
    return false;
}

// Helper function to check if user can write to a channel
export function canWriteToChannel(
    channel: Channel,
    user: User | null | undefined,
): boolean {
    if (!user) return false;

    if (!channel.permissions || channel.permissions.length === 0) {
        return true; // No permissions set means public access
    }

    // Check user-specific permissions first (highest priority)
    const userPermission = channel.permissions.find(
        (p) => p.user_id === user.id,
    );
    if (userPermission) {
        return userPermission.can_write;
    }

    // Check role-based permissions
    const userRoleNames = user.roles.map((role) => role.name);
    for (const roleName of userRoleNames) {
        const rolePermission = channel.permissions.find(
            (p) => p.role_name === roleName && !p.user_id,
        );
        if (rolePermission) {
            return rolePermission.can_write;
        }
    }

    // If there are any permissions set but none match the user or their roles,
    // deny access
    return false;
}

// Helper function to check if user is admin of a channel
export function isChannelAdmin(
    channel: Channel,
    user: User | null | undefined,
): boolean {
    if (!user) return false;

    if (!channel.permissions || channel.permissions.length === 0) {
        return false;
    }

    // Check user-specific permissions first (highest priority)
    const userPermission = channel.permissions.find(
        (p) => p.user_id === user.id,
    );
    if (userPermission) {
        return userPermission.is_admin;
    }

    // Check role-based permissions
    const userRoleNames = user.roles.map((role) => role.name);
    for (const roleName of userRoleNames) {
        const rolePermission = channel.permissions.find(
            (p) => p.role_name === roleName && !p.user_id,
        );
        if (rolePermission) {
            return rolePermission.is_admin;
        }
    }

    return false;
}

// Upload server icon
export async function uploadServerIcon(
    serverUrl: string,
    userId: string,
    file: File,
): Promise<{ message: string; icon_url: string }> {
    const formData = new FormData();
    formData.append("icon", file);

    return apiRequest<{ message: string; icon_url: string }>(
        serverUrl,
        "/server/icon",
        userId,
        {
            method: "POST",
            body: formData,
        },
    );
}

// Create a new role
export async function createServerRole(
    serverUrl: string,
    userId: string,
    role: CreateRoleRequest,
): Promise<Role> {
    return apiRequest<Role>(serverUrl, "/roles", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role),
    });
}

// Update a role
export async function updateServerRole(
    serverUrl: string,
    userId: string,
    role: UpdateRoleRequest,
): Promise<Role> {
    return apiRequest<Role>(serverUrl, "/roles/update", userId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role),
    });
}

// Delete a role
export async function deleteServerRole(
    serverUrl: string,
    userId: string,
    roleId: string,
): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(serverUrl, "/roles/delete", userId, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: roleId }),
    });
}

// Get invites
export async function getInvites(
    serverUrl: string,
    userId: string,
): Promise<{ invites: Invite[]; count: number }> {
    return apiRequest<{ invites: Invite[]; count: number }>(
        serverUrl,
        "/invites",
        userId,
    );
}

// Create invite
export async function createServerInvite(
    serverUrl: string,
    userId: string,
    request: CreateInviteRequest,
): Promise<InviteResponse> {
    return apiRequest<InviteResponse>(serverUrl, "/create-invite", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
}

// Delete invite
export async function deleteServerInvite(
    serverUrl: string,
    userId: string,
    code: string,
): Promise<{ message: string }> {
    const endpoint = `/invites/delete?code=${code}`;
    return apiRequest<{ message: string }>(serverUrl, endpoint, userId, {
        method: "DELETE",
    });
}

// Pin a message
export async function pinMessage(
    serverUrl: string,
    userId: string,
    messageId: number,
): Promise<{ status: string; message: string }> {
    return apiRequest<{ status: string; message: string }>(
        serverUrl,
        "/messages/pin",
        userId,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message_id: messageId,
            }),
        },
    );
}

// Unpin a message
export async function unpinMessage(
    serverUrl: string,
    userId: string,
    messageId: number,
): Promise<{ status: string; message: string }> {
    return apiRequest<{ status: string; message: string }>(
        serverUrl,
        "/messages/unpin",
        userId,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message_id: messageId,
            }),
        },
    );
}

// Get pinned messages for a channel
export async function getPinnedMessages(
    serverUrl: string,
    userId: string,
    channelId: number,
): Promise<{ pinned_messages: Message[]; count: number }> {
    const endpoint = `/messages/pinned?channel_id=${channelId}`;
    return apiRequest<{ pinned_messages: Message[]; count: number }>(
        serverUrl,
        endpoint,
        userId,
    );
}

// Helper function to check if user can pin messages in a channel
export function canPinInChannel(
    channel: Channel,
    user: User | null | undefined,
): boolean {
    if (!user) return false;

    // Server admins can pin anything
    if (hasPermission(user, "manage_server")) {
        return true;
    }

    // Channel management permission allows pinning
    if (hasPermission(user, "manage_channels")) {
        return true;
    }

    if (!channel.permissions || channel.permissions.length === 0) {
        return false; // No permissions set means no pin access
    }

    // Check user-specific permissions first (highest priority)
    const userPermission = channel.permissions.find(
        (p) => p.user_id === user.id,
    );
    if (userPermission) {
        return userPermission.can_pin;
    }

    // Check role-based permissions
    const userRoleNames = user.roles.map((role) => role.name);
    for (const roleName of userRoleNames) {
        const rolePermission = channel.permissions.find(
            (p) => p.role_name === roleName && !p.user_id,
        );
        if (rolePermission && rolePermission.can_pin) {
            return true;
        }
    }

    return false;
}

export async function uploadProfilePicture(
    serverUrl: string,
    userId: string,
    file: File,
): Promise<UploadProfilePictureResponse> {
    const formData = new FormData();
    formData.append("profile_picture", file);

    return apiRequest<UploadProfilePictureResponse>(
        serverUrl,
        "/user/profile-picture",
        userId,
        {
            method: "POST",
            body: formData,
        },
    );
}

export async function searchMessages(
    serverUrl: string,
    userId: string,
    request: SearchMessagesRequest,
): Promise<{
    messages: MessageSearchResponse[];
    count: number;
    query: string;
}> {
    const params = new URLSearchParams();
    params.append("q", request.query);

    if (request.channel_id !== undefined) {
        params.append("channel_id", request.channel_id.toString());
    }

    if (request.author_id) {
        params.append("author_id", request.author_id);
    }

    if (request.limit !== undefined) {
        params.append("limit", request.limit.toString());
    }

    if (request.offset !== undefined) {
        params.append("offset", request.offset.toString());
    }

    const endpoint = `/messages/search?${params.toString()}`;
    return apiRequest<{
        messages: MessageSearchResponse[];
        count: number;
        query: string;
    }>(serverUrl, endpoint, userId);
}

// Leave server
export async function leaveServer(
    serverUrl: string,
    userId: string,
): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(serverUrl, "/user/leave", userId, {
        method: "POST",
    });
}

// Update server configuration
export async function updateServerConfig(
    serverUrl: string,
    userId: string,
    config: UpdateServerConfigRequest,
): Promise<UpdateServerConfigResponse> {
    return apiRequest<UpdateServerConfigResponse>(
        serverUrl,
        "/server/config",
        userId,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
        },
    );
}

// Tenor API Types
export interface TenorMediaFormat {
    url: string;
    dims: [number, number];
    duration?: number;
    size?: number;
}

export interface TenorGifResult {
    id: string;
    title: string;
    content_description: string;
    created: number;
    itemurl: string;
    url: string;
    tags: string[];
    media_formats: Record<string, TenorMediaFormat>;
    hasaudio: boolean;
    hascaption: boolean;
    flags: string[];
    bg_color: string;
}

export interface TenorSearchResponse {
    results: TenorGifResult[];
    next: string;
}

export interface TenorTrendingResponse {
    results: TenorGifResult[];
    next: string;
}

export interface TenorCategoriesResponse {
    categories: string[];
}

export async function tenorSearch(
    serverUrl: string,
    userId: string,
    query: string,
    options?: {
        limit?: number;
        locale?: string;
        contentfilter?: string;
        pos?: string;
    },
): Promise<TenorSearchResponse> {
    const params = new URLSearchParams();
    params.append("q", query);
    if (options?.limit !== undefined)
        params.append("limit", options.limit.toString());
    if (options?.locale) params.append("locale", options.locale);
    if (options?.contentfilter)
        params.append("contentfilter", options.contentfilter);
    if (options?.pos) params.append("pos", options.pos);

    const endpoint = `/tenor/search?${params.toString()}`;
    return apiRequest<TenorSearchResponse>(serverUrl, endpoint, userId, {
        method: "GET",
    });
}

export async function tenorTrending(
    serverUrl: string,
    userId: string,
    options?: {
        limit?: number;
        pos?: string;
    },
): Promise<TenorTrendingResponse> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined)
        params.append("limit", options.limit.toString());
    if (options?.pos) params.append("pos", options.pos);

    const endpoint = `/tenor/trending?${params.toString()}`;
    return apiRequest<TenorTrendingResponse>(serverUrl, endpoint, userId, {
        method: "GET",
    });
}

export async function tenorCategories(
    serverUrl: string,
    userId: string,
): Promise<TenorCategoriesResponse> {
    const endpoint = `/tenor/categories`;
    return apiRequest<TenorCategoriesResponse>(serverUrl, endpoint, userId, {
        method: "GET",
    });
}
