import React from "react";
import { cn } from "@/utils/tailwind";
import { Button } from "@/components/ui/button";
import { Message, Attachment } from "@/api/server";
import { useMembers } from "@/contexts/server-context";
import { UserPopover } from "../user-popup";
import { UserAvatar } from "../user-avatar";
import { AttachmentItem } from "./attachment-item";
import { ProcessedMessageContent } from "./message-content";
import { MessageContentProcessor } from "./message-content-processor";
import { ReplyPreview } from "./reply-preview";
import { logError } from "@/utils/logger";

export function formatMessageDate(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (isToday) {
        return `Today at ${date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })}`;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
        return `Yesterday at ${date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })}`;
    }

    return (
        date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year:
                date.getFullYear() !== now.getFullYear()
                    ? "numeric"
                    : undefined,
        }) +
        ` at ${date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })}`
    );
}

export function formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

export function MessageItem({
    message,
    showHeader = true,
    currentUserId,
    onImageClick,
    isEditing = false,
    editingText = "",
    onEditingTextChange,
    onEditSave,
    onEditCancel,
    onReply,
    onContentLoad,
    goToMessage,
}: {
    message: Message;
    showHeader?: boolean;
    currentUserId?: string;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
    isEditing?: boolean;
    editingText?: string;
    onEditingTextChange?: (text: string) => void;
    onEditSave?: (messageId: number, content: string) => void;
    onEditCancel?: () => void;
    onReply?: (message: Message) => void;
    onContentLoad?: () => void;
    goToMessage?: (messageId: number) => void;
}) {
    const { users } = useMembers();
    const formattedDate = formatMessageDate(message.created_at);
    const formattedTime = formatMessageTime(message.created_at);
    const hasAttachments =
        message.attachments &&
        Array.isArray(message.attachments) &&
        message.attachments.length > 0;

    const [ogDataMap, setOgDataMap] = React.useState<
        Record<string, OGData | "loading" | "error" | "nodata">
    >({});

    const userId = message.author_id || "";

    // Find the real user from the members list
    const user = users.find((user) => user.id === userId) || {
        id: userId,
        username: "Unknown",
        nickname: "",
        roles: [],
        is_online: false,
        profile_picture_url: "",
        created_at: new Date().toISOString(),
    };

    const displayName = user.nickname || user.username || userId;

    // Find highest role with a color
    const highestColoredRole = [...user.roles]
        .sort((a, b) => b.rank - a.rank)
        .find((role) => role.color);
    const roleColor = highestColoredRole?.color;

    const editTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [hasInitialFocus, setHasInitialFocus] = React.useState(false);

    // Focus textarea when editing starts
    React.useEffect(() => {
        if (isEditing && editTextareaRef.current && !hasInitialFocus) {
            const textarea = editTextareaRef.current;
            textarea.focus();
            // Set cursor to end of text
            const length = editingText.length;
            textarea.setSelectionRange(length, length);
            setHasInitialFocus(true);
        }

        if (!isEditing) {
            setHasInitialFocus(false);
        }
    }, [isEditing, hasInitialFocus, editingText.length]);

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onEditSave?.(message.id, editingText);
        } else if (e.key === "Escape") {
            e.preventDefault();
            onEditCancel?.();
        }
    };

    const handleTextareaChange = React.useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            onEditingTextChange?.(e.target.value);
        },
        [onEditingTextChange],
    );

    // Process message content for display
    const messageContentParts = React.useMemo(() => {
        const processor = new MessageContentProcessor(users);
        return processor.processContent(message.content);
    }, [message.content, users]);

    const isMentioningCurrentUser = React.useMemo(() => {
        if (!currentUserId) return false;
        return messageContentParts.some(
            (part) =>
                part.type === "mention" &&
                part.data?.user &&
                part.data.user.id === currentUserId,
        );
    }, [messageContentParts, currentUserId]);

    // Effect to fetch OpenGraph data for links
    React.useEffect(() => {
        let isActive = true;

        const urlsToFetchDetails: { url: string; partContent: string }[] = [];
        messageContentParts.forEach((part) => {
            if (
                part.type === "link" &&
                part.data?.url &&
                !part.data.isImageLink
            ) {
                if (
                    !(part.data.url in ogDataMap) ||
                    ogDataMap[part.data.url] === "error"
                ) {
                    urlsToFetchDetails.push({
                        url: part.data.url,
                        partContent: part.content,
                    });
                }
            }
        });

        if (urlsToFetchDetails.length > 0) {
            if (isActive) {
                setOgDataMap((prevMap) => {
                    const newMap = { ...prevMap };
                    urlsToFetchDetails.forEach(({ url }) => {
                        newMap[url] = "loading";
                    });
                    return newMap;
                });
            }

            urlsToFetchDetails.forEach(async ({ url, partContent }) => {
                try {
                    const meta = await window.ogAPI.fetchMeta(url);
                    if (isActive) {
                        setOgDataMap((prevMap) => ({
                            ...prevMap,
                            [url]: {
                                title: meta.title || partContent,
                                description: meta.description || "",
                                imageUrl: meta.imageUrl || "",
                                siteName: meta.title || "",
                                themeColor: meta.themeColor || "",
                                url,
                            },
                        }));
                        // Trigger scroll when OG data loads
                        onContentLoad?.();
                    }
                } catch (error) {
                    logError(
                        "Error fetching OG data for " + url,
                        "api",
                        String(error),
                    );
                    if (isActive) {
                        setOgDataMap((prevMap) => ({
                            ...prevMap,
                            [url]: "error",
                        }));
                    }
                }
            });
        }
        return () => {
            isActive = false;
        };
    }, [messageContentParts, onContentLoad]);

    const MessageContent = React.useMemo(() => {
        if (isEditing) {
            return (
                <div>
                    <textarea
                        ref={editTextareaRef}
                        value={editingText}
                        onChange={handleTextareaChange}
                        onKeyDown={handleEditKeyDown}
                        className="w-full resize-none border-none bg-transparent p-0 text-sm outline-none"
                        placeholder="Edit your message..."
                        style={{
                            height: "auto",
                            minHeight: "20px",
                            fontFamily: "inherit",
                        }}
                        rows={editingText.split("\n").length}
                    />
                    <div className="flex gap-2 text-xs">
                        <Button
                            size="sm"
                            onClick={() =>
                                onEditSave?.(message.id, editingText)
                            }
                            disabled={!editingText.trim()}
                        >
                            Save
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onEditCancel}
                        >
                            Cancel
                        </Button>
                        <span className="text-muted-foreground flex items-center">
                            Press Enter to save • Escape to cancel
                        </span>
                    </div>
                </div>
            );
        }

        return (
            <div>
                {/* Reply Preview */}
                {message.reply_to_message && (
                    <ReplyPreview
                        replyToMessage={message.reply_to_message}
                        isCompact={true}
                        className="ml-0"
                        goToMessage={goToMessage}
                    />
                )}

                {/* Message Content */}
                <div className="text-sm break-words whitespace-pre-wrap">
                    <ProcessedMessageContent
                        parts={messageContentParts}
                        currentUserId={currentUserId}
                        ogDataMap={ogDataMap}
                        onImageClick={onImageClick}
                        onContentLoad={onContentLoad}
                    />
                </div>
            </div>
        );
    }, [
        isEditing,
        editingText,
        messageContentParts,
        currentUserId,
        message.id,
        message.reply_to_message,
        message.reply_count,
        handleTextareaChange,
        handleEditKeyDown,
        onEditSave,
        onEditCancel,
        onReply,
        ogDataMap,
        onContentLoad,
    ]);

    return (
        <div
            className={cn(
                "hover:bg-accent/20 group -mx-3 px-3 py-1",
                showHeader ? "mt-1" : "mt-0",
                isEditing && "bg-accent/10",
                isMentioningCurrentUser &&
                    !isEditing &&
                    "bg-yellow-700/30 hover:bg-yellow-700/40",
            )}
        >
            {(showHeader && (
                <div className="flex items-start gap-2">
                    <UserPopover user={user} currentUserId={currentUserId}>
                        <div className="cursor-pointer self-start pt-1">
                            <UserAvatar
                                displayName={displayName}
                                profilePictureUrl={user.profile_picture_url}
                                className="h-10 w-10"
                            />
                        </div>
                    </UserPopover>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <UserPopover
                                user={user}
                                currentUserId={currentUserId}
                            >
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
                            {isEditing && (
                                <span className="text-muted-foreground text-xs">
                                    (editing)
                                </span>
                            )}
                        </div>
                        {MessageContent}
                    </div>
                </div>
            )) || (
                <div className="flex items-start gap-2">
                    <span className="text-muted-foreground ease-snappy flex w-10 items-center justify-center pt-0.5 text-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {formattedTime}
                    </span>
                    <div>{MessageContent}</div>
                </div>
            )}

            {hasAttachments && (
                <div
                    className={`ml-12 space-y-2 ${message.content.length > 0 ? "mt-2" : ""}`}
                >
                    {message.attachments!.map((attachment) => (
                        <AttachmentItem
                            key={attachment.id}
                            attachment={attachment}
                            onImageClick={onImageClick}
                            onContentLoad={onContentLoad} // Pass the callback
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
