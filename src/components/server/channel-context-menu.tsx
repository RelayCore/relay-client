import React from "react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Edit3, Copy, Bell, Pin, Trash2 } from "lucide-react";
import { Channel, User, deleteChannel, hasPermission } from "@/api/server";
import { toast } from "sonner";

interface ChannelContextMenuProps {
    children: React.ReactNode;
    channel: Channel;
    serverUrl: string;
    currentUser: User | undefined;
    onChannelDeleted: () => void;
    onChannelEdit: (channel: Channel) => void;
}

export function ChannelContextMenu({
    children,
    channel,
    serverUrl,
    currentUser,
    onChannelDeleted,
    onChannelEdit,
}: ChannelContextMenuProps) {
    if (!currentUser) {
        return <>{children}</>; // No user, no context menu
    }

    // Get permissions directly from user's roles
    const permissions = React.useMemo(() => {
        return {
            can_delete:
                hasPermission(currentUser, "delete_channels") ||
                hasPermission(currentUser, "manage_channels"),
            can_edit: hasPermission(currentUser, "manage_channels"),
            can_manage: hasPermission(currentUser, "manage_channels"),
        };
    }, [currentUser]);

    const handleCopyChannelId = async () => {
        try {
            await navigator.clipboard.writeText(channel.id.toString());
            toast.success("Channel ID copied to clipboard");
        } catch {
            toast.error("Failed to copy channel ID");
        }
    };

    const handleDeleteChannel = async () => {
        try {
            await deleteChannel(serverUrl, currentUser.id, channel.id);
            toast.success(`#${channel.name} has been deleted`);
            onChannelDeleted?.();
        } catch {
            toast.error("Failed to delete channel");
        }
    };

    const handleEditChannel = () => {
        onChannelEdit?.(channel);
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-56">
                <ContextMenuItem
                    onClick={handleEditChannel}
                    disabled={!permissions.can_edit}
                >
                    <Edit3 />
                    Edit Channel
                </ContextMenuItem>

                <ContextMenuItem disabled>
                    <Bell />
                    Mute Channel
                </ContextMenuItem>

                <ContextMenuItem disabled>
                    <Pin />
                    Pin Channel
                </ContextMenuItem>

                <ContextMenuSeparator />

                <ContextMenuItem onClick={handleCopyChannelId}>
                    <Copy />
                    Copy Channel ID
                </ContextMenuItem>

                {permissions.can_delete && (
                    <>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                            variant="destructive"
                            onClick={handleDeleteChannel}
                        >
                            <Trash2 />
                            Delete Channel
                        </ContextMenuItem>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
