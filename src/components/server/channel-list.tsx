import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Hash,
    ChevronRight,
    ChevronDown,
    Settings,
    Plus,
    Users,
    Volume2,
    Mic,
    PhoneOff,
    Headphones,
    MicOff,
} from "lucide-react";
import { cn } from "@/utils/tailwind";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Channel,
    ChannelGroup,
    User,
    VoiceParticipant,
    updateChannel,
} from "@/api/server";
import { VoiceEventData } from "@/api/voice";
import {
    webSocketManager,
    WebSocketMessage,
    MESSAGE_TYPES,
} from "@/websocket/websocket-manager";
import { useServer, useServerRecord } from "@/contexts/server-context";
import { useParams } from "@tanstack/react-router";
import CreateChannelDialog from "./create-channel-dialog";
import { ChannelContextMenu } from "./channel-context-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import EditChannelDialog from "./edit-channel-dialog";
import { UserAvatar } from "./user-avatar";
import { VoiceUserContextMenu } from "./voice-user-context-menu";
// @ts-expect-error - react-dnd CommonJS/ESM compatibility issue
import { DndProvider, useDrag, useDrop } from "react-dnd";
// @ts-expect-error - react-dnd-html5-backend compatibility issue
import { HTML5Backend } from "react-dnd-html5-backend";
import { logInfo, logError } from "@/utils/logger";

interface ExpandedGroup extends ChannelGroup {
    expanded: boolean;
}

export interface ChannelListProps {
    onSelectChannel: (channelId: number) => void;
    className?: string;
}

interface VoiceChannelState {
    participantCount: number;
    participants: VoiceParticipant[];
}

interface DragItem {
    type: string;
    id: number;
    groupId: number;
    position: number;
}

const ItemTypes = {
    CHANNEL: "channel",
};

export default function ChannelList({
    onSelectChannel,
    className,
}: ChannelListProps) {
    const { userId } = useParams({ strict: false });
    const { currentUser } = useCurrentUser();
    const {
        channelGroups,
        selectedChannelId,
        selectedVoiceChannelId,
        setSelectedVoiceChannelId,
        isChannelUnread,
    } = useServer();
    const serverRecord = useServerRecord();

    const [expandedGroups, setExpandedGroups] = React.useState<ExpandedGroup[]>(
        [],
    );
    const [createChannelOpen, setCreateChannelOpen] = React.useState(false);
    const [editChannel, setEditChannel] = React.useState<Channel | null>(null);
    const [editChannelOpen, setEditChannelOpen] = React.useState(false);
    const [voiceChannelStates, setVoiceChannelStates] = React.useState<
        Map<number, VoiceChannelState>
    >(new Map());

    React.useEffect(() => {
        if (channelGroups.length > 0) {
            const newExpandedGroups = channelGroups.map((group) => ({
                ...group,
                expanded: true,
            }));
            setExpandedGroups(newExpandedGroups);
        }
    }, [channelGroups]);

    // Initial population of voice channel states from channel API
    React.useEffect(() => {
        if (channelGroups.length > 0) {
            const newVoiceStates = new Map<number, VoiceChannelState>();
            for (const group of channelGroups) {
                for (const channel of group.channels) {
                    if (
                        channel.is_voice &&
                        Array.isArray(channel.participants)
                    ) {
                        const participants: VoiceParticipant[] =
                            channel.participants.map((p) => ({
                                id: p.id,
                                user_id: p.user_id,
                                username: p.username,
                                nickname: p.nickname,
                                profile_picture_url: p.profile_picture_url,
                                is_muted: p.is_muted || false,
                                is_deafened: p.is_deafened || false,
                                is_speaking: p.is_speaking || false,
                                joined_at: p.joined_at,
                            }));

                        newVoiceStates.set(channel.id, {
                            participantCount: participants.length,
                            participants: participants,
                        });
                    }
                }
            }
            setVoiceChannelStates(newVoiceStates);
        }
    }, [channelGroups]);

    // Handle WebSocket messages
    React.useEffect(() => {
        if (!userId || !currentUser) return;

        const handleWebSocketMessage = (message: WebSocketMessage) => {
            switch (message.type) {
                case MESSAGE_TYPES.USER_JOINED_VOICE: {
                    const data =
                        message.data as VoiceEventData["user_joined_voice"];
                    setVoiceChannelStates((prevMap) => {
                        const newMap = new Map(prevMap);
                        const channelState = newMap.get(data.channel_id) || {
                            participantCount: 0,
                            participants: [],
                        };

                        const newParticipants = [...channelState.participants];
                        if (
                            !newParticipants.find(
                                (p) => p.user_id === data.participant.user_id,
                            )
                        ) {
                            newParticipants.push(data.participant);
                        }

                        newMap.set(data.channel_id, {
                            participants: newParticipants,
                            participantCount: newParticipants.length,
                        });

                        if (data.participant.user_id === currentUser.id) {
                            setSelectedVoiceChannelId(data.channel_id);
                        }
                        return newMap;
                    });
                    break;
                }
                case MESSAGE_TYPES.USER_LEFT_VOICE: {
                    const data =
                        message.data as VoiceEventData["user_left_voice"];
                    setVoiceChannelStates((prevMap) => {
                        const newMap = new Map(prevMap);
                        const channelState = newMap.get(data.channel_id);

                        if (channelState) {
                            const newParticipants =
                                channelState.participants.filter(
                                    (p) => p.user_id !== data.user_id,
                                );
                            newMap.set(data.channel_id, {
                                ...channelState,
                                participants: newParticipants,
                                participantCount: newParticipants.length,
                            });

                            if (data.user_id === currentUser.id) {
                                setSelectedVoiceChannelId(null);
                            }
                        }
                        return newMap;
                    });
                    break;
                }
                case MESSAGE_TYPES.VOICE_STATE_UPDATE: {
                    const data =
                        message.data as VoiceEventData["voice_state_update"];
                    setVoiceChannelStates((prevMap) => {
                        const newMap = new Map(prevMap);
                        const channelState = newMap.get(data.channel_id);
                        if (channelState) {
                            const newParticipants =
                                channelState.participants.map((p) =>
                                    p.user_id === data.user_id
                                        ? {
                                              ...p,
                                              is_muted: data.is_muted,
                                              is_deafened: data.is_deafened,
                                          }
                                        : p,
                                );
                            newMap.set(data.channel_id, {
                                ...channelState,
                                participants: newParticipants,
                            });
                        }
                        return newMap;
                    });
                    break;
                }
                case MESSAGE_TYPES.SPEAKING_UPDATE: {
                    const data =
                        message.data as VoiceEventData["speaking_update"];
                    setVoiceChannelStates((prevMap) => {
                        const newMap = new Map(prevMap);
                        const channelState = newMap.get(data.channel_id);
                        if (channelState) {
                            const newParticipants =
                                channelState.participants.map((p) =>
                                    p.user_id === data.user_id
                                        ? {
                                              ...p,
                                              is_speaking: data.is_speaking,
                                          }
                                        : p,
                                );
                            newMap.set(data.channel_id, {
                                ...channelState,
                                participants: newParticipants,
                            });
                        }
                        return newMap;
                    });
                    break;
                }
            }
        };

        // Add message handler
        webSocketManager.addMessageHandler(userId, handleWebSocketMessage);

        // Cleanup
        return () => {
            webSocketManager.removeMessageHandler(
                userId,
                handleWebSocketMessage,
            );
        };
    }, [userId, currentUser, setSelectedVoiceChannelId]);

    const toggleGroup = (groupId: number) => {
        setExpandedGroups((prev) =>
            prev.map((group) =>
                group.id === groupId
                    ? { ...group, expanded: !group.expanded }
                    : group,
            ),
        );
    };

    const handleChannelCreated = () => {
        logInfo("Channel created", "api");
    };

    const handleChannelClick = async (channel: Channel) => {
        if (channel.is_voice) {
            if (userId && currentUser?.id) {
                const voiceClient = webSocketManager.getVoiceClient(userId);

                // If already connected to this channel, do nothing
                if (voiceClient?.currentChannel === channel.id) {
                    return;
                }

                const oldSelectedVoiceChannelId = selectedVoiceChannelId;
                try {
                    // Optimistically set selected channel
                    setSelectedVoiceChannelId(channel.id);

                    await webSocketManager.joinVoiceChannel(userId, channel.id);
                } catch (error) {
                    logError(
                        "Failed to join voice channel",
                        "api",
                        String(error),
                    );
                    setSelectedVoiceChannelId(oldSelectedVoiceChannelId);
                }
            }
        } else {
            // For text channels, just select them
            onSelectChannel(channel.id);
        }
    };

    // Find the connected voice channel
    const connectedVoiceChannel = React.useMemo(() => {
        if (!selectedVoiceChannelId || !currentUser) return undefined;

        for (const group of expandedGroups) {
            const foundChannel = group.channels.find(
                (ch) => ch.is_voice && ch.id === selectedVoiceChannelId,
            );
            if (foundChannel) return foundChannel;
        }
        return undefined;
    }, [selectedVoiceChannelId, expandedGroups, currentUser]);

    const handleDisconnectFromVoice = async () => {
        if (userId) {
            try {
                logInfo("Disconnecting from voice channel...", "api");
                await webSocketManager.leaveVoiceChannel(userId);
                setSelectedVoiceChannelId(null);
                logInfo("Successfully disconnected from voice channel", "api");
            } catch (error) {
                logError(
                    "Failed to disconnect from voice channel",
                    "api",
                    String(error),
                );
                // Still clear the selected channel on error
                setSelectedVoiceChannelId(null);
            }
        }
    };

    const handleEditChannel = (channel: Channel) => {
        setEditChannel(channel);
        setEditChannelOpen(true);
    };

    const moveChannel = async (
        draggedChannel: Channel,
        targetGroupId: number,
        newPosition: number,
    ) => {
        if (!serverRecord?.server_url || !userId) return;

        try {
            await updateChannel(serverRecord.server_url, userId, {
                channel_id: draggedChannel.id,
                group_id: targetGroupId,
                position: newPosition,
            });
        } catch (error) {
            logError("Failed to update channel position", "api", String(error));
        }
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className={cn("flex h-full w-full flex-col", className)}>
                <ScrollArea className="flex-1 pr-1">
                    {expandedGroups.map((group) => (
                        <div key={group.id} className="mb-4">
                            <GroupHeader
                                group={group}
                                onToggle={() => toggleGroup(group.id)}
                                onCreateChannel={() =>
                                    setCreateChannelOpen(true)
                                }
                            />

                            {group.expanded && (
                                <ChannelDropZone
                                    group={group}
                                    onMoveChannel={moveChannel}
                                >
                                    <div className="ml-1">
                                        {group.channels
                                            .sort(
                                                (a, b) =>
                                                    a.position - b.position,
                                            )
                                            .map((channel) => (
                                                <DraggableChannel
                                                    key={channel.id}
                                                    channel={channel}
                                                    isSelected={
                                                        channel.is_voice
                                                            ? false
                                                            : channel.id ===
                                                              selectedChannelId
                                                    }
                                                    isUnread={
                                                        !channel.is_voice &&
                                                        channel.id !==
                                                            selectedChannelId &&
                                                        isChannelUnread(
                                                            channel.id,
                                                        )
                                                    }
                                                    voiceState={voiceChannelStates.get(
                                                        channel.id,
                                                    )}
                                                    onClick={() =>
                                                        handleChannelClick(
                                                            channel,
                                                        )
                                                    }
                                                    onEditChannel={
                                                        handleEditChannel
                                                    }
                                                    serverUrl={
                                                        serverRecord?.server_url ||
                                                        ""
                                                    }
                                                    currentUser={
                                                        currentUser ?? null
                                                    }
                                                    onMoveChannel={moveChannel}
                                                />
                                            ))}
                                    </div>
                                </ChannelDropZone>
                            )}
                        </div>
                    ))}
                </ScrollArea>

                {currentUser && (
                    <UserPanel
                        currentUser={currentUser}
                        connectedVoiceChannel={connectedVoiceChannel}
                        onDisconnect={handleDisconnectFromVoice}
                    />
                )}

                <CreateChannelDialog
                    open={createChannelOpen}
                    onOpenChange={setCreateChannelOpen}
                    channelGroups={channelGroups}
                    onChannelCreated={handleChannelCreated}
                />

                <EditChannelDialog
                    open={editChannelOpen}
                    onOpenChange={setEditChannelOpen}
                    channel={editChannel}
                    onChannelUpdated={() => {
                        logInfo("Channel updated", "api");
                    }}
                />
            </div>
        </DndProvider>
    );
}

interface GroupHeaderProps {
    group: ExpandedGroup;
    onToggle: () => void;
    onCreateChannel: () => void;
}

function GroupHeader({ group, onToggle, onCreateChannel }: GroupHeaderProps) {
    return (
        <div className="text-muted-foreground hover:text-foreground group flex w-full items-center justify-between px-1 py-1 text-xs font-semibold transition-colors">
            <button
                onClick={onToggle}
                className="hover:text-foreground flex items-center gap-0.5"
            >
                {group.expanded ? (
                    <ChevronDown size={14} />
                ) : (
                    <ChevronRight size={14} />
                )}
                <span className="uppercase">{group.name}</span>
            </button>

            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={onCreateChannel}
                            >
                                <Plus size={14} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Create Channel</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground">
                                <Settings size={14} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Edit Group</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}

interface ChannelDropZoneProps {
    group: ChannelGroup;
    children: React.ReactNode;
    onMoveChannel: (
        channel: Channel,
        groupId: number,
        position: number,
    ) => void;
}

function ChannelDropZone({
    group,
    children,
    onMoveChannel,
}: ChannelDropZoneProps) {
    const [{ isOver }, drop] = useDrop(
        () => ({
            accept: ItemTypes.CHANNEL,
            drop: (item: DragItem, monitor) => {
                if (!monitor.didDrop()) {
                    // Calculate new position based on existing channels in target group
                    const maxPosition =
                        group.channels.length > 0
                            ? Math.max(
                                  ...group.channels.map((ch) => ch.position),
                              )
                            : 0;
                    const newPosition = maxPosition + 1;

                    // Create a channel object with the dragged item's data
                    const draggedChannel: Channel = {
                        id: item.id,
                        name: "", // These will be filled by the server
                        description: "",
                        position: item.position,
                        group_id: item.groupId,
                        group_name: "",
                        is_voice: false,
                        participants: null,
                    };

                    onMoveChannel(draggedChannel, group.id, newPosition);
                }
            },
            collect: (monitor) => ({
                isOver: monitor.isOver({ shallow: true }),
            }),
        }),
        [group, onMoveChannel],
    );

    return (
        <div
            ref={(node) => {
                if (node) drop(node);
            }}
            className={cn(
                "transition-colors",
                isOver && "bg-accent/20 rounded-md",
            )}
        >
            {children}
        </div>
    );
}

interface DraggableChannelProps {
    channel: Channel;
    isSelected: boolean;
    isUnread?: boolean;
    voiceState?: VoiceChannelState;
    onClick: () => void;
    onEditChannel: (channel: Channel) => void;
    serverUrl: string;
    currentUser: User | null;
    onMoveChannel: (
        channel: Channel,
        groupId: number,
        position: number,
    ) => void;
}

function DraggableChannel({
    channel,
    isSelected,
    isUnread = false,
    voiceState,
    onClick,
    onEditChannel,
    serverUrl,
    currentUser,
    onMoveChannel,
}: DraggableChannelProps) {
    const [{ isDragging }, drag, preview] = useDrag(
        () => ({
            type: ItemTypes.CHANNEL,
            item: {
                type: ItemTypes.CHANNEL,
                id: channel.id,
                groupId: channel.group_id,
                position: channel.position,
            },
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        }),
        [channel],
    );

    const [{ isOver, canDrop }, drop] = useDrop(
        () => ({
            accept: ItemTypes.CHANNEL,
            drop: (item: DragItem) => {
                if (item.id !== channel.id) {
                    // Calculate position relative to the drop target
                    // Insert before the target channel
                    const newPosition = channel.position;

                    const draggedChannel: Channel = {
                        id: item.id,
                        name: "",
                        description: "",
                        position: item.position,
                        group_id: item.groupId,
                        group_name: "",
                        is_voice: false,
                        participants: null,
                    };

                    onMoveChannel(
                        draggedChannel,
                        channel.group_id,
                        newPosition,
                    );
                }
            },
            collect: (monitor) => ({
                isOver: monitor.isOver(),
                canDrop: monitor.canDrop(),
            }),
        }),
        [channel, onMoveChannel],
    );

    const isVoiceChannel = channel.is_voice;
    const hasVoiceActivity = voiceState && voiceState.participantCount > 0;

    return (
        <div
            ref={(node) => {
                drag(node);
                drop(node);
                preview(node);
            }}
            className={cn(
                "relative",
                isDragging && "opacity-50",
                isOver && canDrop && "border-primary border-t-2",
            )}
        >
            <ChannelContextMenu
                channel={channel}
                serverUrl={serverUrl}
                currentUser={currentUser ?? undefined}
                onChannelDeleted={() => {
                    logInfo("Channel deleted", "api");
                }}
                onChannelEdit={onEditChannel}
            >
                <button
                    className={cn(
                        "group relative mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm",
                        isSelected
                            ? "bg-accent text-accent-foreground"
                            : isUnread
                              ? "text-foreground font-medium"
                              : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                    )}
                    onClick={onClick}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        {isVoiceChannel ? (
                            <Volume2
                                size={18}
                                className={cn(
                                    hasVoiceActivity ? "text-green-500" : "",
                                )}
                            />
                        ) : (
                            <Hash
                                size={18}
                                className={cn(isUnread && "text-foreground")}
                            />
                        )}

                        <span className="truncate">{channel.name}</span>
                    </div>

                    {isVoiceChannel && hasVoiceActivity && (
                        <div className="ml-auto flex items-center gap-1 text-xs">
                            <Users size={12} />
                            <span className="text-xs">
                                {voiceState.participantCount}
                            </span>
                        </div>
                    )}

                    {!isVoiceChannel && isUnread && (
                        <div className="bg-accent-positive ml-auto h-2 w-2 rounded-full" />
                    )}
                </button>
            </ChannelContextMenu>

            {isVoiceChannel &&
                voiceState &&
                voiceState.participants.length > 0 && (
                    <div className="mt-1 mb-2 ml-2 space-y-1">
                        {voiceState.participants.map((participant) => (
                            <VoiceUserContextMenu
                                key={participant.user_id}
                                participant={participant}
                                openProfile={() => {
                                    logInfo(
                                        `Open profile for: ${participant.username}`,
                                        "api",
                                    );
                                }}
                            >
                                <div
                                    className={cn(
                                        "flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors",
                                        "hover:bg-accent/20",
                                        participant.is_speaking &&
                                            "bg-green-500/10",
                                    )}
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        <div className="relative">
                                            <UserAvatar
                                                displayName={
                                                    participant.nickname ||
                                                    participant.username
                                                }
                                                profilePictureUrl={
                                                    participant.profile_picture_url
                                                }
                                                className={cn(
                                                    "h-6 w-6 text-xs",
                                                    participant.is_speaking
                                                        ? "ring-2 ring-green-400/50"
                                                        : "",
                                                )}
                                            />
                                            {participant.is_speaking && (
                                                <div className="absolute -inset-0.5 animate-pulse rounded-full bg-green-400 opacity-75" />
                                            )}
                                        </div>
                                        <span
                                            className={cn(
                                                "truncate font-medium",
                                                participant.is_speaking
                                                    ? "text-green-400"
                                                    : "text-muted-foreground",
                                            )}
                                        >
                                            {participant.nickname ||
                                                participant.username}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {participant.is_deafened ? (
                                            <div className="flex items-center gap-0.5">
                                                <Headphones
                                                    size={12}
                                                    className="text-red-400"
                                                />
                                                <MicOff
                                                    size={10}
                                                    className="text-red-400"
                                                />
                                            </div>
                                        ) : participant.is_muted ? (
                                            <MicOff
                                                size={12}
                                                className="text-red-400"
                                            />
                                        ) : (
                                            <Mic
                                                size={12}
                                                className="text-muted-foreground/60"
                                            />
                                        )}
                                    </div>
                                </div>
                            </VoiceUserContextMenu>
                        ))}
                    </div>
                )}
        </div>
    );
}

interface UserPanelProps {
    currentUser: User;
    connectedVoiceChannel?: Channel;
    onDisconnect: () => void;
}

function UserPanel({
    currentUser,
    connectedVoiceChannel,
    onDisconnect,
}: UserPanelProps) {
    const { userId } = useParams({ strict: false });
    const [isMuted, setIsMuted] = React.useState(false);
    const [isDeafened, setIsDeafened] = React.useState(false);

    const handleMuteToggle = async () => {
        if (userId && !isDeafened) {
            // Prevent toggling if deafened
            try {
                const newMutedState = !isMuted;
                await webSocketManager.setMuted(userId, newMutedState);
                setIsMuted(newMutedState);
            } catch (error) {
                logError("Failed to toggle mute", "api", String(error));
            }
        }
    };

    const handleDeafenToggle = async () => {
        if (userId) {
            try {
                const newDeafenedState = !isDeafened;

                // Update deafen state first
                await webSocketManager.setDeafened(userId, newDeafenedState);
                setIsDeafened(newDeafenedState);

                if (newDeafenedState) {
                    // If now deafened, ensure user is also muted
                    if (!isMuted) {
                        await webSocketManager.setMuted(userId, true);
                        setIsMuted(true);
                    }
                } else {
                    // If now un-deafened, ensure user is also un-muted
                    if (isMuted) {
                        await webSocketManager.setMuted(userId, false);
                        setIsMuted(false);
                    }
                }
            } catch (error) {
                logError("Failed to toggle deafen/mute", "api", String(error));
            }
        }
    };

    return (
        <div className="bg-muted border-border min-h-16 content-center border-t p-2">
            {connectedVoiceChannel && (
                <div className="mb-2 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-green-400">
                            Voice Connected
                        </p>
                        <p
                            className="text-muted-foreground max-w-full truncate text-xs"
                            title={connectedVoiceChannel.name}
                        >
                            {connectedVoiceChannel.name}
                        </p>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={onDisconnect}
                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-2 rounded p-1.5"
                                    aria-label="Disconnect from voice"
                                >
                                    <PhoneOff size={16} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Disconnect</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <UserAvatar
                        displayName={
                            currentUser.nickname ?? currentUser.username
                        }
                        profilePictureUrl={currentUser.profile_picture_url}
                        className="h-8 w-8"
                    />
                    <div className="min-w-0 flex-1">
                        <span
                            className="block truncate text-sm font-medium"
                            title={currentUser.nickname ?? currentUser.username}
                        >
                            {currentUser.nickname ?? currentUser.username}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            {connectedVoiceChannel ? "In voice" : "Online"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleMuteToggle}
                                    disabled={isDeafened} // Disable mute button if deafened
                                    className={cn(
                                        "rounded p-1.5",
                                        isMuted
                                            ? "bg-red-500/10 text-red-500 hover:text-red-400"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent",
                                        isDeafened &&
                                            "cursor-not-allowed opacity-50",
                                    )}
                                >
                                    <Mic size={16} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isMuted ? "Unmute" : "Mute"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleDeafenToggle}
                                    className={cn(
                                        "rounded p-1.5",
                                        isDeafened
                                            ? "bg-red-500/10 text-red-500 hover:text-red-400"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent",
                                    )}
                                >
                                    <Headphones size={16} />{" "}
                                    {/* Changed icon */}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isDeafened ? "Undeafen" : "Deafen"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}
