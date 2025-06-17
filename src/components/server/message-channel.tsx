import React from "react";
import { cn } from "@/utils/tailwind";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Paperclip, Download, ExternalLink, X } from "lucide-react";
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
import { useMembers } from "@/contexts/server-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServer } from "@/contexts/server-context";
import { MentionsPopup } from "./mention-popup";
import { toast } from "sonner";
import { cacheManager } from "@/utils/cache-manager";
import { downloadFile } from "@/utils/assets";
import { MessageItem } from "./message-channel/message-item";
// import { ProcessedMessageContent } from "./message-channel/message-content"; // This import is now in MessageInput
import { MessageContentProcessor } from "./message-channel/message-content-processor";
import { motion, AnimatePresence } from "framer-motion";
import { MessageInput } from "./message-channel/message-input";

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
    const [sourceImageRect, setSourceImageRect] =
        React.useState<DOMRect | null>(null);
    const [currentChannel, setCurrentChannel] = React.useState<Channel | null>(
        null,
    );
    const [editingMessageId, setEditingMessageId] = React.useState<
        number | null
    >(null);
    const [editingText, setEditingText] = React.useState("");

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

    const distanceFromBottomRef = React.useRef(0);
    const handleMessagesScroll = React.useCallback(() => {
        const container = messagesContainerRef.current;
        if (container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            distanceFromBottomRef.current =
                scrollHeight - scrollTop - clientHeight;
        }
    }, []);

    React.useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        container.addEventListener("scroll", handleMessagesScroll);

        handleMessagesScroll();
        return () => {
            container.removeEventListener("scroll", handleMessagesScroll);
        };
    }, [handleMessagesScroll]);

    // Only scroll if user is near the bottom (within 100px)
    const scrollToBottom = React.useCallback(() => {
        if (
            messagesContainerRef.current &&
            distanceFromBottomRef.current < 100
        ) {
            requestAnimationFrame(() => {
                if (
                    messagesContainerRef.current &&
                    distanceFromBottomRef.current < 100
                ) {
                    messagesContainerRef.current.scrollTop =
                        messagesContainerRef.current.scrollHeight;
                }
            });
        }
    }, []);

    // Always scroll (for initial load)
    const scrollToBottomForced = React.useCallback(() => {
        if (messagesContainerRef.current) {
            requestAnimationFrame(() => {
                if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop =
                        messagesContainerRef.current.scrollHeight;
                }
            });
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

    // Scroll to bottom when messages change (conditional)
    React.useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Scroll to bottom on initial render (forced)
    React.useEffect(() => {
        scrollToBottomForced();
    }, [scrollToBottomForced]);

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

    const handleGifSelect = React.useCallback(
        async (gifUrl: string) => {
            if (!currentUserId || sending) return;

            // Check write permissions before sending
            if (
                currentChannel &&
                !canWriteToChannel(currentChannel, currentUser)
            ) {
                console.warn(
                    "User does not have permission to write in this channel",
                );
                return;
            }

            setSending(true);

            try {
                await sendMessageWithAttachments(
                    serverUrl,
                    currentUserId,
                    channelId,
                    gifUrl,
                );
            } catch (err) {
                console.error("Failed to send GIF:", err);
            } finally {
                setSending(false);
            }
        },
        [
            currentUserId,
            sending,
            currentChannel,
            currentUser,
            serverUrl,
            channelId,
        ],
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

    const handleImageClick = React.useCallback(
        (attachment: Attachment, sourceElement?: HTMLElement) => {
            if (sourceElement) {
                const rect = sourceElement.getBoundingClientRect();
                setSourceImageRect(rect);
            } else {
                setSourceImageRect(null); // Ensure reset if no source element
            }
            setOpenedImage(attachment);
        },
        [],
    );

    const handleCloseImageModal = React.useCallback(() => {
        // sourceImageRect is kept for the exit animation.
        // It will be cleared on the next open if no sourceElement, or overwritten.
        setOpenedImage(null);
    }, []);

    // Close image modal on Escape key
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && openedImage) {
                handleCloseImageModal();
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
    }, [openedImage, handleCloseImageModal]);

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

            {/* Image Modal with Framer Motion */}
            <AnimatePresence>
                {openedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
                        onClick={handleCloseImageModal}
                    >
                        {/* Controls at the top */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2, delay: 0.1 }}
                            className="flex items-center justify-between p-4 text-white"
                        >
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
                                        downloadFile(
                                            openedImage.file_path,
                                            openedImage.file_name,
                                        );
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
                                    onClick={handleCloseImageModal}
                                >
                                    <X size={16} />
                                </Button>
                            </div>
                        </motion.div>

                        {/* Image container with animation from source */}
                        <div className="flex flex-1 items-center justify-center p-4">
                            <motion.img
                                key={openedImage.id}
                                src={openedImage.file_path}
                                alt={openedImage.file_name}
                                className="max-h-full max-w-full object-contain"
                                onClick={(e) => e.stopPropagation()}
                                initial={
                                    sourceImageRect
                                        ? {
                                              x:
                                                  sourceImageRect.left +
                                                  sourceImageRect.width / 2 -
                                                  window.innerWidth / 2,
                                              y:
                                                  sourceImageRect.top +
                                                  sourceImageRect.height / 2 -
                                                  window.innerHeight / 2,
                                              scale: Math.min(
                                                  sourceImageRect.width / 400,
                                                  sourceImageRect.height / 400,
                                              ),
                                              opacity: 1,
                                          }
                                        : { scale: 0.8, opacity: 0 } // Fallback initial
                                }
                                animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                                exit={
                                    sourceImageRect
                                        ? {
                                              x:
                                                  sourceImageRect.left +
                                                  sourceImageRect.width / 2 -
                                                  window.innerWidth / 2,
                                              y:
                                                  sourceImageRect.top +
                                                  sourceImageRect.height / 2 -
                                                  window.innerHeight / 2,
                                              scale: Math.min(
                                                  sourceImageRect.width / 400,
                                                  sourceImageRect.height / 400,
                                              ),
                                              opacity: 1,
                                          }
                                        : { scale: 0.8, opacity: 0 } // Fallback exit
                                }
                                transition={{
                                    duration: 0.3,
                                    ease: [0.4, 0, 0.2, 1],
                                }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                ref={messagesContainerRef}
                className="min-h-0 flex-grow overflow-auto px-3 py-3"
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
                                    onImageClick={handleImageClick}
                                    isEditing={editingMessageId === message.id}
                                    editingText={editingText}
                                    onEditingTextChange={setEditingText}
                                    onEditSave={handleEditSave}
                                    onEditCancel={handleEditCancel}
                                    onContentLoad={scrollToBottom} // Add scroll callback
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

            <MessageInput
                messageText={messageText}
                onMessageTextChange={handleTextChange}
                onSend={handleSend}
                onKeyDown={handleKeyDown}
                onTextareaBlur={handleTextareaBlur}
                selectedFiles={selectedFiles}
                filePreviewUrls={filePreviewUrls}
                onFileSelect={handleFileSelect}
                onRemoveFile={removeFile}
                onOpenFileDialog={openFileDialog}
                onEmojiSelect={handleEmojiSelect}
                onGifSelect={handleGifSelect}
                sending={sending}
                canWrite={canWrite}
                channelName={channelName}
                displayParts={displayParts}
                currentUserId={currentUserId}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
            />
        </div>
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
