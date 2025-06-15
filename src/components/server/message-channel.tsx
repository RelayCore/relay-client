import React from "react";
import { cn } from "@/utils/tailwind";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Send,
    Smile,
    Paperclip,
    Download,
    ExternalLink,
    Image as ImageIcon,
    FileText,
    X,
} from "lucide-react";
import {
    Message,
    Attachment,
    formatFileSize,
    getChannelMessages,
    sendMessageWithAttachments,
    getChannels,
    Channel,
    canWriteToChannel,
} from "@/api/server";
import {
    webSocketManager,
    WebSocketMessage,
    MessageBroadcast,
    MessageDeletedBroadcast,
    MESSAGE_TYPES,
} from "@/websocket/websocket-manager";
import { MessageContextMenu } from "./message-context-menu";
import { UserPopover } from "./user-popup";
import { useMembers } from "@/contexts/server-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServer } from "@/contexts/server-context";
import { EmojiPopup } from "./emoji-popup";

export interface MessageChannelProps {
    channelId: number;
    channelName?: string;
    currentUserId?: string;
    serverUrl: string;
    className?: string;
}

export default function MessageChannel({
    channelId,
    channelName = "general",
    currentUserId,
    serverUrl,
    className,
}: MessageChannelProps) {
    const [messageText, setMessageText] = React.useState("");
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
    const [sending, setSending] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [filePreviewUrls, setFilePreviewUrls] = React.useState<
        Map<string, string>
    >(new Map());
    const [openedImage, setOpenedImage] = React.useState<Attachment | null>(
        null,
    );
    const [currentChannel, setCurrentChannel] = React.useState<Channel | null>(
        null,
    );
    const messagesContainerRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const dropZoneRef = React.useRef<HTMLDivElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const { currentUser } = useCurrentUser();
    const { serverInfo } = useServer(); // <-- get serverInfo from context

    const scrollToBottom = React.useCallback(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
                messagesContainerRef.current.scrollHeight;
        }
    }, []);

    const handleMessageDeleted = React.useCallback((messageId: number) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    }, []);

    const handleMessagePinned = React.useCallback((messageId: number) => {
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === messageId ? { ...msg, pinned: true } : msg,
            ),
        );
    }, []);

    const handleMessageUnpinned = React.useCallback((messageId: number) => {
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === messageId ? { ...msg, pinned: false } : msg,
            ),
        );
    }, []);

    // Handle WebSocket messages
    React.useEffect(() => {
        if (!currentUserId) return;

        const handleWebSocketMessage = (message: WebSocketMessage) => {
            switch (message.type) {
                case MESSAGE_TYPES.MESSAGE_BROADCAST: {
                    const messageData = message.data as MessageBroadcast;
                    if (messageData.channel_id === channelId) {
                        const newMessage: Message = {
                            id: messageData.id,
                            channel_id: messageData.channel_id,
                            author_id: messageData.author_id,
                            username: messageData.username || "",
                            content: messageData.content,
                            created_at: messageData.created_at,
                            attachments: [],
                            pinned: false,
                        };

                        setMessages((prev) => {
                            if (prev.some((msg) => msg.id === newMessage.id)) {
                                return prev;
                            }
                            const updatedMessages = [...prev, newMessage];
                            return updatedMessages.sort(
                                (a, b) =>
                                    new Date(a.created_at).getTime() -
                                    new Date(b.created_at).getTime(),
                            );
                        });
                    }
                    break;
                }
                case MESSAGE_TYPES.MESSAGE_DELETED: {
                    const deleteData = message.data as MessageDeletedBroadcast;
                    if (deleteData.channel_id === channelId) {
                        setMessages((prev) =>
                            prev.filter(
                                (msg) => msg.id !== deleteData.message_id,
                            ),
                        );
                    }
                    break;
                }
            }
        };

        // Add message handler
        webSocketManager.addMessageHandler(
            currentUserId,
            handleWebSocketMessage,
        );

        // Cleanup
        return () => {
            webSocketManager.removeMessageHandler(
                currentUserId,
                handleWebSocketMessage,
            );
        };
    }, [currentUserId, channelId]);

    // Fetch messages when channelId changes
    React.useEffect(() => {
        const fetchMessages = async () => {
            if (!channelId || !currentUserId) return;

            setLoading(true);
            setError(null);

            try {
                const response = await getChannelMessages(
                    serverUrl,
                    currentUserId,
                    channelId,
                    50,
                    0,
                );
                // Sort messages by creation date to ensure proper order
                const sortedMessages = response.messages.sort(
                    (a, b) =>
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
                );
                setMessages(sortedMessages);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch messages",
                );
                setMessages([]);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [channelId, currentUserId, serverUrl]);

    // Scroll to bottom when messages change
    React.useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Scroll to bottom on initial render
    React.useEffect(() => {
        scrollToBottom();
    }, [scrollToBottom]);

    const handleSend = async () => {
        if (
            (!messageText.trim() && selectedFiles.length === 0) ||
            !currentUserId ||
            sending
        )
            return;

        // Check write permissions before sending
        if (currentChannel && !canWriteToChannel(currentChannel, currentUser)) {
            console.warn(
                "User does not have permission to write in this channel",
            );
            return;
        }

        // Store the current message and files before clearing
        const messageToSend = messageText.trim();
        const filesToSend = [...selectedFiles]; // Create a copy

        // Set sending state immediately to prevent duplicate calls
        setSending(true);

        try {
            // Clear the input and files after setting sending state
            setMessageText("");
            setSelectedFiles([]);
            filePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
            setFilePreviewUrls(new Map());

            await sendMessageWithAttachments(
                serverUrl,
                currentUserId,
                channelId,
                messageToSend,
                filesToSend.length > 0 ? filesToSend : undefined,
            );
        } catch (err) {
            console.error("Failed to send message:", err);
            // Restore the message and files on error
            setMessageText(messageToSend);
            setSelectedFiles(filesToSend);

            // Recreate file preview URLs
            const newUrls = new Map<string, string>();
            filesToSend.forEach((file) => {
                const previewUrl = createFilePreview(file);
                if (previewUrl) {
                    newUrls.set(getFileKey(file), previewUrl);
                }
            });
            setFilePreviewUrls(newUrls);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && !sending) {
            e.preventDefault();
            handleSend();
        }
    };

    const getFileKey = (file: File) =>
        `${file.name}-${file.size}-${file.lastModified}`;

    const validateAndProcessFiles = React.useCallback(
        (incomingFiles: File[]): File[] => {
            // Use serverInfo for limits, fallback to defaults if not loaded
            const maxSize = serverInfo?.max_file_size ?? 50 * 1024 * 1024; // bytes
            const maxFiles = serverInfo?.max_attachments ?? 10;

            // Filter out files that are too large
            let validFiles = incomingFiles.filter((file) => {
                if (file.size > maxSize) {
                    console.warn(
                        `File ${file.name} is too large (${formatFileSize(
                            file.size,
                        )}). Max size is ${formatFileSize(maxSize)}.`,
                    );
                    return false;
                }
                return true;
            });

            // Limit total number of files
            const currentFileCount = selectedFiles.length;
            const availableSlots = maxFiles - currentFileCount;

            if (validFiles.length > availableSlots) {
                if (availableSlots <= 0) {
                    console.warn(
                        `Maximum number of files (${maxFiles}) already selected. No more files can be added.`,
                    );
                    validFiles = [];
                } else {
                    console.warn(
                        `Too many files selected. Only ${availableSlots} more files will be added. Max ${maxFiles} total.`,
                    );
                    validFiles = validFiles.slice(0, availableSlots);
                }
            }
            return validFiles;
        },
        [selectedFiles.length, serverInfo],
    );

    const createFilePreview = React.useCallback((file: File): string | null => {
        if (file.type.startsWith("image/")) {
            return URL.createObjectURL(file);
        }
        return null;
    }, []);

    const addFiles = React.useCallback(
        (incomingFiles: File[]) => {
            const newFilesToAdd = validateAndProcessFiles(incomingFiles);
            if (newFilesToAdd.length === 0) return;

            setSelectedFiles((prevFiles) => [...prevFiles, ...newFilesToAdd]);

            setFilePreviewUrls((prevUrls) => {
                const newUrls = new Map(prevUrls);
                newFilesToAdd.forEach((file) => {
                    const previewUrl = createFilePreview(file);
                    if (previewUrl) {
                        newUrls.set(getFileKey(file), previewUrl);
                    }
                });
                return newUrls;
            });
        },
        [validateAndProcessFiles, createFilePreview],
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        addFiles(files);

        // Reset the input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removeFile = (index: number) => {
        const fileToRemove = selectedFiles[index];
        if (!fileToRemove) return;
        const fileKey = getFileKey(fileToRemove);

        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

        setFilePreviewUrls((prevUrls) => {
            const newUrls = new Map(prevUrls);
            const urlToRevoke = newUrls.get(fileKey);
            if (urlToRevoke) {
                URL.revokeObjectURL(urlToRevoke);
                newUrls.delete(fileKey);
            }
            return newUrls;
        });
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    // Drag and Drop Handlers
    const handleDragEnter = React.useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            // Check if the drag event contains files
            if (e.dataTransfer.types.includes("Files")) {
                setIsDragging(true);
            }
        },
        [],
    );

    const handleDragLeave = React.useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            // Check if the mouse is leaving the dropZoneRef element entirely
            if (
                dropZoneRef.current &&
                !dropZoneRef.current.contains(e.relatedTarget as Node)
            ) {
                setIsDragging(false);
            }
        },
        [],
    );

    const handleDragOver = React.useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.types.includes("Files") && !isDragging) {
                setIsDragging(true);
            }
        },
        [isDragging],
    );

    const handleDrop = React.useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                addFiles(Array.from(e.dataTransfer.files));
            }
        },
        [addFiles],
    );

    // Effect to clean up ObjectURLs when component unmounts
    React.useEffect(() => {
        return () => {
            filePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [filePreviewUrls]);

    // Close image modal on Escape key
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && openedImage) {
                setOpenedImage(null);
            }
        };

        if (openedImage) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [openedImage]);

    // Fetch current channel data to check permissions
    React.useEffect(() => {
        const fetchChannelData = async () => {
            if (!channelId || !currentUserId) return;

            try {
                const response = await getChannels(serverUrl, currentUserId);
                const channel = response.groups
                    .flatMap((group) => group.channels)
                    .find((ch) => ch.id === channelId);

                setCurrentChannel(channel || null);
            } catch (err) {
                console.error("Failed to fetch channel data:", err);
                setCurrentChannel(null);
            }
        };

        fetchChannelData();
    }, [channelId, currentUserId, serverUrl]);

    const handleEmojiSelect = React.useCallback(
        (emoji: string) => {
            if (!textareaRef.current) return;

            const textarea = textareaRef.current;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const currentText = messageText;

            const newText =
                currentText.slice(0, start) + emoji + currentText.slice(end);
            setMessageText(newText);

            // Set cursor position after the emoji
            setTimeout(() => {
                if (textarea) {
                    const newPosition = start + emoji.length;
                    textarea.setSelectionRange(newPosition, newPosition);
                    textarea.focus();
                }
            }, 0);
        },
        [messageText],
    );

    if (loading) {
        return <MessageChannelSkeleton />;
    }

    if (error) {
        return (
            <div
                ref={dropZoneRef} // Apply ref to the root div in error state too
                className={cn(
                    "relative flex h-full flex-col",
                    className,
                    isDragging && "border-primary/30",
                )}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDragging && (
                    <div className="border-primary bg-accent/70 pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center">
                        <Paperclip size={32} className="text-primary mb-2" />
                        <p className="text-primary text-sm font-semibold">
                            Drop files here to attach
                        </p>
                        <p className="text-muted-foreground text-xs">
                            Up to 10 files, 50MB each
                        </p>
                    </div>
                )}
                <div className="flex h-12 items-center gap-2 border-b p-3">
                    <span className="text-lg font-medium">#{channelName}</span>
                </div>
                <div className="flex flex-grow items-center justify-center">
                    <div className="text-muted-foreground text-center">
                        <p className="text-lg font-semibold">
                            Failed to load messages
                        </p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Check if user can write to this channel
    const canWrite = currentChannel
        ? canWriteToChannel(currentChannel, currentUser)
        : true;

    // Don't render context menu if required data is missing
    const canShowContextMenu = currentUserId && currentUser && currentChannel;

    return (
        <div
            ref={dropZoneRef}
            className={cn(
                "relative flex h-full flex-col transition-colors",
                className,
                isDragging && "border-primary/30",
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Image Modal */}
            {openedImage && (
                <div
                    className="fixed inset-0 z-50 flex flex-col bg-black/80"
                    onClick={() => setOpenedImage(null)}
                >
                    {/* Controls at the top */}
                    <div className="flex items-center justify-between p-4 text-white">
                        <div className="max-w-md truncate text-sm">
                            {openedImage.file_name} (
                            {formatFileSize(openedImage.file_size)})
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const link = document.createElement("a");
                                    link.href = openedImage.file_path;
                                    link.download = openedImage.file_name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                            >
                                <Download size={16} />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(
                                        openedImage.file_path,
                                        "_blank",
                                    );
                                }}
                            >
                                <ExternalLink size={16} />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8"
                                onClick={() => setOpenedImage(null)}
                            >
                                <X size={16} />
                            </Button>
                        </div>
                    </div>

                    {/* Image container */}
                    <div className="flex flex-1 items-center justify-center p-4">
                        <img
                            src={openedImage.file_path}
                            alt={openedImage.file_name}
                            className="max-h-full max-w-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            <div className="flex h-12 items-center gap-2 border-b p-3">
                <span className="text-lg font-medium">#{channelName}</span>
            </div>

            <div
                ref={messagesContainerRef}
                className="flex-grow overflow-auto px-3 py-3"
            >
                {messages.length === 0 ? (
                    <div className="text-muted-foreground py-10 text-center">
                        <p className="text-lg font-semibold">
                            Welcome to #{channelName}!
                        </p>
                        <p className="text-sm">
                            This is the start of the conversation.
                        </p>
                    </div>
                ) : (
                    <div>
                        {messages.map((message, index) => {
                            const prevMessage =
                                index > 0 ? messages[index - 1] : null;

                            const showHeader =
                                index === 0 ||
                                prevMessage?.author_id !== message.author_id ||
                                new Date(message.created_at).getTime() -
                                    new Date(
                                        prevMessage?.created_at || 0,
                                    ).getTime() >
                                    5 * 60 * 1000;

                            const messageElement = (
                                <MessageItem
                                    message={message}
                                    showHeader={showHeader}
                                    currentUserId={currentUserId}
                                    onImageClick={setOpenedImage}
                                />
                            );

                            return canShowContextMenu ? (
                                <MessageContextMenu
                                    key={message.id}
                                    message={message}
                                    serverUrl={serverUrl}
                                    currentUserId={currentUserId}
                                    currentUser={currentUser}
                                    channel={currentChannel}
                                    isPinned={message.pinned || false}
                                    onMessageDeleted={handleMessageDeleted}
                                    onMessagePinned={handleMessagePinned}
                                    onMessageUnpinned={handleMessageUnpinned}
                                >
                                    {messageElement}
                                </MessageContextMenu>
                            ) : (
                                <div key={message.id}>{messageElement}</div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className={cn("border-t p-3")}>
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
                                                {file.type.startsWith(
                                                    "image/",
                                                ) ? ( // Fallback if previewUrl is not ready
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
                                        onClick={() => removeFile(index)}
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
                        onChange={handleFileSelect}
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                        disabled={!canWrite}
                    />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={openFileDialog}
                        disabled={sending || !canWrite}
                    >
                        <Paperclip size={20} />
                    </Button>

                    <Textarea
                        ref={textareaRef}
                        placeholder={
                            canWrite
                                ? `Message #${channelName}`
                                : "You cannot send messages in this channel"
                        }
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="max-h-[120px] min-h-[40px] flex-grow resize-none overflow-y-auto"
                        rows={1}
                        disabled={sending || !canWrite}
                    />

                    <EmojiPopup onEmojiSelect={handleEmojiSelect}>
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
                            (!messageText.trim() &&
                                selectedFiles.length === 0) ||
                            sending ||
                            !canWrite
                        }
                        onClick={handleSend}
                    >
                        <Send size={20} />
                    </Button>
                </div>
            </div>
        </div>
    );
}

function MessageItem({
    message,
    showHeader = true,
    currentUserId,
    onImageClick,
}: {
    message: Message;
    showHeader?: boolean;
    currentUserId?: string;
    onImageClick?: (attachment: Attachment) => void;
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
        created_at: new Date().toISOString(),
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
        <div
            className={cn(
                "hover:bg-accent/20 -mx-3 px-3 py-1",
                showHeader ? "mt-1" : "mt-0",
            )}
        >
            {(showHeader && (
                <div className="flex items-center gap-2">
                    <UserPopover user={user} currentUserId={currentUserId}>
                        <Avatar className="h-10 w-10 cursor-pointer self-start">
                            <AvatarFallback
                                className="text-sm"
                                style={{
                                    backgroundColor: highestColoredRole?.color
                                        ? `${highestColoredRole.color}20`
                                        : undefined,
                                    color:
                                        highestColoredRole?.color || undefined,
                                }}
                            >
                                {avatarText}
                            </AvatarFallback>
                        </Avatar>
                    </UserPopover>

                    <div>
                        <UserPopover user={user} currentUserId={currentUserId}>
                            <span
                                className="mr-2 cursor-pointer text-sm font-medium hover:underline"
                                style={{ color: roleColor }}
                            >
                                {displayName}
                            </span>
                        </UserPopover>
                        <span className="text-muted-foreground text-xs">
                            {formattedDate}
                        </span>
                        <div
                            className={cn(
                                "text-sm break-words whitespace-pre-wrap",
                                showHeader ? "" : "mt-0.5",
                            )}
                        >
                            {message.content}
                        </div>
                    </div>
                </div>
            )) || (
                <div
                    className={cn(
                        "ml-12 text-sm break-words whitespace-pre-wrap",
                        showHeader ? "" : "mt-0.5",
                    )}
                >
                    {message.content}
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function AttachmentItem({
    attachment,
    onImageClick,
}: {
    attachment: Attachment;
    onImageClick?: (attachment: Attachment) => void;
}) {
    const isImage = attachment.type === "image";
    const fileSize = formatFileSize(attachment.file_size);

    // Open attachment in a new tab
    const handleOpen = () => {
        if (isImage && onImageClick) {
            onImageClick(attachment);
        } else {
            window.open(attachment.file_path, "_blank");
        }
    };

    // Download the attachment
    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = document.createElement("a");
        link.href = attachment.file_path;
        link.download = attachment.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    return (
        <div
            className="border-border hover:bg-accent/10 flex cursor-pointer items-center gap-2 rounded-md border p-2"
            onClick={handleOpen}
        >
            <div className="bg-primary/10 rounded p-2">
                {attachment.type === "video" ? (
                    <ImageIcon size={20} />
                ) : (
                    <FileText size={20} />
                )}
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

function MessageChannelSkeleton() {
    return (
        <div className="flex h-full flex-col">
            <div className="flex h-12 items-center border-b p-3">
                <Skeleton className="h-5 w-32" />
            </div>

            <div className="flex-grow space-y-6 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                        <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
                        <div className="w-full space-y-2">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t p-3">
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
}
