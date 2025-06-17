import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Popover,
    PopoverContent,
    PopoverAnchor,
} from "@/components/ui/popover";
import { cn } from "@/utils/tailwind";
import { User } from "@/api/server";
import { UserAvatar } from "./user-avatar";
import { useMembers } from "@/contexts/server-context";

interface MentionsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onMentionSelect: (user: User) => void;
    searchQuery: string;
    selectedIndex: number;
    anchorRef: React.RefObject<HTMLDivElement | null>;
}

export function MentionsPopup({
    isOpen,
    onClose,
    onMentionSelect,
    searchQuery,
    selectedIndex,
    anchorRef,
}: MentionsPopupProps) {
    const { users } = useMembers();

    // Filter users based on search query
    const filteredUsers = React.useMemo(() => {
        if (!searchQuery) {
            return users.slice(0, 10); // Show first 10 users if no search
        }

        return users
            .filter((user) => {
                const displayName = user.nickname || user.username;
                return (
                    displayName
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    user.username
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                );
            })
            .slice(0, 10); // Limit to 10 results
    }, [users, searchQuery]);

    if (filteredUsers.length === 0) {
        return null;
    }

    return (
        <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <PopoverAnchor ref={anchorRef} />
            <PopoverContent
                className="w-64 p-2"
                align="start"
                side="bottom"
                sideOffset={4}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Mention User
                </div>
                <ScrollArea className="max-h-64">
                    <div className="space-y-1">
                        {filteredUsers.map((user, index) => {
                            const displayName = user.nickname || user.username;
                            const isSelected = index === selectedIndex;

                            // Find highest role with a color
                            const highestColoredRole = [...user.roles]
                                .sort((a, b) => b.rank - a.rank)
                                .find((role) => role.color);

                            return (
                                <button
                                    key={user.id}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
                                        isSelected
                                            ? "bg-accent text-accent-foreground"
                                            : "hover:bg-accent/50",
                                    )}
                                    onClick={() => onMentionSelect(user)}
                                    onMouseEnter={() => {
                                        // Optional: Update selected index on hover
                                        // This would need to be passed as a prop if desired
                                    }}
                                >
                                    <UserAvatar
                                        displayName={displayName}
                                        profilePictureUrl={
                                            user.profile_picture_url
                                        }
                                        className="h-6 w-6 text-xs"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div
                                            className="truncate font-medium"
                                            style={{
                                                color:
                                                    highestColoredRole?.color ||
                                                    undefined,
                                            }}
                                        >
                                            {displayName}
                                        </div>
                                        {user.nickname && (
                                            <div className="text-muted-foreground truncate text-xs">
                                                @{user.username}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div
                                            className={cn(
                                                "h-2 w-2 rounded-full",
                                                user.is_online
                                                    ? "bg-green-500"
                                                    : "bg-gray-400",
                                            )}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
