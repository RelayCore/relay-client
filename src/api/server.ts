export interface ServerInfo {
    name: string;
    description: string;
    allow_invite: boolean;
    max_users: number;
    current_users: number;
    max_file_size: number;
    max_attachments: number;
    icon: string;
}

export interface Channel {
    id: number;
    name: string;
    description: string;
    position: number;
    group_id: number;
    group_name: string;
    is_voice: boolean;
    permissions?: ChannelPermission[];
    participants: VoiceParticipant[] | null;
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

export interface Message {
    id: number;
    channel_id: number;
    author_id: string;
    username: string;
    content: string;
    created_at: string;
    attachments: Attachment[];
    pinned: boolean;
}

// Response interface for deleteMessage
export interface DeleteMessageResponse {
    message: string;
    message_id: number;
    channel_id: number;
}

export interface User {
    id: string;
    username: string;
    nickname: string;
    roles: Role[];
    is_online: boolean;
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

// Get server metadata
export async function getServerInfo(serverUrl: string): Promise<ServerInfo> {
    const response = await fetch(`${serverUrl}/server`);
    if (!response.ok) {
        throw new Error(`Failed to fetch server info: ${response.statusText}`);
    }
    return response.json();
}

// Get all channels and groups
export async function getChannels(
    serverUrl: string,
    userId: string,
): Promise<{ groups: ChannelGroup[] }> {
    const response = await fetch(`${serverUrl}/channels`, {
        headers: {
            Authorization: `Bearer ${userId}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch channels: ${response.statusText}`);
    }
    return response.json();
}

// Get messages for a channel
export async function getChannelMessages(
    serverUrl: string,
    userId: string,
    channelId: number,
    limit: number = 50,
    offset: number = 0,
): Promise<{ messages: Message[]; count: number }> {
    const response = await fetch(
        `${serverUrl}/channels/messages?channel_id=${channelId}&limit=${limit}&offset=${offset}`,
        {
            headers: {
                Authorization: `Bearer ${userId}`,
            },
        },
    );
    if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }
    return response.json();
}

// Get all users
export async function getUsers(
    serverUrl: string,
    userId: string,
): Promise<{ users: User[]; count: number }> {
    const response = await fetch(`${serverUrl}/users`, {
        headers: {
            Authorization: `Bearer ${userId}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    return response.json();
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

    const response = await fetch(`${serverUrl}/messages/send`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${userId}`,
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
    }
    return response.json();
}

// Delete a message
export async function deleteMessage(
    serverUrl: string,
    userId: string,
    messageId: number,
): Promise<{ message: string; message_id: number; channel_id: number }> {
    const response = await fetch(
        `${serverUrl}/messages/delete?message_id=${messageId}`,
        {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${userId}`,
            },
        },
    );

    if (!response.ok) {
        throw new Error(`Failed to delete message: ${response.statusText}`);
    }
    return response.json();
}

// Create a new channel
export async function createChannel(
    serverUrl: string,
    userId: string,
    request: CreateChannelRequest,
): Promise<Channel> {
    const response = await fetch(`${serverUrl}/channels/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create channel");
    }

    return response.json();
}

// Update a channel
export async function updateChannel(
    serverUrl: string,
    userId: string,
    request: UpdateChannelRequest,
): Promise<Channel> {
    const response = await fetch(`${serverUrl}/channels/update`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update channel");
    }

    return response.json();
}

export async function deleteChannel(
    serverUrl: string,
    userId: string,
    channelId: number,
): Promise<{ message: string }> {
    const response = await fetch(`${serverUrl}/channels/delete`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({ channel_id: channelId }),
    });

    if (!response.ok) {
        throw new Error(`Failed to delete channel: ${response.statusText}`);
    }
    return response.json();
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
    const response = await fetch(`${serverUrl}/user/nickname`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
            user_id: targetUserId,
            nickname: nickname,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update nickname");
    }

    return response.json();
}

// Assign role to user
export async function assignRole(
    serverUrl: string,
    userId: string,
    targetUserId: string,
    roleId: string,
): Promise<{ message: string }> {
    const response = await fetch(`${serverUrl}/roles/assign`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
            user_id: targetUserId,
            role_id: roleId,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to assign role");
    }

    return response.json();
}

// Remove role from user
export async function removeRole(
    serverUrl: string,
    userId: string,
    targetUserId: string,
    roleId: string,
): Promise<{ message: string }> {
    const response = await fetch(`${serverUrl}/roles/remove`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
            user_id: targetUserId,
            role_id: roleId,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to remove role");
    }

    return response.json();
}

// Get channel permissions
export async function getChannelPermissions(
    serverUrl: string,
    userId: string,
    channelId: number,
): Promise<{ permissions: ChannelPermission[] }> {
    const response = await fetch(
        `${serverUrl}/channels/permissions?channel_id=${channelId}`,
        {
            headers: {
                Authorization: `Bearer ${userId}`,
            },
        },
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch channel permissions: ${response.statusText}`,
        );
    }

    return response.json();
}

// Set channel permission
export async function setChannelPermission(
    serverUrl: string,
    userId: string,
    request: ChannelPermissionRequest,
): Promise<ChannelPermission> {
    const response = await fetch(`${serverUrl}/channels/permissions/set`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to set channel permission");
    }

    return response.json();
}

// Delete channel permission
export async function deleteChannelPermission(
    serverUrl: string,
    userId: string,
    request: ChannelPermissionDeleteRequest,
): Promise<{ message: string }> {
    const response = await fetch(`${serverUrl}/channels/permissions/delete`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete channel permission");
    }

    return response.json();
}

// Get all roles
export async function getRoles(
    serverUrl: string,
    userId: string,
): Promise<{ roles: Role[] }> {
    const response = await fetch(`${serverUrl}/roles/list`, {
        headers: {
            Authorization: `Bearer ${userId}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.statusText}`);
    }

    const roles = await response.json();
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

    const response = await fetch(`${serverUrl}/server/icon`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${userId}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to upload server icon");
    }

    return response.json();
}

// Create a new role
export async function createServerRole(
    serverUrl: string,
    userId: string,
    role: CreateRoleRequest,
): Promise<Role> {
    const response = await fetch(`${serverUrl}/roles`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(role),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create role");
    }

    return response.json();
}

// Get invites
export async function getInvites(
    serverUrl: string,
    userId: string,
): Promise<{ invites: Invite[]; count: number }> {
    const response = await fetch(`${serverUrl}/invites`, {
        headers: {
            Authorization: `Bearer ${userId}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch invites: ${response.statusText}`);
    }

    return response.json();
}

// Create invite
export async function createServerInvite(
    serverUrl: string,
    userId: string,
    request: CreateInviteRequest,
): Promise<InviteResponse> {
    const response = await fetch(`${serverUrl}/create-invite`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create invite");
    }

    return response.json();
}

// Delete invite
export async function deleteServerInvite(
    serverUrl: string,
    userId: string,
    code: string,
): Promise<{ message: string }> {
    const response = await fetch(`${serverUrl}/invites/delete?code=${code}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${userId}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete invite");
    }

    return response.json();
}

// Pin a message
export async function pinMessage(
    serverUrl: string,
    userId: string,
    messageId: number,
): Promise<{ status: string; message: string }> {
    const response = await fetch(`${serverUrl}/messages/pin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
            message_id: messageId,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to pin message");
    }

    return response.json();
}

// Unpin a message
export async function unpinMessage(
    serverUrl: string,
    userId: string,
    messageId: number,
): Promise<{ status: string; message: string }> {
    const response = await fetch(`${serverUrl}/messages/unpin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
            message_id: messageId,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to unpin message");
    }

    return response.json();
}

// Get pinned messages for a channel
export async function getPinnedMessages(
    serverUrl: string,
    userId: string,
    channelId: number,
): Promise<{ pinned_messages: Message[]; count: number }> {
    const response = await fetch(
        `${serverUrl}/messages/pinned?channel_id=${channelId}`,
        {
            headers: {
                Authorization: `Bearer ${userId}`,
            },
        },
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch pinned messages: ${response.statusText}`,
        );
    }

    return response.json();
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

    const response = await fetch(`${serverUrl}/user/profile-picture`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${userId}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to upload profile picture");
    }

    return response.json();
}
