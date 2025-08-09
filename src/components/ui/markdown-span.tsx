import React, { JSX } from "react";
import { cn } from "@/utils/tailwind";

export function MarkdownSpan({
    content,
    markdownType,
    headerLevel,
    listType,
    listIndex,
}: {
    content: string;
    markdownType?:
        | "bold"
        | "italic"
        | "strikethrough"
        | "underline"
        | "header"
        | "list-item";
    headerLevel?: number;
    listType?: "ordered" | "unordered";
    listIndex?: number;
}) {
    switch (markdownType) {
        case "header": {
            const HeaderTag =
                `h${Math.min(headerLevel || 1, 6)}` as keyof JSX.IntrinsicElements;
            const headerClasses = {
                1: "text-2xl font-bold mb-2",
                2: "text-xl font-bold mb-2",
                3: "text-lg font-semibold mb-1",
                4: "text-base font-semibold mb-1",
                5: "text-sm font-semibold mb-1",
                6: "text-xs font-semibold mb-1",
            };

            return (
                <HeaderTag
                    className={cn(
                        "block",
                        headerClasses[
                            headerLevel as keyof typeof headerClasses
                        ] || headerClasses[1],
                    )}
                >
                    {content}
                </HeaderTag>
            );
        }

        case "list-item":
            return (
                <div className="my-0.5 flex items-start gap-2">
                    <span className="text-muted-foreground font-mono text-sm">
                        {listType === "ordered" ? `${listIndex}.` : "•"}
                    </span>
                    <span>{content}</span>
                </div>
            );

        case "bold":
            return <strong className="font-semibold">{content}</strong>;

        case "italic":
            return <em className="italic">{content}</em>;

        case "strikethrough":
            return <span className="line-through">{content}</span>;

        case "underline":
            return <span className="underline">{content}</span>;

        default:
            return <span>{content}</span>;
    }
}
