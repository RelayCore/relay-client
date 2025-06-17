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
        })}`
    );
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
}: {
    message: Message;
    showHeader?: boolean;
    currentUserId?: string;
    onImageClick?: (attachment: Attachment) => void;
    isEditing?: boolean;
    editingText?: string;
    onEditingTextChange?: (text: string) => void;
    onEditSave?: (messageId: number, content: string) => void;
    onEditCancel?: () => void;
}) {
    const { users } = useMembers();
    const formattedDate = formatMessageDate(message.created_at);
    const hasAttachments =
        message.attachments &&
        Array.isArray(message.attachments) &&
        message.attachments.length > 0;

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
            <div className="text-sm break-words whitespace-pre-wrap">
                <ProcessedMessageContent
                    parts={messageContentParts}
                    currentUserId={currentUserId}
                />
            </div>
        );
    }, [
        isEditing,
        editingText,
        messageContentParts,
        currentUserId,
        message.id,
        handleTextareaChange,
        handleEditKeyDown,
        onEditSave,
        onEditCancel,
    ]);

    return (
        <div
            className={cn(
                "hover:bg-accent/20 -mx-3 px-3 py-1",
                showHeader ? "mt-1" : "mt-0",
                isEditing && "bg-accent/10",
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
            )) || <div className="ml-12">{MessageContent}</div>}

            {hasAttachments && (
                <div
                    className={`ml-12 space-y-2 ${message.content.length > 0 ? "mt-2" : ""}`}
                >
                    {message.attachments!.map((attachment) => (
                        <AttachmentItem
                            key={attachment.id}
                            attachment={attachment}
                            onImageClick={onImageClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
