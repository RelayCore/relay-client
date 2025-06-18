import React from "react";
import { Trash2, Copy, Reply, Edit3, Pin, PinOff } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    Message,
    deleteMessage,
    pinMessage,
    unpinMessage,
    Channel,
    User,
    canPinInChannel,
} from "@/api/server";
import { toast } from "sonner";

interface MessageContextMenuProps {
    message: Message;
    serverUrl: string;
    currentUserId: string;
    currentUser: User;
    channel: Channel;
    isPinned: boolean;
    onMessageDeleted: (messageId: number) => void;
    onMessagePinned: (messageId: number) => void;
    onMessageUnpinned: (messageId: number) => void;
    onMessageEdit: (messageId: number) => void;
    onReply?: (message: Message) => void;
    children: React.ReactNode;
}

export function MessageContextMenu({
    message,
    serverUrl,
    currentUserId,
    currentUser,
    channel,
    isPinned,
    onMessageDeleted,
    onMessagePinned,
    onMessageUnpinned,
    onMessageEdit,
    onReply,
    children,
}: MessageContextMenuProps) {
    const isOwnMessage = message.author_id === currentUserId;
    const canPin = canPinInChannel(channel, currentUser);

    const handleCopyMessage = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            toast.success("Message copied to clipboard");
        } catch {
            toast.error("Failed to copy message");
        }
    };

    const handleDeleteMessage = async () => {
        if (!currentUserId) return;

        try {
            await deleteMessage(serverUrl, currentUserId, message.id);
            toast.success("Message deleted");
            onMessageDeleted?.(message.id);
        } catch (error) {
            console.error("Failed to delete message:", error);
            toast.error("Failed to delete message");
        }
    };

    const handlePinMessage = async () => {
        if (!currentUserId) return;

        try {
            await pinMessage(serverUrl, currentUserId, message.id);
            toast.success("Message pinned");
            onMessagePinned?.(message.id);
        } catch (error) {
            console.error("Failed to pin message:", error);
            toast.error("Failed to pin message");
        }
    };

    const handleUnpinMessage = async () => {
        if (!currentUserId) return;

        try {
            await unpinMessage(serverUrl, currentUserId, message.id);
            toast.success("Message unpinned");
            onMessageUnpinned?.(message.id);
        } catch (error) {
            console.error("Failed to unpin message:", error);
            toast.error("Failed to unpin message");
        }
    };

    const handleEditMessage = () => {
        onMessageEdit?.(message.id);
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                {isOwnMessage && (
                    <ContextMenuItem onClick={handleEditMessage}>
                        <Edit3 size={16} />
                        Edit Message
                    </ContextMenuItem>
                )}

                {onReply && (
                    <ContextMenuItem
                        onClick={() => onReply(message)}
                        className="cursor-pointer"
                    >
                        <Reply className="h-4 w-4" />
                        Reply
                    </ContextMenuItem>
                )}

                <ContextMenuItem onClick={handleCopyMessage}>
                    <Copy size={16} />
                    Copy Message
                </ContextMenuItem>

                {canPin && (
                    <>
                        {isPinned ? (
                            <ContextMenuItem onClick={handleUnpinMessage}>
                                <PinOff size={16} />
                                Unpin Message
                            </ContextMenuItem>
                        ) : (
                            <ContextMenuItem onClick={handlePinMessage}>
                                <Pin size={16} />
                                Pin Message
                            </ContextMenuItem>
                        )}
                    </>
                )}

                {isOwnMessage && (
                    <>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                            variant="destructive"
                            onClick={handleDeleteMessage}
                        >
                            <Trash2 size={16} />
                            Delete Message
                        </ContextMenuItem>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
