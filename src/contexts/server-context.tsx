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
    Message,
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
    ChannelUpdateBroadcast,
    RoleCreatedBroadcast,
    ChannelDeletedBroadcast,
    ChannelCreatedBroadcast,
    GroupCreatedBroadcast,
    RoleDeletedBroadcast,
    RoleAssignedBroadcast,
    RoleRemovedBroadcast,
    UserUpdatedBroadcast,
    UserProfileUpdatedBroadcast,
    UserLeftBroadcast,
    ServerIconUpdatedBroadcast,
    ServerConfigUpdatedBroadcast,
} from "@/websocket/websocket-manager";
import { toast } from "sonner";
import {
    isChannelUnread,
    updateChannelLastMessage,
} from "@/utils/server-localstorage";

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
    setChannelGroups: (groups: ChannelGroup[]) => void;
    toggleMemberList: () => void;
    refreshServerData: () => Promise<void>;
    clearServerStatusCache: () => void;
    leaveCurrentServer: () => Promise<void>;
    getSelectedChannel: () => Channel | null;
    getSelectedVoiceChannel: () => Channel | null;
    getUserById: (userId: string) => User | null;
    isChannelUnread: (channelId: number) => boolean;
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

    const updateServerStatusCache = React.useCallback(
        (updates: Partial<ServerInfo>) => {
            if (!userId) return;

            try {
                const cached = localStorage.getItem("server-status-cache");
                const parsedCache = cached ? JSON.parse(cached) : {};

                if (!parsedCache[userId]) {
                    parsedCache[userId] = { metadata: {} };
                }

                Object.assign(parsedCache[userId].metadata, updates);

                localStorage.setItem(
                    "server-status-cache",
                    JSON.stringify(parsedCache),
                );
            } catch (error) {
                console.warn("Failed to update server status cache:", error);
            }
        },
        [userId],
    );

    const isChannelUnreadHelper = React.useCallback(
        (channelId: number) => {
            if (!serverRecord?.server_url) return false;

            // Find the channel to get its last_message_at
            let channel: Channel | null = null;
            for (const group of channelGroups) {
                const foundChannel = group.channels.find(
                    (c) => c.id === channelId,
                );
                if (foundChannel) {
                    channel = foundChannel;
                    break;
                }
            }

            if (!channel || !channel.last_message_at) return false;

            return isChannelUnread(
                serverRecord.server_url,
                channelId,
                channel.last_message_at,
            );
        },
        [serverRecord?.server_url, channelGroups],
    );

    // Add WebSocket message handler for user status updates and channel updates
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

                case MESSAGE_TYPES.MESSAGE_BROADCAST: {
                    const messageData = message.data as Message & {
                        channel_id: number;
                    };

                    // Update the channel's last_message_at timestamp
                    setChannelGroups((prevGroups) =>
                        prevGroups.map((group) => ({
                            ...group,
                            channels: group.channels.map((channel) =>
                                channel.id === messageData.channel_id
                                    ? {
                                          ...channel,
                                          last_message_at:
                                              messageData.created_at,
                                      }
                                    : channel,
                            ),
                        })),
                    );

                    // Update localStorage with the new message timestamp
                    if (serverRecord?.server_url) {
                        updateChannelLastMessage(
                            serverRecord.server_url,
                            messageData.channel_id,
                            messageData.created_at,
                        );
                    }

                    break;
                }

                case MESSAGE_TYPES.GROUP_CREATED: {
                    const groupData = message.data as GroupCreatedBroadcast;
                    setChannelGroups((prevGroups) => [
                        ...prevGroups,
                        {
                            id: groupData.id,
                            name: groupData.name,
                            channels: [],
                        },
                    ]);
                    toast.success(`New group "${groupData.name}" created`);
                    break;
                }

                case MESSAGE_TYPES.CHANNEL_CREATED: {
                    const channelData = message.data as ChannelCreatedBroadcast;
                    setChannelGroups((prevGroups) =>
                        prevGroups.map((group) => {
                            if (group.id === channelData.group_id) {
                                const newChannel: Channel = {
                                    id: channelData.id,
                                    name: channelData.name,
                                    description: channelData.description,
                                    group_id: channelData.group_id,
                                    group_name: channelData.group_name,
                                    position: channelData.position,
                                    type: channelData.type,
                                    is_voice: channelData.is_voice,
                                    permissions: [],
                                    participants: [],
                                };

                                // Insert channel in correct position
                                const updatedChannels = [
                                    ...group.channels,
                                    newChannel,
                                ];
                                updatedChannels.sort(
                                    (a, b) => a.position - b.position,
                                );

                                return { ...group, channels: updatedChannels };
                            }
                            return group;
                        }),
                    );
                    toast.success(`New channel "${channelData.name}" created`);
                    break;
                }

                case MESSAGE_TYPES.CHANNEL_DELETED: {
                    const deleteData = message.data as ChannelDeletedBroadcast;
                    // Clear selection if deleted channel was selected
                    if (selectedChannelId === deleteData.channel_id) {
                        setSelectedChannelId(null);
                    }
                    if (selectedVoiceChannelId === deleteData.channel_id) {
                        setSelectedVoiceChannelId(null);
                    }

                    setChannelGroups((prevGroups) =>
                        prevGroups.map((group) => ({
                            ...group,
                            channels: group.channels.filter(
                                (channel) =>
                                    channel.id !== deleteData.channel_id,
                            ),
                        })),
                    );
                    toast.info("Channel deleted");
                    break;
                }

                case MESSAGE_TYPES.CHANNEL_UPDATE: {
                    const updates = (message.data as ChannelUpdateBroadcast)
                        .channels;
                    console.log(
                        "Processing channel updates in context:",
                        updates,
                    );

                    setChannelGroups((prevGroups) => {
                        // Create a map of updates for quick lookup
                        const updateMap = new Map(
                            updates.map((update) => [update.id, update]),
                        );

                        // Update all channels with their new properties
                        const updatedGroups = prevGroups.map((group) => ({
                            ...group,
                            channels: group.channels.map((channel) => {
                                const update = updateMap.get(channel.id);
                                if (update) {
                                    return {
                                        ...channel,
                                        group_id: update.group_id,
                                        position: update.position,
                                        name: update.name || channel.name,
                                        description:
                                            update.description ||
                                            channel.description,
                                    };
                                }
                                return channel;
                            }),
                        }));

                        // Redistribute channels based on their group_id
                        const finalGroups = updatedGroups.map((group) => {
                            // Collect all channels that should belong to this group
                            const channelsForGroup: Channel[] = [];

                            updatedGroups.forEach((sourceGroup) => {
                                sourceGroup.channels.forEach((channel) => {
                                    if (channel.group_id === group.id) {
                                        channelsForGroup.push(channel);
                                    }
                                });
                            });

                            // Sort channels by position
                            channelsForGroup.sort(
                                (a, b) => a.position - b.position,
                            );

                            return {
                                ...group,
                                channels: channelsForGroup,
                            };
                        });

                        return finalGroups;
                    });
                    break;
                }

                case MESSAGE_TYPES.ROLE_CREATED: {
                    const roleData = message.data as RoleCreatedBroadcast;
                    const newRole: Role = {
                        id: roleData.id,
                        name: roleData.name,
                        color: roleData.color,
                        rank: roleData.rank,
                        permissions: roleData.permissions,
                        assignable: roleData.assignable,
                        display_role_members: roleData.display_role_members,
                    };

                    setRoles((prevRoles) => {
                        const updatedRoles = [...prevRoles, newRole];
                        // Sort by rank
                        updatedRoles.sort((a, b) => b.rank - a.rank);
                        return updatedRoles;
                    });
                    toast.success(`New role "${roleData.name}" created`);
                    break;
                }

                case MESSAGE_TYPES.ROLE_UPDATED: {
                    const roleData = message.data as Role;
                    setRoles((prevRoles) => {
                        const updatedRoles = prevRoles.map((role) =>
                            role.id === roleData.id
                                ? {
                                      id: roleData.id,
                                      name: roleData.name,
                                      color: roleData.color,
                                      rank: roleData.rank,
                                      permissions: roleData.permissions,
                                      assignable: roleData.assignable,
                                      display_role_members:
                                          roleData.display_role_members,
                                  }
                                : role,
                        );
                        // Sort by rank
                        updatedRoles.sort((a, b) => b.rank - a.rank);
                        return updatedRoles;
                    });
                    toast.success(`Role "${roleData.name}" updated`);
                    break;
                }

                case MESSAGE_TYPES.ROLE_DELETED: {
                    const deleteData = message.data as RoleDeletedBroadcast;
                    setRoles((prevRoles) =>
                        prevRoles.filter(
                            (role) => role.id !== deleteData.role_id,
                        ),
                    );
                    // Remove role from all users
                    setUsers((prevUsers) =>
                        prevUsers.map((user) => ({
                            ...user,
                            roles: user.roles.filter(
                                (role) => role.id !== deleteData.role_id,
                            ),
                        })),
                    );
                    toast.info("Role deleted");
                    break;
                }

                case MESSAGE_TYPES.ROLE_ASSIGNED: {
                    const assignData = message.data as RoleAssignedBroadcast;
                    const role = roles.find((r) => r.id === assignData.role_id);
                    if (role) {
                        setUsers((prevUsers) =>
                            prevUsers.map((user) => {
                                if (user.id === assignData.user_id) {
                                    // Check if user already has this role
                                    const hasRole = user.roles.some(
                                        (r) => r.id === role.id,
                                    );
                                    if (!hasRole) {
                                        return {
                                            ...user,
                                            roles: [...user.roles, role],
                                        };
                                    }
                                }
                                return user;
                            }),
                        );

                        const user = users.find(
                            (u) => u.id === assignData.user_id,
                        );
                        if (user) {
                            toast.success(
                                `Role "${role.name}" assigned to ${user.nickname || user.username}`,
                            );
                        }
                    }
                    break;
                }

                case MESSAGE_TYPES.ROLE_REMOVED: {
                    const removeData = message.data as RoleRemovedBroadcast;
                    const role = roles.find((r) => r.id === removeData.role_id);
                    setUsers((prevUsers) =>
                        prevUsers.map((user) => {
                            if (user.id === removeData.user_id) {
                                return {
                                    ...user,
                                    roles: user.roles.filter(
                                        (r) => r.id !== removeData.role_id,
                                    ),
                                };
                            }
                            return user;
                        }),
                    );

                    const user = users.find((u) => u.id === removeData.user_id);
                    if (user && role) {
                        toast.info(
                            `Role "${role.name}" removed from ${user.nickname || user.username}`,
                        );
                    }
                    break;
                }

                case MESSAGE_TYPES.USER_UPDATED: {
                    const updateData = message.data as UserUpdatedBroadcast;
                    setUsers((prevUsers) =>
                        prevUsers.map((user) =>
                            user.id === updateData.user_id
                                ? { ...user, nickname: updateData.nickname }
                                : user,
                        ),
                    );

                    const user = users.find((u) => u.id === updateData.user_id);
                    if (user) {
                        toast.info(
                            `${user.username}'s nickname updated to "${updateData.nickname}"`,
                        );
                    }
                    break;
                }

                case MESSAGE_TYPES.USER_PROFILE_UPDATED: {
                    const profileData =
                        message.data as UserProfileUpdatedBroadcast;
                    setUsers((prevUsers) =>
                        prevUsers.map((user) =>
                            user.id === profileData.user_id
                                ? {
                                      ...user,
                                      profile_picture_url:
                                          profileData.profile_picture_url,
                                  }
                                : user,
                        ),
                    );

                    const user = users.find(
                        (u) => u.id === profileData.user_id,
                    );
                    if (user) {
                        toast.info(
                            `${user.nickname || user.username} updated their profile picture`,
                        );
                    }
                    break;
                }

                case MESSAGE_TYPES.USER_LEFT: {
                    const leftData = message.data as UserLeftBroadcast;
                    setUsers((prevUsers) =>
                        prevUsers.filter(
                            (user) => user.id !== leftData.user_id,
                        ),
                    );
                    toast.info(
                        `${leftData.nickname || leftData.username} left the server`,
                    );
                    break;
                }

                case MESSAGE_TYPES.SERVER_ICON_UPDATED: {
                    const iconData = message.data as ServerIconUpdatedBroadcast;
                    updateServerStatusCache({ icon: iconData.icon_url });
                    toast.success("Server icon updated");
                    break;
                }

                case MESSAGE_TYPES.SERVER_CONFIG_UPDATED: {
                    const configData =
                        message.data as ServerConfigUpdatedBroadcast;
                    updateServerStatusCache({
                        name: configData.name,
                        description: configData.description,
                        allow_invite: configData.allow_invite,
                        max_users: configData.max_users,
                        max_attachments: configData.max_attachments,
                    });
                    toast.success("Server configuration updated");
                    break;
                }
            }
        };

        webSocketManager.addMessageHandler(userId, handleMessage);

        return () => {
            webSocketManager.removeMessageHandler(userId, handleMessage);
        };
    }, [
        userId,
        roles,
        users,
        selectedChannelId,
        selectedVoiceChannelId,
        updateServerStatusCache,
    ]);

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
        setChannelGroups,
        toggleMemberList,
        refreshServerData,
        clearServerStatusCache,
        leaveCurrentServer,
        getSelectedChannel,
        getSelectedVoiceChannel,
        getUserById,
        isChannelUnread: isChannelUnreadHelper,
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
        setChannelGroups,
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
        setChannelGroups,
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
