import React from "react";
import { cn } from "@/utils/tailwind";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, Users, Pin, Settings, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    useServerInfo,
    useMembers,
    useChannels,
} from "@/contexts/server-context";
import { useNavigate } from "@tanstack/react-router";
import { PinnedPopup } from "./pinned-popup";
import { useSetting } from "@/utils/settings";

export interface ServerHeaderProps {
    userId: string | undefined;
    serverUrl: string;
    className?: string;
    showBackButton?: boolean;
    onBackClick?: () => void;
    isOnSettingsPage?: boolean;
}

export default function ServerHeader({
    userId,
    serverUrl,
    className,
    showBackButton = false,
    onBackClick,
    isOnSettingsPage = false,
}: ServerHeaderProps) {
    const { serverInfo, loading } = useServerInfo();
    const { showMembers, toggleMemberList } = useMembers();
    const { selectedChannelId } = useChannels();
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [isPinnedOpen, setIsPinnedOpen] = React.useState(false);
    const customNavigation = useSetting("windowIconsStyle") === "custom";
    const navigate = useNavigate();

    if (loading || !serverInfo) {
        return <ServerHeaderSkeleton />;
    }

    return (
        <header
            className={cn(
                "bg-background flex h-12 items-center justify-between border-b px-3",
                className,
            )}
        >
            <div className="flex items-center gap-3">
                {showBackButton && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBackClick}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft size={20} />
                    </Button>
                )}
                <h1 className="font-medium">{serverInfo.name}</h1>
            </div>

            <div
                className={`flex items-center gap-1 ${customNavigation ? "pr-35" : ""}`}
            >
                {isSearchOpen ? (
                    <div className="relative">
                        <Input
                            placeholder="Search..."
                            className="h-8 w-60 pr-8"
                            autoFocus
                            onBlur={() => setIsSearchOpen(false)}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-0 right-0 h-8 w-8"
                            onClick={() => setIsSearchOpen(false)}
                        >
                            <Search size={16} />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setIsSearchOpen(true)}
                    >
                        <Search size={20} />
                    </Button>
                )}

                <Popover open={isPinnedOpen} onOpenChange={setIsPinnedOpen}>
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

                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "text-muted-foreground hover:text-foreground",
                        showMembers && "bg-accent/50 text-accent-foreground",
                    )}
                    onClick={toggleMemberList}
                >
                    <Users size={20} />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "text-muted-foreground hover:text-foreground",
                        isOnSettingsPage &&
                            "bg-accent/50 text-accent-foreground",
                    )}
                    onClick={() => navigate({ to: `/servers/${userId}/edit` })}
                >
                    <Settings size={20} />
                </Button>
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
