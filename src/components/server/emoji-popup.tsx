import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Smile, Loader2 } from "lucide-react";

interface EmojiData {
    emoji: string;
    name: string;
    codepoints: string;
    group: string;
    subgroup: string;
    skinTones?: EmojiData[]; // Array of skin tone variants
    isBaseSkinTone?: boolean; // True if this is the base emoji with skin tone variants
}

interface EmojiCategories {
    [key: string]: EmojiData[];
}

// Skin tone codepoints for detection
const SKIN_TONE_CODEPOINTS = ["1F3FB", "1F3FC", "1F3FD", "1F3FE", "1F3FF"];

// Parse emoji-test.txt content
function parseEmojiTestFile(content: string): EmojiCategories {
    const lines = content.split("\n");
    const categories: EmojiCategories = {};
    let currentGroup = "";
    let currentSubgroup = "";
    const emojiMap = new Map<string, EmojiData>(); // Map base codepoints to emoji data

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments that aren't group/subgroup
        if (
            !trimmed ||
            (trimmed.startsWith("#") &&
                !trimmed.includes("group:") &&
                !trimmed.includes("subgroup:"))
        ) {
            continue;
        }

        // Parse group
        if (trimmed.startsWith("# group:")) {
            currentGroup = trimmed.replace("# group:", "").trim();
            if (currentGroup === "Component") continue; // Skip "Component" group
            if (!categories[currentGroup]) {
                categories[currentGroup] = [];
            }
            continue;
        }

        // Parse subgroup
        if (trimmed.startsWith("# subgroup:")) {
            currentSubgroup = trimmed.replace("# subgroup:", "").trim();
            continue;
        }

        // Parse emoji line
        if (trimmed.includes(";") && trimmed.includes("fully-qualified")) {
            const parts = trimmed.split(";");
            if (parts.length >= 2) {
                const codepoints = parts[0].trim();
                const statusAndName = parts[1].trim();

                // Extract emoji name from comment
                const hashIndex = statusAndName.indexOf("#");
                if (hashIndex !== -1) {
                    const commentPart = statusAndName
                        .substring(hashIndex + 1)
                        .trim();
                    const emojiMatch = commentPart.match(
                        /^(\S+)\s+E\d+\.\d+\s+(.+)$/,
                    );

                    if (emojiMatch) {
                        const emoji = emojiMatch[1];
                        const name = emojiMatch[2];

                        const emojiData: EmojiData = {
                            emoji,
                            name,
                            codepoints,
                            group: currentGroup,
                            subgroup: currentSubgroup,
                        };

                        // Check if this is a skin tone variant
                        const codepointParts = codepoints.split(" ");
                        const hasSkinTone = codepointParts.some((part) =>
                            SKIN_TONE_CODEPOINTS.includes(part),
                        );

                        if (hasSkinTone && codepointParts.length > 1) {
                            // This is a skin tone variant
                            const baseCodepoints = codepointParts
                                .filter(
                                    (part) =>
                                        !SKIN_TONE_CODEPOINTS.includes(part),
                                )
                                .join(" ");

                            const baseEmoji = emojiMap.get(baseCodepoints);
                            if (baseEmoji) {
                                // Add to existing base emoji's skin tones
                                if (!baseEmoji.skinTones) {
                                    baseEmoji.skinTones = [];
                                    baseEmoji.isBaseSkinTone = true;
                                }
                                baseEmoji.skinTones.push(emojiData);
                            }
                        } else {
                            // This is a base emoji (or emoji without skin tone variants)
                            emojiMap.set(codepoints, emojiData);

                            if (currentGroup && categories[currentGroup]) {
                                categories[currentGroup].push(emojiData);
                            }
                        }
                    }
                }
            }
        }
    }

    return categories;
}

// Load emoji data from public folder
async function loadEmojiData(): Promise<EmojiCategories> {
    try {
        const response = await fetch("/emoji-test.txt");
        if (!response.ok) {
            throw new Error("Failed to load emoji data");
        }
        const content = await response.text();
        return parseEmojiTestFile(content);
    } catch (error) {
        console.error("Error loading emoji data:", error);
        return {};
    }
}

interface EmojiPopupProps {
    onEmojiSelect: (emoji: string) => void;
    children: React.ReactNode;
}

interface SkinToneContextMenuProps {
    baseEmoji: EmojiData;
    onEmojiSelect: (emoji: string) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

function SkinToneContextMenu({
    baseEmoji,
    onEmojiSelect,
    isOpen,
    onOpenChange,
    children,
}: SkinToneContextMenuProps) {
    if (!baseEmoji.skinTones || baseEmoji.skinTones.length === 0) {
        return <>{children}</>;
    }

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                side="top"
                align="center"
                className="w-auto p-2"
                sideOffset={5}
            >
                <div className="flex gap-1">
                    {/* Base emoji first */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-accent h-8 w-8 p-0 text-base"
                        onClick={() => {
                            onEmojiSelect(baseEmoji.emoji);
                            onOpenChange(false);
                        }}
                        title={baseEmoji.name}
                    >
                        {baseEmoji.emoji}
                    </Button>
                    {/* Skin tone variants */}
                    {baseEmoji.skinTones.map((skinTone, index) => (
                        <Button
                            key={`${skinTone.codepoints}-${index}`}
                            variant="ghost"
                            size="sm"
                            className="hover:bg-accent h-8 w-8 p-0 text-base"
                            onClick={() => {
                                onEmojiSelect(skinTone.emoji);
                                onOpenChange(false);
                            }}
                            title={skinTone.name}
                        >
                            {skinTone.emoji}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function EmojiPopup({ onEmojiSelect, children }: EmojiPopupProps) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedCategory, setSelectedCategory] = React.useState<string>("");
    const [open, setOpen] = React.useState(false);
    const [emojiCategories, setEmojiCategories] =
        React.useState<EmojiCategories>({});
    const [loading, setLoading] = React.useState(true);
    const [allEmojis, setAllEmojis] = React.useState<EmojiData[]>([]);
    const [contextMenuEmoji, setContextMenuEmoji] = React.useState<
        string | null
    >(null);

    // Load emoji data when component mounts
    React.useEffect(() => {
        const loadEmojis = async () => {
            setLoading(true);
            try {
                const categories = await loadEmojiData();
                setEmojiCategories(categories);

                // Set first category as default
                const firstCategory = Object.keys(categories)[0];
                if (firstCategory) {
                    setSelectedCategory(firstCategory);
                }

                // Create flat array for search
                const flat = Object.values(categories).flat();
                setAllEmojis(flat);
            } catch (error) {
                console.error("Failed to load emojis:", error);
            } finally {
                setLoading(false);
            }
        };

        loadEmojis();
    }, []);

    const filteredEmojis = React.useMemo(() => {
        if (!searchQuery) {
            return emojiCategories[selectedCategory] || [];
        }

        // Search through all emojis by name
        const query = searchQuery.toLowerCase();
        return allEmojis.filter((emojiData) =>
            emojiData.name.toLowerCase().includes(query),
        );
    }, [searchQuery, selectedCategory, emojiCategories, allEmojis]);

    const handleEmojiClick = (emoji: string) => {
        onEmojiSelect(emoji);
        setOpen(false);
    };

    const handleEmojiRightClick = (
        e: React.MouseEvent,
        emojiData: EmojiData,
    ) => {
        e.preventDefault();
        if (emojiData.isBaseSkinTone) {
            setContextMenuEmoji(emojiData.codepoints);
        }
    };

    const handleContextMenuOpenChange = (open: boolean) => {
        if (!open) {
            setContextMenuEmoji(null);
        }
    };

    const handleCategoryClick = (category: string) => {
        setSelectedCategory(category);
        setSearchQuery(""); // Clear search when switching categories
    };

    const categoryKeys = Object.keys(emojiCategories);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                side="top"
                align="end"
                className="h-[400px] w-[480px] p-0"
                sideOffset={8}
            >
                <div className="flex h-full flex-col">
                    {/* Search */}
                    <div className="flex-shrink-0 border-b p-3">
                        <div className="relative">
                            <Search
                                size={16}
                                className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 transform"
                            />
                            <Input
                                placeholder="Search emojis..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-9 pl-9"
                            />
                        </div>
                    </div>

                    {/* Main content area */}
                    <div className="flex min-h-0 flex-1">
                        {/* Categories sidebar */}
                        {!searchQuery && (
                            <div className="bg-muted/30 w-12 flex-shrink-0 border-r">
                                <ScrollArea className="h-full">
                                    <div className="flex flex-col p-1">
                                        {categoryKeys.map((category) => {
                                            const firstEmoji =
                                                emojiCategories[category]?.[0]
                                                    ?.emoji || "📁";
                                            return (
                                                <Button
                                                    key={category}
                                                    variant={
                                                        selectedCategory ===
                                                        category
                                                            ? "secondary"
                                                            : "ghost"
                                                    }
                                                    size="sm"
                                                    className="mb-1 h-10 w-10 p-0 text-lg"
                                                    onClick={() =>
                                                        handleCategoryClick(
                                                            category,
                                                        )
                                                    }
                                                    title={category}
                                                >
                                                    {firstEmoji}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        {/* Emoji Grid */}
                        <div className="min-w-0 flex-1">
                            <ScrollArea className="h-full">
                                <div className="p-3">
                                    {loading ? (
                                        <div className="text-muted-foreground py-12 text-center text-sm">
                                            <Loader2
                                                size={32}
                                                className="mx-auto mb-3 animate-spin"
                                            />
                                            <p>Loading emojis...</p>
                                        </div>
                                    ) : filteredEmojis.length === 0 ? (
                                        <div className="text-muted-foreground py-12 text-center text-sm">
                                            <Smile
                                                size={32}
                                                className="mx-auto mb-3 opacity-50"
                                            />
                                            <p>No emojis found</p>
                                            {searchQuery && (
                                                <p className="mt-1 text-xs">
                                                    Try a different search term
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-10 gap-1">
                                            {filteredEmojis.map(
                                                (emojiData, index) => (
                                                    <SkinToneContextMenu
                                                        key={`${emojiData.codepoints}-${index}`}
                                                        baseEmoji={emojiData}
                                                        onEmojiSelect={
                                                            handleEmojiClick
                                                        }
                                                        isOpen={
                                                            contextMenuEmoji ===
                                                            emojiData.codepoints
                                                        }
                                                        onOpenChange={
                                                            handleContextMenuOpenChange
                                                        }
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="hover:bg-accent h-8 w-8 rounded-md p-0 text-base transition-colors"
                                                            onClick={() =>
                                                                handleEmojiClick(
                                                                    emojiData.emoji,
                                                                )
                                                            }
                                                            onContextMenu={(
                                                                e,
                                                            ) =>
                                                                handleEmojiRightClick(
                                                                    e,
                                                                    emojiData,
                                                                )
                                                            }
                                                            title={
                                                                emojiData.name
                                                            }
                                                        >
                                                            {emojiData.emoji}
                                                        </Button>
                                                    </SkinToneContextMenu>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
