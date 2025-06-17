import { User } from "@/api/server";

export type MessageContentPart = {
    type: "text" | "mention" | "tag" | "link" | "emoji";
    content: string;
    data?: {
        user?: User;
        url?: string;
        tagName?: string;
        emojiCode?: string;
        isImageLink?: boolean; // Added for image link detection
    };
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
        parts = this.processMentions(parts);
        parts = this.processLinks(parts);

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
            );

            parts.push({
                type: "link",
                content: fullMatch, // Display the original matched string
                data: { url: url, isImageLink: isImage }, // Set isImageLink
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
