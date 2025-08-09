import React from "react";
import { cn } from "@/utils/tailwind";
import { Attachment, User } from "@/api/server";
import { UserPopover } from "../user-popup";
import { MessageContentPart } from "./message-content-processor";
import { AttachmentItem } from "./attachment-item";
import { useSetting } from "@/utils/settings";
import { Code } from "@/components/ui/code";

export type DisabledFeature =
    | "imageLinks"
    | "openGraphPreviews"
    | "youTubeEmbeds"
    | "code";

/**
 * Component for rendering processed message content
 */
export function ProcessedMessageContent({
    parts,
    currentUserId,
    ogDataMap,
    onImageClick,
    disabledFeatures = [],
    onContentLoad,
}: {
    parts: MessageContentPart[];
    currentUserId?: string;
    ogDataMap?: Record<string, OGData | "loading" | "error" | "nodata">;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
    disabledFeatures?: DisabledFeature[];
    onContentLoad?: () => void;
}) {
    const isFeatureDisabled = (feature: DisabledFeature) =>
        disabledFeatures.includes(feature);

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

                        if (
                            linkData?.isYouTubeLink &&
                            linkData.youTubeId &&
                            !isFeatureDisabled("youTubeEmbeds") &&
                            linkData.url
                        ) {
                            return (
                                <React.Fragment key={index}>
                                    <LinkSpan
                                        content={part.content}
                                        url={linkData?.url}
                                    />
                                    <YouTubeEmbed
                                        youTubeId={linkData.youTubeId}
                                        onContentLoad={onContentLoad}
                                    />
                                </React.Fragment>
                            );
                        }

                        if (
                            linkData?.isImageLink &&
                            linkData.url &&
                            !isFeatureDisabled("imageLinks")
                        ) {
                            return (
                                <ImageLinkAttachment
                                    key={index}
                                    content={part.content}
                                    url={linkData.url}
                                    onImageClick={onImageClick}
                                    onContentLoad={onContentLoad}
                                />
                            );
                        }

                        const ogEntry =
                            linkData?.url &&
                            !isFeatureDisabled("openGraphPreviews")
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
                                        onContentLoad={onContentLoad}
                                    />
                                </React.Fragment>
                            );
                        }

                        return (
                            <LinkSpan
                                key={index}
                                content={part.content}
                                url={linkData?.url}
                            />
                        );
                    }
                    case "code":
                        if (isFeatureDisabled("code")) {
                            console.log(part);
                            return (
                                <span
                                    key={index}
                                    className="text-muted-foreground"
                                    style={{ whiteSpace: "pre-wrap" }}
                                >
                                    {part.prefix}
                                    {part.content}
                                    {part.suffix}
                                </span>
                            );
                        }

                        return (
                            <Code
                                key={index}
                                language={part.data?.language || "plaintext"}
                                variant="default"
                            >
                                {part.content}
                            </Code>
                        );
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
    onContentLoad,
}: {
    content: string;
    url: string;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
    onContentLoad?: () => void;
}) {
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
                onContentLoad={onContentLoad}
            />
        </div>
    );
}

/**
 * Generic card-style embed component for previews (OpenGraph, YouTube, etc)
 */
function CardEmbed({
    as = "a",
    href,
    borderColor,
    image,
    imagePosition = "left",
    imageClassName,
    onImageClick,
    children,
    className,
    ...rest
}: {
    as?: "a" | "div";
    href?: string;
    borderColor?: string;
    image?: React.ReactNode;
    imagePosition?: "left" | "right" | "top" | "bottom";
    imageClassName?: string;
    onImageClick?: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    className?: string;
    [key: string]: unknown;
}) {
    const Container = as;
    const flexDirection =
        imagePosition === "top"
            ? "flex-col"
            : imagePosition === "bottom"
              ? "flex-col-reverse"
              : imagePosition === "right"
                ? "flex-row-reverse"
                : "flex-row";

    return (
        <Container
            href={as === "a" ? href : undefined}
            target={as === "a" && href ? "_blank" : undefined}
            rel={as === "a" && href ? "noopener noreferrer" : undefined}
            className={cn(
                "hover:bg-muted/50 text-foreground my-2 mr-12 block max-w-xl rounded-lg border p-3 text-sm no-underline transition-colors",
                className,
            )}
            style={borderColor ? { borderColor } : undefined}
            {...rest}
        >
            <div className={cn("flex gap-3", flexDirection)}>
                {image && (
                    <div
                        className={cn(
                            "flex-shrink-0",
                            imagePosition === "left" ||
                                imagePosition === "right"
                                ? "w-auto"
                                : "w-full",
                            imageClassName,
                        )}
                        onClick={onImageClick}
                    >
                        {image}
                    </div>
                )}
                <div className="min-w-0 flex-grow">{children}</div>
            </div>
        </Container>
    );
}

/**
 * Component for rendering OpenGraph previews
 */
function OpenGraphPreviewSpan({
    ogData,
    originalUrlText,
    onImageClick,
    onContentLoad,
}: {
    ogData: OGData;
    originalUrlText: string;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
    onContentLoad?: () => void;
}) {
    const { title, description, imageUrl, url: ogUrl, themeColor } = ogData;
    const [imgError, setImgError] = React.useState(false);
    const borderColor = useSetting("ogBorderColor") ? themeColor : undefined;

    const handleImageClick = (e: React.MouseEvent) => {
        if (imageUrl && onImageClick) {
            e.preventDefault();
            e.stopPropagation();

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
        <CardEmbed
            href={ogUrl}
            borderColor={borderColor}
            image={
                imageUrl && !imgError ? (
                    <img
                        src={imageUrl}
                        alt={title || "OpenGraph image"}
                        className="h-auto max-h-[98px] w-full cursor-pointer rounded object-contain transition-opacity hover:opacity-80"
                        onClick={handleImageClick}
                        onLoad={() => onContentLoad?.()}
                        onError={() => setImgError(true)}
                    />
                ) : null
            }
            imagePosition="left"
        >
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
        </CardEmbed>
    );
}

/**
 * Component for rendering YouTube video embeds
 */
function YouTubeEmbed({
    youTubeId,
    onContentLoad,
}: {
    youTubeId: string;
    onContentLoad?: () => void;
}) {
    const [videoData, setVideoData] = React.useState<{
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
        loading: boolean;
        error?: string;
    }>({ loading: true });

    React.useEffect(() => {
        const fetchVideoData = async () => {
            try {
                const response = await fetch(
                    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youTubeId}&format=json`,
                );

                if (response.ok) {
                    const data = await response.json();
                    setVideoData({
                        title: data.title,
                        author_name: data.author_name,
                        thumbnail_url: data.thumbnail_url,
                        loading: false,
                    });
                } else {
                    setVideoData({
                        loading: false,
                        error: "Failed to fetch video data",
                    });
                }
            } catch {
                setVideoData({
                    loading: false,
                    error: "Failed to fetch video data",
                });
            }
        };

        fetchVideoData();
    }, [youTubeId]);

    const youtubeUrl = `https://www.youtube.com/watch?v=${youTubeId}`;
    const borderColor = useSetting("ogBorderColor") ? "#ff0033" : undefined;

    return (
        <CardEmbed
            href={youtubeUrl}
            borderColor={borderColor}
            image={
                <div className="relative aspect-video w-full overflow-hidden rounded border">
                    <iframe
                        src={`https://www.youtube.com/embed/${youTubeId}`}
                        title={videoData.title || "YouTube video"}
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        onLoad={() => onContentLoad?.()}
                    />
                </div>
            }
            imagePosition="top"
        >
            <div className="mb-2">
                {videoData.loading ? (
                    <div className="text-muted-foreground text-sm">
                        Loading video info...
                    </div>
                ) : videoData.error ? (
                    <div className="text-primary text-sm font-semibold">
                        YouTube Video
                    </div>
                ) : (
                    <>
                        <div
                            className="text-primary line-clamp-2 font-semibold"
                            title={videoData.title}
                        >
                            {videoData.title}
                        </div>
                        {videoData.author_name && (
                            <div className="text-muted-foreground mt-1 text-xs">
                                by {videoData.author_name}
                            </div>
                        )}
                    </>
                )}
            </div>
        </CardEmbed>
    );
}
