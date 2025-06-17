import React from "react";
import {
    Message,
    getPinnedMessages,
    formatFileSize,
    Attachment,
} from "@/api/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Pin,
    Download,
    ExternalLink,
    Image as ImageIcon,
    FileText,
} from "lucide-react";
import { cn } from "@/utils/tailwind";
import { UserPopover } from "./user-popup";
import { useMembers } from "@/contexts/server-context";
import { formatMessageDate } from "./message-channel";
import { downloadFile } from "@/utils/assets";

interface PinnedPopupProps {
    serverUrl: string;
    userId: string;
    channelId: number;
    className?: string;
}

export function PinnedPopup({
    serverUrl,
    userId,
    channelId,
    className,
}: PinnedPopupProps) {
    const [pinnedMessages, setPinnedMessages] = React.useState<Message[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchPinnedMessages = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await getPinnedMessages(
                    serverUrl,
                    userId,
                    channelId,
                );
                setPinnedMessages(response.pinned_messages);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load pinned messages",
                );
            } finally {
                setLoading(false);
            }
        };

        fetchPinnedMessages();
    }, [serverUrl, userId, channelId]);

    if (loading) {
        return (
            <div className={cn("w-96 p-4", className)}>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Pinned Messages</h3>
                    <Skeleton className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("w-96 p-4", className)}>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Pinned Messages</h3>
                </div>
                <div className="text-muted-foreground text-center">
                    <p>Failed to load pinned messages</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (pinnedMessages.length === 0) {
        return (
            <div className={cn("w-96 p-4", className)}>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Pinned Messages</h3>
                    <Pin size={20} className="text-muted-foreground" />
                </div>
                <div className="text-muted-foreground py-8 text-center">
                    <Pin size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No pinned messages in this channel</p>
                    <p className="text-sm">
                        Pin important messages to see them here
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-96 p-4", className)}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Pinned Messages</h3>
                <div className="flex items-center gap-1">
                    <Pin size={16} className="text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">
                        {pinnedMessages.length}
                    </span>
                </div>
            </div>

            <ScrollArea className="max-h-96">
                <div className="space-y-4">
                    {pinnedMessages.map((message) => (
                        <PinnedMessageItem
                            key={message.id}
                            message={message}
                            currentUserId={userId}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

function PinnedMessageItem({
    message,
    currentUserId,
}: {
    message: Message;
    currentUserId: string;
}) {
    const { getUserById } = useMembers();
    const formattedDate = formatMessageDate(message.created_at);
    const hasAttachments =
        message.attachments &&
        Array.isArray(message.attachments) &&
        message.attachments.length > 0;

    const userId = message.author_id || "";

    // Use getUserById to get user information
    const user = getUserById(userId) || {
        id: userId,
        username: message.username || "Unknown",
        nickname: "",
        roles: [],
        is_online: false,
    };

    const displayName = user.nickname || user.username || userId;
    const avatarText = displayName
        ? displayName.substring(0, 2).toUpperCase()
        : "U";

    // Find highest role with a color
    const highestColoredRole = [...user.roles]
        .sort((a, b) => b.rank - a.rank)
        .find((role) => role.color);
    const roleColor = highestColoredRole?.color;

    return (
        <div className="group hover:bg-accent/50 relative rounded-md border p-3">
            <div className="flex items-start justify-between">
                <div className="mb-2 flex items-center space-x-2">
                    <UserPopover user={user} currentUserId={currentUserId}>
                        <Avatar className="h-6 w-6 cursor-pointer">
                            {user.profile_picture_url ? (
                                <img
                                    src={user.profile_picture_url}
                                    alt={displayName}
                                    className="h-full w-full rounded-full object-cover"
                                />
                            ) : (
                                <AvatarFallback
                                    className="text-xs"
                                    style={{
                                        backgroundColor:
                                            highestColoredRole?.color
                                                ? `${highestColoredRole.color}20`
                                                : undefined,
                                        color:
                                            highestColoredRole?.color ||
                                            undefined,
                                    }}
                                >
                                    {avatarText}
                                </AvatarFallback>
                            )}
                        </Avatar>
                    </UserPopover>
                    <UserPopover user={user} currentUserId={currentUserId}>
                        <span
                            className="cursor-pointer text-sm font-medium hover:underline"
                            style={{ color: roleColor }}
                        >
                            {displayName}
                        </span>
                    </UserPopover>
                    <span className="text-muted-foreground text-xs">
                        {formattedDate}
                    </span>
                </div>
            </div>

            <div className="text-foreground text-sm break-words whitespace-pre-wrap">
                {message.content}
            </div>

            {hasAttachments && (
                <div className="mt-2 space-y-2">
                    {message.attachments!.map((attachment) => (
                        <PinnedAttachmentItem
                            key={attachment.id}
                            attachment={attachment}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PinnedAttachmentItem({ attachment }: { attachment: Attachment }) {
    const isImage = attachment.type === "image";
    const fileSize = formatFileSize(attachment.file_size);

    // Download the attachment
    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await downloadFile(attachment.file_path, attachment.file_name);
    };

    if (isImage) {
        return (
            <div className="group relative inline-block overflow-hidden rounded-md">
                <img
                    src={attachment.file_path}
                    alt={attachment.file_name}
                    className="border-border max-h-[200px] max-w-full rounded-md border object-contain"
                />
                <div className="absolute right-0 bottom-0 left-0 flex items-center justify-between bg-black/60 p-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="max-w-[150px] truncate">
                        {attachment.file_name} ({fileSize})
                    </span>
                    <div className="flex gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-white/20"
                            onClick={handleDownload}
                        >
                            <Download size={14} />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-white/20"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(attachment.file_path, "_blank");
                            }}
                        >
                            <ExternalLink size={14} />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="border-border hover:bg-accent/10 flex cursor-pointer items-center gap-2 rounded-md border p-2">
            <div className="bg-primary/10 rounded p-2">
                {attachment.type === "video" ? (
                    <ImageIcon size={16} />
                ) : (
                    <FileText size={16} />
                )}
            </div>
            <div className="min-w-0 flex-grow">
                <div className="truncate text-xs font-medium">
                    {attachment.file_name}
                </div>
                <div className="text-muted-foreground text-xs">{fileSize}</div>
            </div>
            <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleDownload}
            >
                <Download size={12} />
            </Button>
        </div>
    );
}
