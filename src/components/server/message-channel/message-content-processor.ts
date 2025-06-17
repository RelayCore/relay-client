import { User } from "@/api/server";

export type MessageContentPart = {
    type: "text" | "mention" | "tag" | "link" | "emoji";
    content: string;
    data?: {
        user?: User;
        url?: string;
        tagName?: string;
        emojiCode?: string;
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
