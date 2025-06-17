import React from "react";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Star } from "lucide-react";
import { Attachment, formatFileSize } from "@/api/server";
import { CustomVideoPlayer } from "../video-player";
import { downloadFile } from "@/utils/assets";
import {
    getLocalStorageItem,
    updateLocalStorageItem,
} from "@/utils/localstorage";
import { toast } from "sonner";
import { cn } from "@/utils/tailwind";

export function AttachmentItem({
    attachment,
    onImageClick,
    onContentLoad, // Add this prop
}: {
    attachment: Attachment;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
    onContentLoad?: () => void; // Add this prop
}) {
    const isImage = attachment.type === "image";
    const isVideo = attachment.type === "video";
    const fileSize = formatFileSize(attachment.file_size);

    const [starredImages, setStarredImages] = React.useState<string[]>([]);
    React.useEffect(() => {
        const stored = getLocalStorageItem("starred-images") || [];
        setStarredImages(stored);
    }, []);

    const handleStarImage = React.useCallback(
        (e: React.MouseEvent, imageUrl: string) => {
            e.stopPropagation();
            const isCurrentlyStarred = starredImages.includes(imageUrl);

            updateLocalStorageItem("starred-images", (current) => {
                const currentArray = current || [];
                if (isCurrentlyStarred) {
                    return currentArray.filter((url) => url !== imageUrl);
                } else {
                    return [...currentArray, imageUrl];
                }
            });

            setStarredImages((prev) => {
                if (isCurrentlyStarred) {
                    return prev.filter((url) => url !== imageUrl);
                } else {
                    return [...prev, imageUrl];
                }
            });

            toast.success(
                isCurrentlyStarred
                    ? "Removed from starred images"
                    : "Added to starred images",
            );
        },
        [starredImages],
    );

    // Open attachment in a new tab
    const handleOpen = (e: React.MouseEvent) => {
        if (isImage && onImageClick) {
            onImageClick(attachment, e.currentTarget as HTMLElement);
        } else {
            window.open(attachment.file_path, "_blank");
        }
    };

    // Download the attachment
    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await downloadFile(attachment.file_path, attachment.file_name);
    };

    if (isImage) {
        return (
            <div
                className="group relative inline-block cursor-pointer overflow-hidden rounded-md"
                onClick={handleOpen}
            >
                <img
                    src={attachment.file_path}
                    alt={attachment.file_name}
                    className="border-border max-h-[300px] max-w-full rounded-md border object-contain"
                    onLoad={() => onContentLoad?.()} // Trigger scroll when image loads
                />
                <div className="absolute right-0 bottom-0 left-0 flex items-center justify-between bg-black/60 p-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="max-w-[200px] truncate">
                        {attachment.file_name} ({fileSize})
                    </span>
                    <div className="flex gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "h-6 w-6 text-white hover:bg-white/20",
                                starredImages.includes(attachment.file_path) &&
                                    "bg-yellow-500/80 hover:bg-yellow-600/80",
                            )}
                            onClick={(e) =>
                                handleStarImage(e, attachment.file_path)
                            }
                            title={
                                starredImages.includes(attachment.file_path)
                                    ? "Remove from starred"
                                    : "Add to starred"
                            }
                        >
                            <Star
                                size={14}
                                className={
                                    starredImages.includes(attachment.file_path)
                                        ? "fill-current"
                                        : ""
                                }
                            />
                        </Button>
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

    if (isVideo) {
        return (
            <CustomVideoPlayer
                attachment={attachment}
                onDownload={handleDownload}
            />
        );
    }

    return (
        <div
            className="border-border hover:bg-accent/10 flex cursor-pointer items-center gap-2 rounded-md border p-2"
            onClick={handleOpen}
        >
            <div className="bg-primary/10 rounded p-2">
                <FileText size={20} />
            </div>
            <div className="min-w-0 flex-grow">
                <div className="truncate text-sm font-medium">
                    {attachment.file_name}
                </div>
                <div className="text-muted-foreground text-xs">{fileSize}</div>
            </div>
            <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleDownload}
            >
                <Download size={16} />
            </Button>
        </div>
    );
}
