import React from "react";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText } from "lucide-react";
import { Attachment, formatFileSize } from "@/api/server";
import { CustomVideoPlayer } from "../video-player";
import { downloadFile } from "@/utils/assets";

export function AttachmentItem({
    attachment,
    onImageClick,
}: {
    attachment: Attachment;
    onImageClick?: (
        attachment: Attachment,
        sourceElement?: HTMLElement,
    ) => void;
}) {
    const isImage = attachment.type === "image";
    const isVideo = attachment.type === "video";
    const fileSize = formatFileSize(attachment.file_size);

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
                />
                <div className="absolute right-0 bottom-0 left-0 flex items-center justify-between bg-black/60 p-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="max-w-[200px] truncate">
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
