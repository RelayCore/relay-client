import React from "react";
import { cn } from "@/utils/tailwind";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
    Channel,
    canWriteToChannel,
    editMessage,
    User,
} from "@/api/server";
import {
    webSocketManager,
    WebSocketMessage,
    MessageBroadcast,
    MessageDeletedBroadcast,
    MESSAGE_TYPES,
    MessageEditedBroadcast,
} from "@/websocket/websocket-manager";
import { MessageContextMenu } from "./message-context-menu";
import { UserPopover } from "./user-popup";
import { useMembers } from "@/contexts/server-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServer } from "@/contexts/server-context";
import { EmojiPopup } from "./emoji-popup";
import { CustomVideoPlayer } from "./video-player";
import { UserAvatar } from "./user-avatar";
import { MentionsPopup } from "./mention-popup";
import { toast } from "sonner";
import { cacheManager } from "@/utils/cache-manager";

type MessageContentPart = {
    type: "text" | "mention" | "tag" | "link" | "emoji";
    content: string;
    data?: {
        user?: User;
        url?: string;
        tagName?: string;
        emojiCode?: string;
    };
};

class MessageContentProcessor {
    private users: User[];

    constructor(users: User[]) {
        this.users = users;
    }

    /**
     * Process message content and return an array of content parts
     * This is the main entry point for all content processing
     */
    processContent(text: string): MessageContentPart[] {
        let parts: MessageContentPart[] = [{ type: "text", content: text }];

        // Apply processors in order
        parts = this.processMentions(parts);
        // Future processors can be added here:
        // parts = this.processLinks(parts);

        return parts;
    }

    /**
     * Process @mentions in the content
     */
    private processMentions(parts: MessageContentPart[]): MessageContentPart[] {
        const newParts: MessageContentPart[] = [];

        for (const part of parts) {
            if (part.type !== "text") {
                newParts.push(part);
                continue;
            }

            const mentionParts = this.extractMentions(part.content);
            newParts.push(...mentionParts);
        }

        return newParts;
    }

    /**
     * Extract mentions from a text string
     */
    private extractMentions(text: string): MessageContentPart[] {
        const parts: MessageContentPart[] = [];
        let lastIndex = 0;

        const mentionRegex = /@(\w+)/g;
        let match;

        while ((match = mentionRegex.exec(text)) !== null) {
            const [fullMatch, username] = match;
            const startIndex = match.index;

            // Add text before mention
            if (startIndex > lastIndex) {
                parts.push({
                    type: "text",
                    content: text.slice(lastIndex, startIndex),
                });
            }

            // Find the mentioned user
            const mentionedUser = this.users.find(
                (user) => user.username === username,
            );

            // Add mention part
            parts.push({
                type: "mention",
                content: fullMatch,
                data: { user: mentionedUser },
            });

            lastIndex = startIndex + fullMatch.length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({
                type: "text",
                content: text.slice(lastIndex),
            });
        }

        return parts.length > 0 ? parts : [{ type: "text", content: text }];
    }

    /**
     * Future method for processing tags like #general
     */
    private processTags(parts: MessageContentPart[]): MessageContentPart[] {
        const newParts: MessageContentPart[] = [];

        for (const part of parts) {
            if (part.type !== "text") {
                newParts.push(part);
                continue;
            }

            // Tag processing logic would go here
            // For now, just pass through
            newParts.push(part);
        }

        return newParts;
    }

    /**
     * Future method for processing links
     */
    private processLinks(parts: MessageContentPart[]): MessageContentPart[] {
        const newParts: MessageContentPart[] = [];

        for (const part of parts) {
            if (part.type !== "text") {
                newParts.push(part);
                continue;
            }

            // Link processing logic would go here
            // For now, just pass through
            newParts.push(part);
        }

        return newParts;
    }
}

/**
 * Component for rendering processed message content
 */
function ProcessedMessageContent({
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
    const [editingMessageId, setEditingMessageId] = React.useState<
        number | null
    >(null);
    const [editingText, setEditingText] = React.useState("");

    // Mention popup state
    const [mentionPopupOpen, setMentionPopupOpen] = React.useState(false);
    const [mentionSearchQuery, setMentionSearchQuery] = React.useState("");
    const [mentionSelectedIndex, setMentionSelectedIndex] = React.useState(0);
    const [mentionStartPos, setMentionStartPos] = React.useState(0);

    const messagesContainerRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const dropZoneRef = React.useRef<HTMLDivElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const mentionAnchorRef = React.useRef<HTMLDivElement>(null);

    const { currentUser } = useCurrentUser();
    const { serverInfo, getSelectedChannel } = useServer();
    const { users } = useMembers();

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
                            updated_at: messageData.updated_at || "",
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
                    cacheManager.deleteMessage(
                        currentUserId,
                        channelId,
                        deleteData.message_id,
                    );
                    if (deleteData.channel_id === channelId) {
                        setMessages((prev) =>
                            prev.filter(
                                (msg) => msg.id !== deleteData.message_id,
                            ),
                        );
                    }
                    break;
                }
                case MESSAGE_TYPES.MESSAGE_EDITED: {
                    const editData = message.data as MessageEditedBroadcast;
                    cacheManager.updateMessage(
                        currentUserId,
                        channelId,
                        editData.id,
                        {
                            content: editData.content,
                            updated_at: editData.updated_at,
                        },
                    );

                    if (editData.channel_id === channelId) {
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === editData.id
                                    ? { ...msg, content: editData.content }
                                    : msg,
                            ),
                        );

                        // If we're currently editing this message, cancel the edit
                        if (editingMessageId === editData.id) {
                            setEditingMessageId(null);
                            setEditingText("");
                        }
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
    }, [currentUserId, channelId, editingMessageId]);

    // Fetch messages when channelId changes
    React.useEffect(() => {
        const fetchMessages = async () => {
            if (!channelId || !currentUserId) return;

            // Try cache first
            const cachedMessages = cacheManager.getMessages(
                currentUserId,
                channelId,
            );
            if (cachedMessages && cachedMessages.length > 0) {
                setMessages(cachedMessages);
                setLoading(false);
                return;
            }

            // No cache, fetch fresh
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

                const sortedMessages = response.messages.sort(
                    (a, b) =>
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
                );

                setMessages(sortedMessages);
                cacheManager.setMessages(
                    currentUserId,
                    channelId,
                    sortedMessages,
                );
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

    // Handle text change for mentions
    const handleTextChange = React.useCallback((newText: string) => {
        setMessageText(newText);

        if (!textareaRef.current) return;

        const cursorPos = textareaRef.current.selectionStart;
        const textBeforeCursor = newText.slice(0, cursorPos);

        // Find the last @ symbol before cursor
        const lastAtPos = textBeforeCursor.lastIndexOf("@");

        if (lastAtPos === -1) {
            // No @ found, close mention popup
            setMentionPopupOpen(false);
            setMentionSearchQuery("");
            setMentionSelectedIndex(0);
            return;
        }

        // Check if there's a space between @ and cursor (invalid mention)
        const textAfterAt = textBeforeCursor.slice(lastAtPos + 1);
        if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
            setMentionPopupOpen(false);
            setMentionSearchQuery("");
            setMentionSelectedIndex(0);
            return;
        }

        // Valid mention context
        setMentionStartPos(lastAtPos);
        setMentionSearchQuery(textAfterAt);
        setMentionSelectedIndex(0);
        setMentionPopupOpen(true);

        // Position the anchor element above the textarea
        if (mentionAnchorRef.current && textareaRef.current) {
            const textareaRect = textareaRef.current.getBoundingClientRect();

            mentionAnchorRef.current.style.position = "fixed";
            mentionAnchorRef.current.style.left = `${textareaRect.left}px`;
            mentionAnchorRef.current.style.top = `${textareaRect.top - 8}px`;
            mentionAnchorRef.current.style.width = "1px";
            mentionAnchorRef.current.style.height = "1px";
            mentionAnchorRef.current.style.pointerEvents = "none";
        }
    }, []);

    const handleMentionSelect = React.useCallback(
        (user: User) => {
            if (!textareaRef.current) return;

            const textarea = textareaRef.current;
            const beforeMention = messageText.slice(0, mentionStartPos);
            const afterCursor = messageText.slice(textarea.selectionStart);

            // Create the mention text
            const mentionText = `@${user.username}`;
            const newText = beforeMention + mentionText + " " + afterCursor;

            setMessageText(newText);
            setMentionPopupOpen(false);
            setMentionSearchQuery("");
            setMentionSelectedIndex(0);

            // Set cursor position after the mention
            setTimeout(() => {
                const newCursorPos = mentionStartPos + mentionText.length + 1;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                textarea.focus();
            }, 0);
        },
        [messageText, mentionStartPos],
    );

    const handleMentionKeyDown = React.useCallback(
        (e: React.KeyboardEvent) => {
            if (!mentionPopupOpen) return;

            // Filter users for the current search
            const filteredUsers = users
                .filter((user) => {
                    const displayName = user.nickname || user.username;
                    return (
                        displayName
                            .toLowerCase()
                            .includes(mentionSearchQuery.toLowerCase()) ||
                        user.username
                            .toLowerCase()
                            .includes(mentionSearchQuery.toLowerCase())
                    );
                })
                .slice(0, 10);

            if (filteredUsers.length === 0) return;

            switch (e.key) {
                case "ArrowUp":
                    e.preventDefault();
                    setMentionSelectedIndex((prev) =>
                        prev <= 0 ? filteredUsers.length - 1 : prev - 1,
                    );
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setMentionSelectedIndex((prev) =>
                        prev >= filteredUsers.length - 1 ? 0 : prev + 1,
                    );
                    break;
                case "Enter":
                case "Tab": {
                    e.preventDefault();
                    const selectedUser = filteredUsers[mentionSelectedIndex];
                    if (selectedUser) {
                        handleMentionSelect(selectedUser);
                    }
                    break;
                }
                case "Escape":
                    e.preventDefault();
                    setMentionPopupOpen(false);
                    setMentionSearchQuery("");
                    setMentionSelectedIndex(0);
                    break;
            }
        },
        [
            mentionPopupOpen,
            mentionSearchQuery,
            mentionSelectedIndex,
            users,
            handleMentionSelect,
        ],
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Handle mention popup navigation first
        handleMentionKeyDown(e);

        // Don't send message if mention popup is open and user pressed Enter
        if (mentionPopupOpen && e.key === "Enter") {
            return;
        }

        if (e.key === "Enter" && !e.shiftKey && !sending) {
            e.preventDefault();
            handleSend();
        }
    };

    // Close mention popup when textarea loses focus
    const handleTextareaBlur = React.useCallback(() => {
        // Small delay to allow mention selection to work
        setTimeout(() => {
            setMentionPopupOpen(false);
            setMentionSearchQuery("");
            setMentionSelectedIndex(0);
        }, 150);
    }, []);

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
            // Only hide dragging if we're leaving the main drop zone container
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
            // Always set dragging to true when files are being dragged over
            if (e.dataTransfer.types.includes("Files")) {
                setIsDragging(true);
            }
        },
        [],
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

    // Get current channel data using getSelectedChannel instead of fetching all channels
    React.useEffect(() => {
        const channel = getSelectedChannel();
        setCurrentChannel(channel);
    }, [getSelectedChannel]);

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

    const handleMessageEdit = React.useCallback(
        (messageId: number) => {
            const messageToEdit = messages.find((msg) => msg.id === messageId);
            if (messageToEdit) {
                setEditingMessageId(messageId);
                setEditingText(messageToEdit.content);
            }
        },
        [messages],
    );

    const handleEditSave = async (messageId: number, newContent: string) => {
        if (!currentUserId || !newContent.trim()) return;

        try {
            const updatedMessage = await editMessage(
                serverUrl,
                currentUserId,
                messageId,
                newContent.trim(),
            );

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === messageId
                        ? { ...msg, content: updatedMessage.content }
                        : msg,
                ),
            );

            setEditingMessageId(null);
            setEditingText("");
            toast.success("Message edited");
        } catch (error) {
            console.error("Failed to edit message:", error);
            toast.error("Failed to edit message");
        }
    };

    const handleEditCancel = () => {
        setEditingMessageId(null);
        setEditingText("");
    };

    // Parse message text to identify mentions for styling
    const parseMessageForDisplay = React.useCallback(
        (text: string) => {
            const processor = new MessageContentProcessor(users);
            return processor.processContent(text);
        },
        [users],
    );

    const displayParts = React.useMemo(() => {
        return parseMessageForDisplay(messageText);
    }, [messageText, parseMessageForDisplay]);

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
                isDragging && "bg-accent/5",
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Mention popup anchor - positioned above textarea */}
            <div
                ref={mentionAnchorRef}
                style={{
                    position: "fixed",
                    pointerEvents: "none",
                    zIndex: 1000,
                }}
            />

            {/* Mention popup */}
            <MentionsPopup
                isOpen={mentionPopupOpen}
                onClose={() => {
                    setMentionPopupOpen(false);
                    setMentionSearchQuery("");
                    setMentionSelectedIndex(0);
                }}
                onMentionSelect={handleMentionSelect}
                searchQuery={mentionSearchQuery}
                selectedIndex={mentionSelectedIndex}
                anchorRef={mentionAnchorRef}
            />

            {/* Drag Overlay */}
            {isDragging && (
                <div className="border-primary bg-accent/80 pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center backdrop-blur-sm">
                    <Paperclip size={48} className="text-primary mb-4" />
                    <p className="text-primary mb-2 text-lg font-semibold">
                        Drop files here to attach
                    </p>
                    <p className="text-muted-foreground text-sm">
                        Up to {serverInfo?.max_attachments ?? 10} files,{" "}
                        {formatFileSize(
                            serverInfo?.max_file_size ?? 50 * 1024 * 1024,
                        )}{" "}
                        each
                    </p>
                </div>
            )}

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

            <div
                ref={messagesContainerRef}
                className="flex-grow overflow-auto px-3 py-3"
            >
                {messages.length === 0 ? (
                    <div className="text-muted-foreground py-36 text-center">
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
                                    isEditing={editingMessageId === message.id}
                                    editingText={editingText}
                                    onEditingTextChange={setEditingText}
                                    onEditSave={handleEditSave}
                                    onEditCancel={handleEditCancel}
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
                                    onMessageEdit={handleMessageEdit}
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

            <div className={"min-h-16 content-center border-t px-3 py-2"}>
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

                    <div className="relative flex-grow">
                        {/* Rich text display overlay - always visible when there's text */}
                        {messageText && (
                            <div
                                className={cn(
                                    "pointer-events-none absolute inset-0 z-10 max-h-96 min-h-[40px] overflow-y-auto text-base md:text-sm",
                                    "px-[0.8rem] py-[0.55rem]",
                                )}
                            >
                                <ProcessedMessageContent
                                    parts={displayParts}
                                    currentUserId={currentUserId}
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
                            onChange={(e) => handleTextChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleTextareaBlur}
                            className={cn(
                                "max-h-96 min-h-[40px] flex-grow resize-none overflow-y-auto",
                                messageText &&
                                    "text-transparent caret-black dark:caret-white",
                            )}
                            rows={1}
                            disabled={sending || !canWrite}
                            data-scrollbar-custom
                        />
                    </div>

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

function AttachmentItem({
    attachment,
    onImageClick,
}: {
    attachment: Attachment;
    onImageClick?: (attachment: Attachment) => void;
}) {
    const isImage = attachment.type === "image";
    const isVideo = attachment.type === "video";
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
