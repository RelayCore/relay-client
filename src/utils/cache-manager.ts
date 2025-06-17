import { Channel, ChannelGroup, Message, Role, ServerInfo, User } from "@/api/server";

interface ServerCache {
    channels: Map<number, Channel>;
    channelGroups: ChannelGroup[];
    users: Map<string, User>;
    roles: Map<string, Role>;
    messages: Map<number, Message[]>; // channelId -> messages
    serverInfo: ServerInfo | null;
}

class CacheManager {
    private serverCaches = new Map<string, ServerCache>(); // userId -> ServerCache
    private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

    private createEmptyServerCache(): ServerCache {
        return {
            channels: new Map(),
            channelGroups: [],
            users: new Map(),
            roles: new Map(),
            messages: new Map(),
            serverInfo: null,
        };
    }

    getServerCache(userId: string): ServerCache {
        if (!this.serverCaches.has(userId)) {
            this.serverCaches.set(userId, this.createEmptyServerCache());
        }
        return this.serverCaches.get(userId)!;
    }

    // Channel Groups
    setChannelGroups(userId: string, groups: ChannelGroup[]) {
        const cache = this.getServerCache(userId);
        cache.channelGroups = groups;

        // Also update individual channels map
        groups.forEach((group) => {
            group.channels.forEach((channel) => {
                cache.channels.set(channel.id, channel);
            });
        });
    }

    getChannelGroups(userId: string): ChannelGroup[] | null {
        return this.getServerCache(userId).channelGroups;
    }

    // Users
    setUsers(userId: string, users: User[]) {
        const cache = this.getServerCache(userId);
        users.forEach((user) => {
            cache.users.set(user.id, user);
        });
    }

    getUsers(userId: string): User[] {
        return Array.from(this.getServerCache(userId).users.values());
    }

    updateUser(userId: string, updatedUser: Partial<User> & { id: string }) {
        const cache = this.getServerCache(userId);
        const existingUser = cache.users.get(updatedUser.id);
        if (existingUser) {
            cache.users.set(updatedUser.id, {
                ...existingUser,
                ...updatedUser,
            });
        }
    }

    // Roles
    setRoles(userId: string, roles: Role[]) {
        const cache = this.getServerCache(userId);
        roles.forEach((role) => {
            cache.roles.set(role.id, role);
        });
    }

    getRoles(userId: string): Role[] {
        return Array.from(this.getServerCache(userId).roles.values());
    }

    // Messages
    setMessages(userId: string, channelId: number, messages: Message[]) {
        const cache = this.getServerCache(userId);
        cache.messages.set(channelId, messages);
    }

    getMessages(userId: string, channelId: number): Message[] | null {
        return this.getServerCache(userId).messages.get(channelId) || null;
    }

    addMessage(userId: string, channelId: number, message: Message) {
        const cache = this.getServerCache(userId);
        const messages = cache.messages.get(channelId) || [];

        // Check if message already exists (avoid duplicates)
        if (!messages.find((m) => m.id === message.id)) {
            messages.push(message);
            // Keep messages sorted by creation date
            messages.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime(),
            );
            cache.messages.set(channelId, messages);
        }
    }

    updateMessage(
        userId: string,
        channelId: number,
        messageId: number,
        updates: Partial<Message>,
    ) {
        const cache = this.getServerCache(userId);
        const messages = cache.messages.get(channelId);
        if (messages) {
            const messageIndex = messages.findIndex((m) => m.id === messageId);
            if (messageIndex !== -1) {
                messages[messageIndex] = {
                    ...messages[messageIndex],
                    ...updates,
                };
            }
        }
    }

    deleteMessage(userId: string, channelId: number, messageId: number) {
        const cache = this.getServerCache(userId);
        const messages = cache.messages.get(channelId);
        if (messages) {
            const filteredMessages = messages.filter((m) => m.id !== messageId);
            cache.messages.set(channelId, filteredMessages);
        }
    }

    // Server Info
    setServerInfo(userId: string, serverInfo: ServerInfo) {
        const cache = this.getServerCache(userId);
        cache.serverInfo = serverInfo;
    }

    getServerInfo(userId: string): ServerInfo | null {
        return this.getServerCache(userId).serverInfo;
    }

    // Channel operations
    addChannel(userId: string, channel: Channel) {
        const cache = this.getServerCache(userId);
        cache.channels.set(channel.id, channel);

        // Update channel groups
        const groups = [...cache.channelGroups];
        const groupIndex = groups.findIndex((g) => g.id === channel.group_id);
        if (groupIndex !== -1) {
            const updatedChannels = [...groups[groupIndex].channels, channel];
            updatedChannels.sort((a, b) => a.position - b.position);
            groups[groupIndex] = {
                ...groups[groupIndex],
                channels: updatedChannels,
            };
            cache.channelGroups = groups;
        }
    }

    deleteChannel(userId: string, channelId: number) {
        const cache = this.getServerCache(userId);
        cache.channels.delete(channelId);
        cache.messages.delete(channelId);

        // Update channel groups
        const groups = cache.channelGroups.map((group) => ({
            ...group,
            channels: group.channels.filter((c) => c.id !== channelId),
        }));
        cache.channelGroups = groups;
    }

    // Clear cache for a server
    clearServerCache(userId: string) {
        this.serverCaches.delete(userId);
    }

    // Clear all caches
    clearAll() {
        this.serverCaches.clear();
    }
}

export const cacheManager = new CacheManager();
