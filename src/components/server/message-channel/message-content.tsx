import React from "react";
import { cn } from "@/utils/tailwind";
import { Attachment, User } from "@/api/server";
import { UserPopover } from "../user-popup";
import { MessageContentPart } from "./message-content-processor";
import { AttachmentItem } from "./attachment-item";

export type OGData = {
    title?: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
    url: string;
};

/**
 * Component for rendering processed message content
 */
export function ProcessedMessageContent({
    parts,
    currentUserId,
    ogDataMap,
    onImageClick,
}: {
    parts: MessageContentPart[];
    currentUserId?: string;
    ogDataMap?: Record<string, OGData | "loading" | "error" | "nodata">;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
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
                    case "link": {
                        const linkData = part.data;
                        if (linkData?.isImageLink && linkData.url) {
                            return (
                                <ImageLinkAttachment
                                    key={index}
                                    content={part.content}
                                    url={linkData.url}
                                    onImageClick={onImageClick}
                                />
                            );
                        }

                        const ogEntry = linkData?.url
                            ? ogDataMap?.[linkData.url]
                            : undefined;

                        if (typeof ogEntry === "object" && ogEntry !== null) {
                            return (
                                <React.Fragment key={index}>
                                    <LinkSpan
                                        content={part.content}
                                        url={linkData?.url}
                                    />
                                    <OpenGraphPreviewSpan
                                        ogData={ogEntry}
                                        originalUrlText={part.content}
                                        onImageClick={onImageClick}
                                    />
                                </React.Fragment>
                            );
                        }
                        // Fallback to simple link if no OG data, or if status is loading/error/nodata
                        return (
                            <LinkSpan
                                key={index}
                                content={part.content}
                                url={linkData?.url}
                            />
                        );
                    }
                    case "text":
                    default:
                        return (
                            <span
                                key={index}
                                style={{ whiteSpace: "pre-wrap" }}
                            >
                                {part.content}
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

/**
 * Component for rendering image links directly as images
 */
function ImageLinkAttachment({
    content,
    url,
    onImageClick,
}: {
    content: string;
    url: string;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
}) {
    // Create a mock attachment object for the image link
    const mockAttachment: Attachment = {
        id: 0,
        file_name: content || url.split("/").pop() || "image",
        file_path: url,
        file_size: 0,
        type: "image",
        message_id: 0,
        mime_type: "image/png",
        file_hash: "",
        created_at: "",
        updated_at: "",
    };

    return (
        <div className="my-1">
            <AttachmentItem
                attachment={mockAttachment}
                onImageClick={onImageClick}
            />
        </div>
    );
}

/**
 * Component for rendering OpenGraph previews
 */
function OpenGraphPreviewSpan({
    ogData,
    originalUrlText,
    onImageClick,
}: {
    ogData: OGData;
    originalUrlText: string;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
}) {
    const { title, description, imageUrl, siteName, url: ogUrl } = ogData;

    const handleImageClick = (e: React.MouseEvent) => {
        if (imageUrl && onImageClick) {
            e.preventDefault();
            e.stopPropagation();

            // Create a mock attachment for the OG image
            const mockAttachment: Attachment = {
                id: 0,
                file_name: title || "image",
                file_path: imageUrl,
                file_size: 0,
                type: "image",
                message_id: 0,
                mime_type: "image/png",
                file_hash: "",
                created_at: "",
                updated_at: "",
            };

            onImageClick(mockAttachment, e.currentTarget as HTMLElement);
        }
    };

    return (
        <a
            href={ogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-muted/50 text-foreground my-2 mr-12 block max-w-xl rounded-lg border p-3 text-sm no-underline transition-colors"
        >
            {siteName && (
                <div className="text-muted-foreground mb-1 text-xs font-medium">
                    {siteName}
                </div>
            )}
            <div className={cn("flex gap-3", !imageUrl && "flex-col")}>
                {imageUrl && (
                    <div className="w-auto flex-shrink-0">
                        <img
                            src={imageUrl}
                            alt={title || "OpenGraph image"}
                            className="h-auto max-h-[98px] w-full cursor-pointer rounded border object-contain transition-opacity hover:opacity-80"
                            onClick={handleImageClick}
                            onError={(e) =>
                                (e.currentTarget.style.display = "none")
                            }
                        />
                    </div>
                )}
                <div className="min-w-0 flex-grow">
                    <div
                        className="text-primary truncate font-semibold"
                        title={title || originalUrlText}
                    >
                        {title || originalUrlText}
                    </div>
                    {description && (
                        <div className="text-muted-foreground line-clamp-5 text-xs">
                            {description}
                        </div>
                    )}
                </div>
            </div>
        </a>
    );
}
