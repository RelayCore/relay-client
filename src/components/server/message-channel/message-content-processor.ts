import { User } from "@/api/server";

export type MentionData = { user?: User };
export type LinkData = {
    url: string;
    isImageLink?: boolean;
    isYouTubeLink?: boolean;
    youTubeId?: string;
};
export type MarkdownData = {
    markdownType:
        | "bold"
        | "italic"
        | "strikethrough"
        | "underline"
        | "header"
        | "list-item";
    headerLevel?: number;
    listType?: "ordered" | "unordered";
    listIndex?: number;
    listLevel?: number;
};
export type CodeData = { language: string };

export type MessageContentPart =
    | { type: "text"; content: string }
    | { type: "mention"; content: string; data: MentionData }
    | { type: "link"; content: string; data: LinkData }
    | {
          type: "code";
          content: string;
          prefix?: string;
          suffix?: string;
          data: CodeData;
      }
    | {
          type: "markdown";
          content: string;
          prefix?: string;
          suffix?: string;
          data: MarkdownData;
      };

export class MessageContentProcessor {
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
        parts = this.processCodeBlocks(parts);
        parts = this.processMarkdown(parts);
        parts = this.processLinks(parts);
        parts = this.processMentions(parts);

        return parts;
    }

    /**
     * Process code blocks in the content
     */
    private processCodeBlocks(
        parts: MessageContentPart[],
    ): MessageContentPart[] {
        const newParts: MessageContentPart[] = [];

        for (const part of parts) {
            if (part.type !== "text") {
                newParts.push(part);
                continue;
            }

            const codeParts = this.extractCodeBlocks(part.content);
            newParts.push(...codeParts);
        }

        return newParts;
    }

    /**
     * Extract code blocks from a text string
     */
    private extractCodeBlocks(text: string): MessageContentPart[] {
        const parts: MessageContentPart[] = [];
        let lastIndex = 0;

        const codeBlockRegex = /(```(\w+)?\n)([\s\S]*?)(\n```)/g;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            const [fullMatch, opening, language, codeContent, closing] = match;
            const startIndex = match.index;

            if (startIndex > lastIndex) {
                parts.push({
                    type: "text",
                    content: text.slice(lastIndex, startIndex),
                });
            }

            parts.push({
                type: "code",
                content: codeContent,
                data: { language: language || "plaintext" },
                prefix: opening,
                suffix: closing,
            });

            lastIndex = startIndex + fullMatch.length;
        }

        if (lastIndex < text.length) {
            parts.push({
                type: "text",
                content: text.slice(lastIndex),
            });
        }

        return parts.length > 0 ? parts : [{ type: "text", content: text }];
    }

    /**
     * Process markdown formatting in the content
     */
    private processMarkdown(parts: MessageContentPart[]): MessageContentPart[] {
        const newParts: MessageContentPart[] = [];

        for (const part of parts) {
            if (part.type !== "text") {
                newParts.push(part);
                continue;
            }

            const markdownParts = this.extractMarkdown(part.content);
            newParts.push(...markdownParts);
        }

        return newParts;
    }

    /**
     * Extract markdown formatting from a text string
     */
    private extractMarkdown(text: string): MessageContentPart[] {
        const parts: MessageContentPart[] = [];
        const lines = text.split("\n");

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            line = line.replace(/\r$/, "");

            if (line.trim() === "") {
                parts.push({ type: "text", content: "\n" });
                continue;
            }

            // Check for headers (# ## ###)
            const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                const [, hashes, content] = headerMatch;
                parts.push({
                    type: "markdown",
                    content: content,
                    prefix: hashes + " ",
                    data: {
                        markdownType: "header",
                        headerLevel: hashes.length,
                    },
                });
                continue;
            }

            // Check for ordered lists (1. 2. etc)
            const orderedListMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
            if (orderedListMatch) {
                const [, indent, number, content] = orderedListMatch;
                const listLevel = Math.floor((indent || "").length / 2);
                parts.push({
                    type: "markdown",
                    content: content,
                    prefix: `${indent}${number}. `,
                    data: {
                        markdownType: "list-item",
                        listType: "ordered",
                        listIndex: parseInt(number),
                        listLevel,
                    },
                });
                continue;
            }

            // Check for unordered lists (- or *)
            const unorderedListMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
            if (unorderedListMatch) {
                const [, indent, marker, content] = unorderedListMatch;
                const listLevel = Math.floor((indent || "").length / 2);
                parts.push({
                    type: "markdown",
                    content: content,
                    prefix: `${indent}${marker} `,
                    data: {
                        markdownType: "list-item",
                        listType: "unordered",
                        listLevel,
                    },
                });
                continue;
            }

            // Process inline markdown for regular lines
            const inlineParts = this.processInlineMarkdown(line);
            parts.push(...inlineParts);

            if (i < lines.length - 1) {
                parts.push({ type: "text", content: "\n" });
            }
        }

        return parts.length > 0 ? parts : [{ type: "text", content: text }];
    }

    /**
     * Process inline markdown formatting (bold, italic, strikethrough, underline)
     */
    private processInlineMarkdown(text: string): MessageContentPart[] {
        const parts: MessageContentPart[] = [];
        let lastIndex = 0;

        // Combined regex for all inline formatting
        // Order matters: longer patterns first to avoid conflicts
        const inlineRegex =
            /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|__(.+?)__|_(.+?)_)/g;
        let match;

        while ((match = inlineRegex.exec(text)) !== null) {
            const [fullMatch] = match;
            const startIndex = match.index;

            // Add text before formatting
            if (startIndex > lastIndex) {
                parts.push({
                    type: "text",
                    content: text.slice(lastIndex, startIndex),
                });
            }

            // Determine the type of formatting and prefix/suffix
            let markdownType:
                | "bold"
                | "italic"
                | "strikethrough"
                | "underline"
                | undefined;
            let content: string | undefined;
            let prefix: string | undefined;
            let suffix: string | undefined;

            if (match[2]) {
                // ***bold italic***
                content = match[2];
                markdownType = "bold";
                prefix = "***";
                suffix = "***";
            } else if (match[3]) {
                // **bold**
                content = match[3];
                markdownType = "bold";
                prefix = "**";
                suffix = "**";
            } else if (match[4]) {
                // *italic*
                content = match[4];
                markdownType = "italic";
                prefix = "*";
                suffix = "*";
            } else if (match[5]) {
                // ~~strikethrough~~
                content = match[5];
                markdownType = "strikethrough";
                prefix = "~~";
                suffix = "~~";
            } else if (match[6]) {
                // __underline__
                content = match[6];
                markdownType = "underline";
                prefix = "__";
                suffix = "__";
            } else if (match[7]) {
                // _italic_
                content = match[7];
                markdownType = "italic";
                prefix = "_";
                suffix = "_";
            } else {
                // Fallback
                parts.push({ type: "text", content: fullMatch });
                lastIndex = startIndex + fullMatch.length;
                continue;
            }

            if (content !== undefined && markdownType !== undefined) {
                parts.push({
                    type: "markdown",
                    content,
                    prefix,
                    suffix,
                    data: { markdownType },
                });
            }

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
     * Method for processing links
     */
    private processLinks(parts: MessageContentPart[]): MessageContentPart[] {
        const newParts: MessageContentPart[] = [];

        for (const part of parts) {
            if (part.type !== "text" || !part.content) {
                newParts.push(part);
                continue;
            }

            const linkParts = this.extractLinks(part.content);
            newParts.push(...linkParts);
        }

        return newParts;
    }

    /**
     * Extract links from a text string
     */
    private extractLinks(text: string): MessageContentPart[] {
        const parts: MessageContentPart[] = [];
        let lastIndex = 0;

        // Regex to find URLs (http, https, or www at the start of a word)
        const urlRegex =
            /(\bhttps?:\/\/[^\s/$.?#].[^\s]*|\bwww\.[^\s/$.?#].[^\s]*)/gi;
        let match;

        while ((match = urlRegex.exec(text)) !== null) {
            const [fullMatch] = match;
            const startIndex = match.index;

            // Add text before link
            if (startIndex > lastIndex) {
                parts.push({
                    type: "text",
                    content: text.slice(lastIndex, startIndex),
                });
            }

            // Add link part
            let url = fullMatch;
            if (url.toLowerCase().startsWith("www.")) {
                url = "http://" + url;
            }

            // Check if the URL is an image link (case-insensitive, before query parameters)
            const isImage = /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(
                url.split("?")[0],
            ); // Check if the URL is a YouTube link and extract the video ID if so
            const youTubeRegex =
                /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            const youTubeMatch = url.match(youTubeRegex);
            const isYouTubeLink = youTubeMatch !== null;
            const youTubeId = isYouTubeLink ? youTubeMatch[1] : undefined;

            parts.push({
                type: "link",
                content: fullMatch, // Display the original matched string
                data: {
                    url: url,
                    isImageLink: isImage, // Set isImageLink
                    isYouTubeLink: isYouTubeLink, // Set isYouTubeLink
                    youTubeId: youTubeId, // Set youTubeId
                },
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
}
