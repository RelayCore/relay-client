import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Loader2, TrendingUp } from "lucide-react";
import {
    tenorCategories,
    tenorSearch,
    tenorTrending,
    TenorGifResult,
} from "@/api/server";
import { useServer } from "@/contexts/server-context";
import { useCurrentUser } from "@/hooks/use-current-user";

interface GifPopupProps {
    onGifSelect: (gifUrl: string) => void;
    children: React.ReactNode;
}

type ViewMode = "trending" | "search" | "category";

export const GifPopup = React.memo(function GifPopup({
    onGifSelect,
    children,
}: GifPopupProps) {
    const { serverRecord } = useServer();
    const { userId } = useCurrentUser();
    const [searchQuery, setSearchQuery] = React.useState("");
    const [viewMode, setViewMode] = React.useState<ViewMode>("trending");
    const [selectedCategory, setSelectedCategory] = React.useState<string>("");
    const [open, setOpen] = React.useState(false);
    const [categories, setCategories] = React.useState<string[]>([]);
    const [gifs, setGifs] = React.useState<TenorGifResult[]>([]);
    const [loading, setLoading] = React.useState(true);
    const searchTimeout = React.useRef<NodeJS.Timeout | null>(null);
    const scrollRef = React.useRef<HTMLDivElement | null>(null);

    // Reset view to trending when search query is cleared
    React.useEffect(() => {
        if (!searchQuery.trim() && viewMode === "search") {
            setViewMode("trending");
            // Optionally, clear gifs or re-fetch trending gifs here if desired
            // For now, it will rely on the viewMode change to trigger trending load
        }
    }, [searchQuery, viewMode]);

    // Load categories when component mounts
    React.useEffect(() => {
        const loadCategories = async () => {
            if (!serverRecord?.server_url || !userId) return;

            try {
                const response = await tenorCategories(
                    serverRecord.server_url,
                    userId,
                );
                setCategories(response.categories);
            } catch (error) {
                console.error("Failed to load GIF categories:", error);
            }
        };

        if (open) {
            loadCategories();
        }
    }, [serverRecord?.server_url, userId, open]);

    // Load trending GIFs when component opens or viewMode changes to trending
    React.useEffect(() => {
        const loadTrendingGifs = async () => {
            if (!serverRecord?.server_url || !userId) return;

            setLoading(true);
            setGifs([]);
            try {
                const response = await tenorTrending(
                    serverRecord.server_url,
                    userId,
                    {
                        limit: 50,
                    },
                );
                setGifs(response.results);
            } catch (error) {
                console.error("Failed to load trending GIFs:", error);
            } finally {
                setLoading(false);
            }
        };

        if (open && viewMode === "trending") {
            loadTrendingGifs();
        }
    }, [serverRecord?.server_url, userId, open, viewMode]);

    // Handle search
    React.useEffect(() => {
        const performSearch = async () => {
            if (!serverRecord?.server_url || !userId || !searchQuery.trim()) {
                // If search query is cleared, and we were in search mode, revert to trending
                if (viewMode === "search" && !searchQuery.trim()) {
                    setViewMode("trending");
                }
                return;
            }

            setLoading(true);
            setGifs([]);
            try {
                const response = await tenorSearch(
                    serverRecord.server_url,
                    userId,
                    searchQuery,
                    {
                        limit: 50,
                    },
                );
                setGifs(response.results);
                setViewMode("search");
            } catch (error) {
                console.error("Failed to search GIFs:", error);
            } finally {
                setLoading(false);
            }
        };

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        if (searchQuery.trim()) {
            searchTimeout.current = setTimeout(performSearch, 500);
        } else {
            // If search query is cleared, reset to trending view
            // This ensures that clearing search input goes back to trending
            if (viewMode === "search") {
                setViewMode("trending");
            }
        }

        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, [searchQuery, serverRecord?.server_url, userId, viewMode]);

    // Handle category selection
    const handleCategoryClick = async (categorySearchTerm: string) => {
        if (!serverRecord?.server_url || !userId) return;

        setSelectedCategory(categorySearchTerm);
        setViewMode("category");
        setLoading(true);
        setGifs([]);
        setSearchQuery("");

        try {
            const response = await tenorSearch(
                serverRecord.server_url,
                userId,
                categorySearchTerm,
                {
                    limit: 50,
                },
            );
            setGifs(response.results);
        } catch (error) {
            console.error(
                `Failed to load GIFs for category ${categorySearchTerm}:`,
                error,
            );
        } finally {
            setLoading(false);
        }
    };

    const handleGifClick = (gif: TenorGifResult) => {
        // Prefer .gif from media_formats, then .tinygif, then the main .url
        const gifUrl =
            gif.media_formats?.gif?.url ||
            gif.media_formats?.tinygif?.url ||
            gif.url;

        onGifSelect(gifUrl);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                side="top"
                align="end"
                className="h-[550px] w-[700px] p-0"
                sideOffset={8}
            >
                <div className="flex h-full flex-col">
                    {/* Search */}
                    <div className="flex-shrink-0 border-b p-3">
                        <div className="relative">
                            <Search
                                size={20}
                                className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 transform"
                            />
                            <Input
                                placeholder="Search GIFs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-10 pl-10 text-base" // Increased text size
                            />
                        </div>
                    </div>

                    {/* Horizontal Categories */}
                    <div className="flex-shrink-0 border-b p-2">
                        <ScrollArea className="w-full whitespace-nowrap">
                            <div className="flex space-x-2 pb-2">
                                <Button
                                    variant={
                                        viewMode === "trending"
                                            ? "secondary"
                                            : "outline"
                                    }
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        setViewMode("trending");
                                        setSearchQuery("");
                                        setSelectedCategory("");
                                    }}
                                    title="Trending"
                                >
                                    <TrendingUp size={16} className="mr-1.5" />
                                    Trending
                                </Button>
                                {categories.map((categoryName) => (
                                    <Button
                                        key={categoryName}
                                        variant={
                                            viewMode === "category" &&
                                            selectedCategory === categoryName
                                                ? "secondary"
                                                : "outline"
                                        }
                                        size="sm"
                                        className="h-8"
                                        onClick={() =>
                                            handleCategoryClick(categoryName)
                                        }
                                        title={
                                            categoryName.startsWith("#")
                                                ? categoryName.substring(1)
                                                : categoryName
                                        }
                                    >
                                        {categoryName.startsWith("#")
                                            ? categoryName.substring(1)
                                            : categoryName}
                                    </Button>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </div>

                    {/* GIF Grid */}
                    <div className="min-h-0 flex-1">
                        <ScrollArea
                            className="h-full"
                            ref={(el) => {
                                scrollRef.current = el as HTMLDivElement;
                            }}
                        >
                            <div className="p-4">
                                {gifs.length === 0 && loading ? (
                                    <div className="text-muted-foreground py-20 text-center text-base">
                                        <Loader2
                                            size={40}
                                            className="mx-auto mb-4 animate-spin"
                                        />
                                        <p>Loading GIFs...</p>
                                    </div>
                                ) : gifs.length === 0 ? (
                                    <div className="text-muted-foreground py-20 text-center text-base">
                                        <p>No GIFs found.</p>
                                        {searchQuery &&
                                        viewMode === "search" ? (
                                            <p className="mt-1 text-sm">
                                                Try a different search term.
                                            </p>
                                        ) : viewMode === "category" ? (
                                            <p className="mt-1 text-sm">
                                                Try a different category or
                                                search.
                                            </p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-3">
                                        {gifs.map((gif) => (
                                            <div
                                                key={`${gif.id}-${viewMode}-${searchQuery}-${selectedCategory}-${Math.random()}`}
                                                className="group relative overflow-hidden rounded-lg"
                                                onClick={() =>
                                                    handleGifClick(gif)
                                                }
                                            >
                                                <div className="bg-muted relative cursor-pointer overflow-hidden rounded-md">
                                                    {(gif.media_formats?.gif
                                                        ?.url ||
                                                        gif.media_formats
                                                            ?.tinygif?.url ||
                                                        gif.url) && (
                                                        <img
                                                            src={
                                                                gif
                                                                    .media_formats
                                                                    ?.gif
                                                                    ?.url ||
                                                                gif
                                                                    .media_formats
                                                                    ?.tinygif
                                                                    ?.url ||
                                                                gif.url
                                                            }
                                                            alt={
                                                                gif.content_description ||
                                                                "GIF"
                                                            }
                                                            className="block h-auto w-full hover:opacity-90"
                                                            loading="lazy"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {loading && gifs.length > 0 && (
                                    <div className="py-4 text-center">
                                        <Loader2
                                            size={24}
                                            className="mx-auto animate-spin opacity-70"
                                        />
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
});
