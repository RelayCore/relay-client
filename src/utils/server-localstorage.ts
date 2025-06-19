import { logError } from "@/utils/logger";

interface ChannelInfo {
    id: number;
    lastVisited: string;
    lastMessageAt?: string;
}

interface ServerChannelData {
    [serverId: string]: {
        [channelId: string]: ChannelInfo;
    };
}

const STORAGE_KEY = "server-channel-data";

export function getChannelInfo(
    serverId: string,
    channelId: number,
): ChannelInfo | null {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return null;

        const parsed: ServerChannelData = JSON.parse(data);
        return parsed[serverId]?.[channelId.toString()] || null;
    } catch (error) {
        logError("Error reading channel info from localStorage", "cache", String(error));
        return null;
    }
}

export function setChannelInfo(
    serverId: string,
    channelId: number,
    info: Partial<ChannelInfo>,
): void {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        const parsed: ServerChannelData = data ? JSON.parse(data) : {};

        if (!parsed[serverId]) {
            parsed[serverId] = {};
        }

        const existing = parsed[serverId][channelId.toString()] || {
            id: channelId,
            lastVisited: "",
        };
        parsed[serverId][channelId.toString()] = {
            ...existing,
            ...info,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (error) {
        logError("Error saving channel info to localStorage", "cache", String(error));
    }
}

export function getAllChannelInfo(
    serverId: string,
): Record<string, ChannelInfo> {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return {};

        const parsed: ServerChannelData = JSON.parse(data);
        return parsed[serverId] || {};
    } catch (error) {
        logError("Error reading server channel data from localStorage", "cache", String(error));
        return {};
    }
}

export function removeChannelInfo(serverId: string, channelId: number): void {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return;

        const parsed: ServerChannelData = JSON.parse(data);
        if (parsed[serverId]) {
            delete parsed[serverId][channelId.toString()];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
    } catch (error) {
        logError("Error removing channel info from localStorage", "cache", String(error));
    }
}

export function clearServerChannelData(serverId: string): void {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return;

        const parsed: ServerChannelData = JSON.parse(data);
        delete parsed[serverId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (error) {
        logError("Error clearing server channel data from localStorage", "cache", String(error));
    }
}

// Helper function to check if a channel is unread
export function isChannelUnread(
    serverId: string,
    channelId: number,
    channelLastMessageAt?: string,
): boolean {
    if (!channelLastMessageAt) return false;

    const channelInfo = getChannelInfo(serverId, channelId);
    if (!channelInfo || !channelInfo.lastVisited) return true;

    const lastVisited = new Date(channelInfo.lastVisited);
    const lastMessageAt = new Date(channelLastMessageAt);

    return lastMessageAt > lastVisited;
}

// Helper function to mark a channel as read
export function markChannelAsRead(serverId: string, channelId: number): void {
    setChannelInfo(serverId, channelId, {
        lastVisited: new Date().toISOString(),
    });
}

// Helper function to update last message timestamp
export function updateChannelLastMessage(
    serverId: string,
    channelId: number,
    messageTimestamp: string,
): void {
    setChannelInfo(serverId, channelId, {
        lastMessageAt: messageTimestamp,
    });
}
