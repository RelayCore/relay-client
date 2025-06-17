import React from "react";
import { cn } from "@/utils/tailwind";
import { User } from "@/api/server";
import { UserPopover } from "../user-popup";
import { MessageContentPart } from "./message-content-processor";

/**
 * Component for rendering processed message content
 */
export function ProcessedMessageContent({
    parts,
    currentUserId,
}: {
    parts: MessageContentPart[];
    currentUserId?: string;
}) {
    return (
        <>
            {parts.map((part, index) => {
                switch (part.type) {
                    case "mention":
                        return (
                            <MentionSpan
                                key={index}
                                content={part.content}
                                user={part.data?.user}
                                currentUserId={currentUserId}
                            />
                        );
                    case "link":
                        return (
                            <LinkSpan
                                key={index}
                                content={part.content}
                                url={part.data?.url}
                            />
                        );
                    case "text":
                    default:
                        return (
                            <span key={index}>
                                {part.content
                                    .split("\n")
                                    .map((line, lineIndex, lines) => (
                                        <React.Fragment key={lineIndex}>
                                            {line}
                                            {lineIndex < lines.length - 1 && (
                                                <br />
                                            )}
                                        </React.Fragment>
                                    ))}
                            </span>
                        );
                }
            })}
        </>
    );
}

/**
 * Component for rendering mentions
 */
function MentionSpan({
    content,
    user,
    currentUserId,
}: {
    content: string;
    user?: User;
    currentUserId?: string;
}) {
    const isCurrentUser = user?.id === currentUserId;

    return (
        <UserPopover
            user={
                user ?? {
                    id: "unknown",
                    username: "Unknown",
                    nickname: "",
                    roles: [],
                    is_online: false,
                    profile_picture_url: "",
                }
            }
            currentUserId={currentUserId}
        >
            <span
                className={cn(
                    "cursor-pointer rounded px-0.75 py-0.25 text-xs font-medium whitespace-nowrap",
                    user
                        ? isCurrentUser
                            ? "bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30 dark:text-yellow-400"
                            : "bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 dark:text-blue-400"
                        : "bg-gray-500/20 text-gray-600 dark:text-gray-400",
                )}
            >
                {content}
            </span>
        </UserPopover>
    );
}

/**
 * Component for rendering links (future feature)
 */
function LinkSpan({ content, url }: { content: string; url?: string }) {
    return (
        <a
            href={url || content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-positive hover:underline"
        >
            {content}
        </a>
    );
}
