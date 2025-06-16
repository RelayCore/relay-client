import React from "react";
import { cn } from "@/utils/tailwind";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, Users, Pin, Settings, ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import {
    useServerInfo,
    useMembers,
    useChannels,
} from "@/contexts/server-context";
import { useNavigate } from "@tanstack/react-router";
import { PinnedPopup } from "./pinned-popup";
import { useSetting } from "@/utils/settings";
import {
    searchMessages,
    MessageSearchResponse,
    hasPermission,
} from "@/api/server";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";

export interface ServerHeaderProps {
    userId: string | undefined;
    serverUrl: string;
    className?: string;
    showBackButton?: boolean;
    onBackClick?: () => void;
    isOnSettingsPage?: boolean;
    channelName?: string;
}

export default function ServerHeader({
    userId,
    serverUrl,
    className,
    showBackButton = false,
    onBackClick,
    isOnSettingsPage = false,
    channelName,
}: ServerHeaderProps) {
    const { serverInfo, loading } = useServerInfo();
    const { showMembers, toggleMemberList } = useMembers();
    const { selectedChannelId } = useChannels();
    const { currentUser } = useCurrentUser();
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [isPinnedOpen, setIsPinnedOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [searchResults, setSearchResults] = React.useState<
        MessageSearchResponse[]
    >([]);
    const [isSearching, setIsSearching] = React.useState(false);
    const [searchTimeout, setSearchTimeout] =
        React.useState<NodeJS.Timeout | null>(null);
    const customNavigation = useSetting("windowIconsStyle") === "custom";
    const navigate = useNavigate();

    const canEditServer = React.useMemo(() => {
        return hasPermission(currentUser, "manage_server");
    }, [currentUser]);

    // Debounced search function
    const performSearch = React.useCallback(
        async (query: string) => {
            if (!query.trim() || !userId) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const response = await searchMessages(serverUrl, userId, {
                    query: query.trim(),
                    limit: 20,
                });
                setSearchResults(response.messages);
            } catch (error) {
                console.error("Search failed:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        },
        [serverUrl, userId],
    );

    // Handle search input changes with debouncing
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);

        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        const timeout = setTimeout(() => {
            performSearch(value);
        }, 300);

        setSearchTimeout(timeout);
    };

    if (loading || !serverInfo) {
        return <ServerHeaderSkeleton />;
    }

    return (
        <header
            className={cn(
                `bg-background relative flex h-12 items-center justify-between border-b pr-3 ${isOnSettingsPage ? "pl-[0.3rem]" : "pl-3"}`,
                className,
            )}
        >
            <div className="flex items-center gap-3">
                {showBackButton && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onBackClick}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft size={20} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Go back</p>
                        </TooltipContent>
                    </Tooltip>
                )}
                <h1 className="font-medium">{serverInfo.name}</h1>
                {channelName && (
                    <>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">
                            {channelName}
                        </span>
                    </>
                )}
            </div>

            <div
                className={`flex items-center gap-1 ${customNavigation ? "pr-35" : ""}`}
            >
                <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "text-muted-foreground hover:text-foreground",
                                        isSearchOpen &&
                                            "bg-accent/50 text-accent-foreground",
                                    )}
                                >
                                    <Search size={20} />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Search messages</p>
                        </TooltipContent>
                    </Tooltip>
                    <PopoverContent
                        side="bottom"
                        align="end"
                        className="w-auto p-0"
                    >
                        <SearchPopup
                            searchQuery={searchQuery}
                            onSearchChange={handleSearchChange}
                            searchResults={searchResults}
                            isSearching={isSearching}
                        />
                    </PopoverContent>
                </Popover>

                <Popover open={isPinnedOpen} onOpenChange={setIsPinnedOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "text-muted-foreground hover:text-foreground",
                                        isPinnedOpen &&
                                            "bg-accent/50 text-accent-foreground",
                                    )}
                                >
                                    <Pin size={20} />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Pinned messages</p>
                        </TooltipContent>
                    </Tooltip>
                    <PopoverContent
                        side="bottom"
                        align="end"
                        className="w-auto p-0"
                    >
                        {selectedChannelId && userId && serverUrl && (
                            <PinnedPopup
                                serverUrl={serverUrl}
                                userId={userId}
                                channelId={selectedChannelId}
                            />
                        )}
                    </PopoverContent>
                </Popover>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "text-muted-foreground hover:text-foreground",
                                showMembers &&
                                    "bg-accent/50 text-accent-foreground",
                            )}
                            onClick={toggleMemberList}
                        >
                            <Users size={20} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{showMembers ? "Hide" : "Show"} member list</p>
                    </TooltipContent>
                </Tooltip>

                {canEditServer && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "text-muted-foreground hover:text-foreground",
                                    isOnSettingsPage &&
                                        "bg-accent/50 text-accent-foreground",
                                )}
                                onClick={() =>
                                    navigate({ to: `/servers/${userId}/edit` })
                                }
                            >
                                <Settings size={20} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Server settings</p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </header>
    );
}

function ServerHeaderSkeleton() {
    return (
        <header className="bg-background flex h-12 items-center justify-between border-b px-3">
            <div className="flex items-center space-x-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-5 w-40" />
            </div>

            <div className="flex items-center space-x-1">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8 rounded-md" />
                ))}
            </div>
        </header>
    );
}

function SearchPopup({
    searchQuery,
    onSearchChange,
    searchResults,
    isSearching,
}: {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    searchResults: MessageSearchResponse[];
    isSearching: boolean;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Auto-focus the input when the popover opens
    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    return (
        <div className="w-96 p-4">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Search Messages</h3>
                <div className="flex items-center gap-1">
                    <Search size={16} className="text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">
                        {searchResults.length}
                    </span>
                </div>
            </div>

            <div className="mb-4">
                <div className="relative">
                    <Input
                        ref={inputRef}
                        placeholder="Search messages..."
                        className="h-8 pr-8"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    <div className="absolute top-1 right-1 flex items-center">
                        {isSearching && (
                            <Loader2
                                size={16}
                                className="text-muted-foreground animate-spin"
                            />
                        )}
                    </div>
                </div>
            </div>

            <ScrollArea className="max-h-80">
                {searchResults.length > 0 ? (
                    <div className="space-y-4">
                        {searchResults.map((message) => (
                            <SearchMessageItem
                                key={message.id}
                                message={message}
                            />
                        ))}
                    </div>
                ) : searchQuery && !isSearching ? (
                    <div className="text-muted-foreground py-8 text-center">
                        <Search size={48} className="mx-auto mb-2 opacity-50" />
                        <p>No messages found</p>
                        <p className="text-sm">
                            Try searching with different keywords
                        </p>
                    </div>
                ) : !searchQuery ? (
                    <div className="text-muted-foreground py-8 text-center">
                        <Search size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Start typing to search messages</p>
                        <p className="text-sm">
                            Search through all messages in this server
                        </p>
                    </div>
                ) : null}
            </ScrollArea>
        </div>
    );
}

function SearchMessageItem({ message }: { message: MessageSearchResponse }) {
    const { getUserById } = useMembers();

    const userId = message.author_id || "";

    // Use getUserById to get user information
    const user = getUserById(userId) || {
        id: userId,
        username: message.username || "Unknown",
        nickname: message.nickname || "",
        roles: [],
        is_online: false,
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

    function formatMessagePreview(
        content: string,
        maxLength: number = 60,
    ): React.ReactNode {
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + "...";
    }

    return (
        <div className="group hover:bg-accent/50 relative rounded-md border p-3">
            <div className="flex items-start justify-between">
                <div className="mb-2 flex items-center space-x-2">
                    <div className="h-6 w-6 cursor-pointer">
                        {user.profile_picture_url ? (
                            <img
                                src={user.profile_picture_url}
                                alt={displayName}
                                className="h-full w-full rounded-full object-cover"
                            />
                        ) : (
                            <div
                                className="flex h-full w-full items-center justify-center rounded-full text-xs"
                                style={{
                                    backgroundColor: highestColoredRole?.color
                                        ? `${highestColoredRole.color}20`
                                        : undefined,
                                    color:
                                        highestColoredRole?.color || undefined,
                                }}
                            >
                                {avatarText}
                            </div>
                        )}
                    </div>
                    <span
                        className="text-sm font-medium"
                        style={{ color: roleColor }}
                    >
                        {displayName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                        in #{message.channel_name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                        })}
                    </span>
                </div>
            </div>

            <div className="text-foreground text-sm break-words whitespace-pre-wrap">
                {formatMessagePreview(message.content)}
            </div>

            {(message.attachments?.length ?? 0) > 0 && (
                <div className="text-muted-foreground mt-1 text-xs">
                    {message.attachments?.length ?? 0} attachment
                    {(message.attachments?.length ?? 0) !== 1 ? "s" : ""}
                </div>
            )}
        </div>
    );
}
