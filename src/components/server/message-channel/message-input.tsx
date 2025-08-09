import React, { useEffect, useRef } from "react";
import { cn } from "@/utils/tailwind";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Send,
    Smile,
    Paperclip,
    X,
    Image as ImageIcon,
    FileText,
    ImagePlay,
} from "lucide-react";
import { formatFileSize, Message } from "@/api/server";
import { EmojiPopup } from "../emoji-popup";
import { ProcessedMessageContent } from "./message-content";
import { MessageContentPart } from "./message-content-processor";
import { useServer } from "@/contexts/server-context";
import { GifPopup } from "./gif-popup";
import { ReplyPreview } from "./reply-preview";

interface MessageInputProps {
    messageText: string;
    onMessageTextChange: (text: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onTextareaBlur: () => void;
    selectedFiles: File[];
    filePreviewUrls: Map<string, string>;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveFile: (index: number) => void;
    onOpenFileDialog: () => void;
    onEmojiSelect: (emoji: string) => void;
    onGifSelect: (gifUrl: string) => void;
    sending: boolean;
    canWrite: boolean;
    channelName: string;
    displayParts: MessageContentPart[];
    currentUserId?: string;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    replyingTo?: Message | null;
    onCancelReply?: () => void;
}

export function MessageInput({
    messageText,
    onMessageTextChange,
    onSend,
    onKeyDown,
    onTextareaBlur,
    selectedFiles,
    filePreviewUrls,
    onFileSelect,
    onRemoveFile,
    onOpenFileDialog,
    onEmojiSelect,
    onGifSelect,
    sending,
    canWrite,
    channelName,
    displayParts,
    currentUserId,
    textareaRef,
    fileInputRef,
    replyingTo,
    onCancelReply,
}: MessageInputProps) {
    const { serverInfo } = useServer();
    const overlayRef = useRef<HTMLDivElement>(null);
    const getFileKey = (file: File) =>
        `${file.name}-${file.size}-${file.lastModified}`;

    useEffect(() => {
        const textarea = textareaRef.current;
        const overlay = overlayRef.current;
        if (!textarea || !overlay) return;

        const handleScroll = () => {
            overlay.scrollTop = textarea.scrollTop;
        };

        handleScroll();
        textarea.addEventListener("scroll", handleScroll);
        return () => {
            textarea.removeEventListener("scroll", handleScroll);
        };
    }, [textareaRef, messageText]);

    return (
        <div
            className={
                "min-h-16 flex-shrink-0 content-center border-t px-3 py-2"
            }
        >
            {replyingTo && (
                <div className="px-3 pt-3">
                    <ReplyPreview
                        replyToMessage={{
                            id: replyingTo.id,
                            author_id: replyingTo.author_id,
                            content: replyingTo.content,
                            created_at: replyingTo.created_at,
                            username: replyingTo.username,
                            nickname: replyingTo.nickname || "",
                        }}
                        onCancel={onCancelReply}
                    />
                </div>
            )}

            {/* File Attachments Preview */}
            {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => {
                        const fileKey = getFileKey(file);
                        const previewUrl = filePreviewUrls.get(fileKey);
                        const isImage = file.type.startsWith("image/");

                        return (
                            <div
                                key={fileKey}
                                className="bg-muted/50 flex max-w-[280px] items-center gap-2 rounded-md border p-2 text-sm"
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    {isImage && previewUrl ? (
                                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
                                            <img
                                                src={previewUrl}
                                                alt={file.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-background flex h-10 w-10 flex-shrink-0 items-center justify-center rounded">
                                            {file.type.startsWith("image/") ? (
                                                <ImageIcon
                                                    size={20}
                                                    className="text-muted-foreground"
                                                />
                                            ) : (
                                                <FileText
                                                    size={20}
                                                    className="text-muted-foreground"
                                                />
                                            )}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="text-foreground truncate font-medium">
                                            {file.name}
                                        </div>
                                        <span className="text-muted-foreground text-xs">
                                            ({formatFileSize(file.size)})
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive h-6 w-6 flex-shrink-0 p-0"
                                    onClick={() => onRemoveFile(index)}
                                    disabled={!canWrite}
                                >
                                    <X size={14} />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}

            {!canWrite && (
                <div className="mb-3 text-center">
                    <p className="text-muted-foreground text-sm">
                        You do not have permission to send messages in this
                        channel.
                    </p>
                </div>
            )}

            <div className="flex items-end gap-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onFileSelect}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                    disabled={!canWrite}
                />

                <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={onOpenFileDialog}
                    disabled={sending || !canWrite}
                >
                    <Paperclip size={20} />
                </Button>

                <div className="relative flex-grow">
                    {/* Rich text display overlay - always visible when there's text */}
                    {messageText && (
                        <div
                            ref={overlayRef}
                            className={cn(
                                "pointer-events-none absolute inset-0 z-10 max-h-[200px] min-h-[40px] overflow-y-hidden text-base md:text-sm",
                                "px-[0.8rem] py-[0.55rem]",
                            )}
                        >
                            <ProcessedMessageContent
                                parts={displayParts}
                                currentUserId={currentUserId}
                                disabledFeatures={[
                                    "imageLinks",
                                    "openGraphPreviews",
                                    "youTubeEmbeds",
                                    "code",
                                    "markdown",
                                ]}
                            />
                        </div>
                    )}

                    <Textarea
                        ref={textareaRef}
                        placeholder={
                            canWrite
                                ? `Message #${channelName}`
                                : "You cannot send messages in this channel"
                        }
                        value={messageText}
                        onChange={(e) => onMessageTextChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        onBlur={onTextareaBlur}
                        className={cn(
                            "max-h-[200px] min-h-[40px] flex-grow resize-none overflow-y-auto",
                            messageText &&
                                "text-transparent caret-black dark:caret-white",
                        )}
                        rows={1}
                        disabled={sending || !canWrite}
                        data-scrollbar-custom
                    />
                </div>

                <GifPopup
                    onGifSelect={onGifSelect}
                    tenorEnabled={!!serverInfo?.tenor_enabled}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        disabled={sending || !canWrite}
                    >
                        <ImagePlay size={20} />
                    </Button>
                </GifPopup>

                <EmojiPopup onEmojiSelect={onEmojiSelect}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        disabled={sending || !canWrite}
                    >
                        <Smile size={20} />
                    </Button>
                </EmojiPopup>

                <Button
                    variant={
                        (messageText.trim() || selectedFiles.length > 0) &&
                        canWrite
                            ? "default"
                            : "ghost"
                    }
                    size="icon"
                    disabled={
                        (!messageText.trim() && selectedFiles.length === 0) ||
                        sending ||
                        !canWrite
                    }
                    onClick={onSend}
                >
                    <Send size={20} />
                </Button>
            </div>
        </div>
    );
}
