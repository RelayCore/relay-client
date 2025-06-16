import React from "react";
import {
    ChannelGroup,
    User,
    Role,
    ServerInfo,
    getChannels,
    getUsers,
    getRoles,
    Channel,
    leaveServer as apiLeaveServer,
} from "@/api/server";
import {
    getServerById,
    ServerRecord,
    removeServer,
} from "@/storage/server-store";
import {
    MESSAGE_TYPES,
    OnlineUsersData,
    UserStatusData,
    webSocketManager,
    WebSocketMessage,
} from "@/websocket/websocket-manager";
import { toast } from "sonner";

interface ServerContextState {
    // Server data
    serverRecord: ServerRecord | null;
    serverInfo: ServerInfo | null;
    channelGroups: ChannelGroup[];
    users: User[];
    roles: Role[];

    // UI state
    selectedChannelId: number | null;
    selectedVoiceChannelId: number | null;
    showMembers: boolean;

    // Loading states
    loading: boolean;
    error: Error | null;

    // Actions
    setSelectedChannelId: (channelId: number | null) => void;
    setSelectedVoiceChannelId: (channelId: number | null) => void;
    toggleMemberList: () => void;
    refreshServerData: () => Promise<void>;
    clearServerStatusCache: () => void;
    leaveCurrentServer: () => Promise<void>;
    getSelectedChannel: () => Channel | null;
    getSelectedVoiceChannel: () => Channel | null;
    getUserById: (userId: string) => User | null;
}

const ServerContext = React.createContext<ServerContextState | null>(null);

interface ServerProviderProps {
    children: React.ReactNode;
    userId?: string;
}

export function ServerProvider({ children, userId }: ServerProviderProps) {
    const [serverRecord, setServerRecord] = React.useState<ServerRecord | null>(
        null,
    );
    const [channelGroups, setChannelGroups] = React.useState<ChannelGroup[]>(
        [],
    );
    const [users, setUsers] = React.useState<User[]>([]);
    const [roles, setRoles] = React.useState<Role[]>([]);
    const [selectedChannelId, setSelectedChannelId] = React.useState<
        number | null
    >(null);
    const [selectedVoiceChannelId, setSelectedVoiceChannelId] = React.useState<
        number | null
    >(null);
    const [showMembers, setShowMembers] = React.useState(true);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    // Derive server info from server record and cached metadata
    const serverInfo = React.useMemo((): ServerInfo | null => {
        if (!serverRecord || !userId) return null;

        // Try to get cached metadata first
        try {
            const cached = localStorage.getItem("server-status-cache");
            if (cached) {
                const parsedCache = JSON.parse(cached);
                const serverStatus = parsedCache[userId];
                if (serverStatus?.metadata) {
                    const meta = serverStatus.metadata;
                    return {
                        name:
                            meta.name ||
                            serverRecord.server_name ||
                            "Unknown Server",
                        description:
                            meta.description ||
                            serverRecord.server_description ||
                            "",
                        allow_invite:
                            meta.allow_invite ??
                            serverRecord.server_allow_invite ??
                            false,
                        max_users:
                            meta.max_users ||
                            serverRecord.server_max_users ||
                            100,
                        icon: meta.icon || serverRecord.server_icon || "",
                        current_users: meta.current_users || 0,
                        max_file_size: meta.max_file_size || 0,
                        max_attachments: meta.max_attachments || 0,
                    };
                }
            }
        } catch {
            // Fall back to server record data
        }

        return {
            name: serverRecord.server_name || "Unknown Server",
            description: serverRecord.server_description || "",
            allow_invite: serverRecord.server_allow_invite || false,
            max_users: serverRecord.server_max_users || 100,
            icon: serverRecord.server_icon || "",
            current_users: 0,
            max_file_size: 0,
            max_attachments: 0,
        };
    }, [serverRecord, userId]);

    // Clear server status cache for this server
    const clearServerStatusCache = React.useCallback(() => {
        if (!userId) return;

        try {
            const cached = localStorage.getItem("server-status-cache");
            if (cached) {
                const parsedCache = JSON.parse(cached);
                delete parsedCache[userId];
                localStorage.setItem(
                    "server-status-cache",
                    JSON.stringify(parsedCache),
                );
                console.log(`Cleared server status cache for: ${userId}`);
            }
        } catch (error) {
            console.warn("Failed to clear server status cache:", error);
        }
    }, [userId]);

    // Fetch server data
    const refreshServerData = React.useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);
            setError(null);

            // Get server record from local storage
            const record = await getServerById(userId);
            setServerRecord(record);

            // Fetch channels
            const channelsResponse = await getChannels(
                record.server_url,
                userId,
            );
            setChannelGroups(channelsResponse.groups);

            // Select first channel if none selected
            if (!selectedChannelId && channelsResponse.groups.length > 0) {
                const firstChannel = channelsResponse.groups[0]?.channels[0];
                if (firstChannel) {
                    setSelectedChannelId(firstChannel.id);
                }
            }

            // Fetch users
            const usersResponse = await getUsers(record.server_url, userId);
            setUsers(usersResponse.users);

            // Fetch roles
            const rolesResponse = await getRoles(record.server_url, userId);
            setRoles(rolesResponse.roles);
        } catch (err) {
            setError(
                err instanceof Error ? err : new Error("Failed to load server"),
            );
        } finally {
            setLoading(false);
        }
    }, [userId, selectedChannelId]);

    // Load data when userId changes
    React.useEffect(() => {
        refreshServerData();
    }, [refreshServerData]);

    const toggleMemberList = React.useCallback(() => {
        setShowMembers((prev) => !prev);
    }, []);

    // Helper function to get current selected channel
    const getSelectedChannel = React.useCallback(() => {
        if (!selectedChannelId) return null;

        for (const group of channelGroups) {
            const channel = group.channels.find(
                (c) => c.id === selectedChannelId,
            );
            if (channel) return channel;
        }
        return null;
    }, [selectedChannelId, channelGroups]);

    // Helper function to get current selected voice channel
    const getSelectedVoiceChannel = React.useCallback(() => {
        if (!selectedVoiceChannelId) return null;

        for (const group of channelGroups) {
            const channel = group.channels.find(
                (c) => c.id === selectedVoiceChannelId,
            );
            if (channel) return channel;
        }
        return null;
    }, [selectedVoiceChannelId, channelGroups]);

    // Helper function to get user by ID
    const getUserById = React.useCallback(
        (userId: string) => {
            return users.find((user) => user.id === userId) || null;
        },
        [users],
    );

    // Add WebSocket message handler for user status updates
    React.useEffect(() => {
        if (!userId) return;

        const handleMessage = (message: WebSocketMessage) => {
            switch (message.type) {
                case MESSAGE_TYPES.USER_STATUS: {
                    const statusData = message.data as UserStatusData;
                    // Update user online status
                    setUsers((prevUsers) =>
                        prevUsers.map((user) =>
                            user.id === statusData.user_id
                                ? {
                                      ...user,
                                      is_online: statusData.status === "online",
                                  }
                                : user,
                        ),
                    );
                    break;
                }
                case MESSAGE_TYPES.ONLINE_USERS: {
                    const onlineData = message.data as OnlineUsersData;
                    // Update all users' online status based on the list
                    setUsers((prevUsers) =>
                        prevUsers.map((user) => ({
                            ...user,
                            is_online: onlineData.online_users.includes(
                                user.id,
                            ),
                        })),
                    );
                    break;
                }
            }
        };

        webSocketManager.addMessageHandler(userId, handleMessage);

        return () => {
            webSocketManager.removeMessageHandler(userId, handleMessage);
        };
    }, [userId]);

    // Leave current server
    const leaveCurrentServer = React.useCallback(async () => {
        if (!userId || !serverRecord) return;

        try {
            // Try to leave gracefully
            await apiLeaveServer(serverRecord.server_url, userId);
            toast.success("Successfully left the server");
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes("Cannot leave server: you are the owner")
            ) {
                toast.error("Cannot leave server: you are the owner");
                return;
            }
            toast.warning("Failed to notify server, but removed locally");
        }

        // Disconnect websocket
        webSocketManager.disconnect(userId);

        // Remove from local storage
        await removeServer(serverRecord.server_url, userId);

        // Clear server status cache
        clearServerStatusCache();

        // Navigate back to home
        window.location.href = "/";
    }, [userId, serverRecord, clearServerStatusCache]);

    const contextValue: ServerContextState = {
        serverRecord,
        serverInfo,
        channelGroups,
        users,
        roles,
        selectedChannelId,
        selectedVoiceChannelId,
        showMembers,
        loading,
        error,
        setSelectedChannelId,
        setSelectedVoiceChannelId,
        toggleMemberList,
        refreshServerData,
        clearServerStatusCache,
        leaveCurrentServer,
        getSelectedChannel,
        getSelectedVoiceChannel,
        getUserById,
    };

    return (
        <ServerContext.Provider value={contextValue}>
            {children}
        </ServerContext.Provider>
    );
}

export function useServer() {
    const context = React.useContext(ServerContext);
    if (!context) {
        throw new Error("useServer must be used within a ServerProvider");
    }
    return context;
}

export function useServerInfo() {
    const { serverInfo, loading, error } = useServer();
    return { serverInfo, loading, error };
}

export function useChannels() {
    const {
        channelGroups,
        selectedChannelId,
        selectedVoiceChannelId,
        setSelectedChannelId,
        setSelectedVoiceChannelId,
        refreshServerData,
        getSelectedChannel,
        getSelectedVoiceChannel,
    } = useServer();
    return {
        channelGroups,
        selectedChannelId,
        selectedVoiceChannelId,
        setSelectedChannelId,
        setSelectedVoiceChannelId,
        refreshServerData,
        getSelectedChannel,
        getSelectedVoiceChannel,
    };
}

export function useMembers() {
    const { users, roles, showMembers, toggleMemberList, getUserById } =
        useServer();
    return { users, roles, showMembers, toggleMemberList, getUserById };
}

export function useServerRecord() {
    const { serverRecord } = useServer();
    return serverRecord;
}
