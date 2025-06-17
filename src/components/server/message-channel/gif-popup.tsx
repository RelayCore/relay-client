import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Loader2, TrendingUp, Paperclip } from "lucide-react";
import {
    tenorSearch,
    tenorTrending,
    TenorGifResult,
    getAllAttachments,
    AttachmentApiResponse,
} from "@/api/server";
import { useServer } from "@/contexts/server-context";
import { useCurrentUser } from "@/hooks/use-current-user";

interface GifPopupProps {
    onGifSelect: (gifUrl: string) => void;
    children: React.ReactNode;
}

type ViewMode = "trending" | "search" | "attachments";

export const GifPopup = React.memo(function GifPopup({
    onGifSelect,
    children,
}: GifPopupProps) {
    const { serverRecord } = useServer();
    const { userId } = useCurrentUser();
    const [searchQuery, setSearchQuery] = React.useState("");
    const [viewMode, setViewMode] = React.useState<ViewMode>("trending");
    const [open, setOpen] = React.useState(false);
    const [gifs, setGifs] = React.useState<TenorGifResult[]>([]);
    const [attachments, setAttachments] = React.useState<
        AttachmentApiResponse[]
    >([]);
    const [loading, setLoading] = React.useState(true);
    const searchTimeout = React.useRef<NodeJS.Timeout | null>(null);
    const scrollRef = React.useRef<HTMLDivElement | null>(null);

    // Reset view to trending when search query is cleared
    React.useEffect(() => {
        if (!searchQuery.trim() && viewMode === "search") {
            setViewMode("trending");
        }
    }, [searchQuery, viewMode]);

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

    // Load attachments when viewMode changes to attachments
    React.useEffect(() => {
        const loadAttachments = async () => {
            if (!serverRecord?.server_url || !userId) return;

            setLoading(true);
            setAttachments([]);
            try {
                const response = await getAllAttachments(
                    serverRecord.server_url,
                    userId,
                    {
                        limit: 100,
                        type: "image", // Only get image attachments for now
                    },
                );
                setAttachments(response.attachments);
            } catch (error) {
                console.error("Failed to load attachments:", error);
            } finally {
                setLoading(false);
            }
        };

        if (open && viewMode === "attachments") {
            loadAttachments();
        }
    }, [serverRecord?.server_url, userId, open, viewMode]);

    // Handle search
    React.useEffect(() => {
        const performSearch = async () => {
            if (!serverRecord?.server_url || !userId || !searchQuery.trim()) {
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

    const handleGifClick = (gif: TenorGifResult) => {
        const gifUrl =
            gif.media_formats?.gif?.url ||
            gif.media_formats?.tinygif?.url ||
            gif.url;

        onGifSelect(gifUrl);
        setOpen(false);
    };

    const handleAttachmentClick = (attachment: AttachmentApiResponse) => {
        if (!serverRecord?.server_url) return;

        onGifSelect(attachment.file_path);
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
                                className="h-10 pl-10 text-base"
                            />
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex-shrink-0 border-b p-2">
                        <div className="flex space-x-2">
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
                                }}
                                title="Trending"
                            >
                                <TrendingUp size={16} className="mr-1.5" />
                                Trending
                            </Button>
                            <Button
                                variant={
                                    viewMode === "attachments"
                                        ? "secondary"
                                        : "outline"
                                }
                                size="sm"
                                className="h-8"
                                onClick={() => {
                                    setViewMode("attachments");
                                    setSearchQuery("");
                                }}
                                title="Server Attachments"
                            >
                                <Paperclip size={16} className="mr-1.5" />
                                Attachments
                            </Button>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="min-h-0 flex-1">
                        <ScrollArea
                            className="h-full"
                            ref={(el) => {
                                scrollRef.current = el as HTMLDivElement;
                            }}
                        >
                            <div className="p-4">
                                {loading ? (
                                    <div className="text-muted-foreground py-20 text-center text-base">
                                        <Loader2
                                            size={40}
                                            className="mx-auto mb-4 animate-spin"
                                        />
                                        <p>
                                            Loading{" "}
                                            {viewMode === "attachments"
                                                ? "attachments"
                                                : "GIFs"}
                                            ...
                                        </p>
                                    </div>
                                ) : viewMode === "attachments" ? (
                                    attachments.length === 0 ? (
                                        <div className="text-muted-foreground py-20 text-center text-base">
                                            <p>No attachments found.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-3">
                                            {attachments.map((attachment) => (
                                                <div
                                                    key={attachment.id}
                                                    className="group relative overflow-hidden rounded-lg"
                                                    onClick={() =>
                                                        handleAttachmentClick(
                                                            attachment,
                                                        )
                                                    }
                                                >
                                                    <div className="bg-muted relative cursor-pointer overflow-hidden rounded-md">
                                                        <img
                                                            src={
                                                                attachment.file_path
                                                            }
                                                            alt={
                                                                attachment.file_name
                                                            }
                                                            className="block h-auto w-full hover:opacity-90"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : gifs.length === 0 ? (
                                    <div className="text-muted-foreground py-20 text-center text-base">
                                        <p>No GIFs found.</p>
                                        {searchQuery &&
                                        viewMode === "search" ? (
                                            <p className="mt-1 text-sm">
                                                Try a different search term.
                                            </p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-3">
                                        {gifs.map((gif) => (
                                            <div
                                                key={`${gif.id}-${viewMode}-${searchQuery}-${Math.random()}`}
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
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
});
