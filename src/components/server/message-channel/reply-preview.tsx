import React from "react";
import { cn } from "@/utils/tailwind";
import { ReplyToMessage } from "@/api/server";
import { UserAvatar } from "../user-avatar";
import { X, Reply, CornerLeftUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMembers } from "@/contexts/server-context";
import { getHighestColoredRole } from "@/utils/members";

interface ReplyPreviewProps {
    replyToMessage: ReplyToMessage;
    onCancel?: () => void;
    goToMessage?: (messageId: number) => void;
    isCompact?: boolean;
    className?: string;
}

export function ReplyPreview({
    replyToMessage,
    onCancel,
    goToMessage,
    isCompact = false,
    className,
}: ReplyPreviewProps) {
    const { getUserById } = useMembers();
    const replyToUser = getUserById(replyToMessage.author_id);
    const displayName = replyToMessage.nickname || replyToMessage.username;
    const truncatedContent =
        replyToMessage.content.length > 100
            ? replyToMessage.content.substring(0, 100) + "..."
            : replyToMessage.content;
    const highestRole = replyToUser ? getHighestColoredRole(replyToUser) : null;

    return (
        <div
            className={cn(
                "relative w-fit rounded-md",
                isCompact &&
                    "hover:bg-accent cursor-pointer p-1 pr-1.5 transition-colors",
                !isCompact && "pb-3",
                className,
            )}
            onClick={() => goToMessage?.(replyToMessage.id)}
        >
            <div className="flex w-fit items-start gap-2">
                {isCompact ? (
                    <CornerLeftUp size={18} className="flex-shrink-0" />
                ) : (
                    <Reply size={16} className="mt-0.5 mr-2.5 flex-shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                    <div
                        className={`${isCompact ? "" : "mb-1"} flex items-center gap-2`}
                    >
                        <UserAvatar
                            displayName={displayName}
                            profilePictureUrl={replyToUser?.profile_picture_url}
                            className="h-4 w-4 flex-shrink-0"
                        />
                        <span
                            className="truncate text-sm font-medium"
                            style={{ color: highestRole?.color || "inherit" }}
                        >
                            {displayName}
                        </span>
                        {!isCompact ? (
                            <span className="text-muted-foreground text-xs">
                                {new Date(
                                    replyToMessage.created_at,
                                ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                        ) : (
                            <div
                                className={
                                    "text-muted-foreground truncate text-xs leading-relaxed"
                                }
                            >
                                {truncatedContent}
                            </div>
                        )}
                    </div>

                    {!isCompact && (
                        <div
                            className={
                                "text-muted-foreground text-sm leading-relaxed break-words whitespace-pre-wrap"
                            }
                        >
                            {truncatedContent}
                        </div>
                    )}
                </div>

                {onCancel && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-6 w-6 flex-shrink-0 p-0 opacity-70 transition-opacity hover:opacity-100"
                        onClick={onCancel}
                    >
                        <X size={15} />
                    </Button>
                )}
            </div>
        </div>
    );
}
