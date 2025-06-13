import React from "react";
import { User } from "@/api/server";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Circle } from "lucide-react";
import { UserContextMenu } from "./user-context-menu";

interface UserPopupProps {
    user: User;
    currentUserId?: string;
    className?: string;
}

function UserPopup({ user, currentUserId, className }: UserPopupProps) {
    // Sort roles by rank (higher rank = more important)
    const sortedRoles = [...user.roles].sort((a, b) => b.rank - a.rank);
    const highestRole = sortedRoles[0];
    const isCurrentUser = currentUserId === user.id;

    return (
        <div className={cn("max-w-sm p-4", className)}>
            {/* User header */}
            <div className="mb-4 flex items-center gap-3">
                <div className="relative">
                    <Avatar className="h-12 w-12">
                        <AvatarFallback
                            className="text-lg font-semibold"
                            style={{
                                backgroundColor: highestRole?.color
                                    ? `${highestRole.color}20`
                                    : undefined,
                                color: highestRole?.color || undefined,
                            }}
                        >
                            {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate font-semibold">
                        {isCurrentUser ? "You" : user.nickname || user.username}
                    </div>
                    {user.nickname && !isCurrentUser && (
                        <div className="text-muted-foreground truncate text-sm">
                            @{user.username}
                        </div>
                    )}
                    {isCurrentUser && (
                        <div className="text-muted-foreground truncate text-sm">
                            @{user.username}
                        </div>
                    )}
                    <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Circle
                            size={8}
                            className={cn(
                                "fill-current",
                                user.is_online
                                    ? "text-green-500"
                                    : "text-gray-400",
                            )}
                        />
                        {user.is_online ? "Online" : "Offline"}
                    </div>
                </div>
            </div>

            {/* Roles section */}
            {sortedRoles.length > 0 && (
                <>
                    <Separator className="mb-3" />
                    <div className="space-y-2">
                        <div className="text-foreground text-sm font-medium">
                            Roles
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {sortedRoles.map((role) => (
                                <Badge
                                    key={role.id}
                                    variant="secondary"
                                    className="text-xs"
                                    style={{
                                        backgroundColor: role.color
                                            ? `${role.color}20`
                                            : undefined,
                                        color: role.color || undefined,
                                        borderColor: role.color
                                            ? `${role.color}40`
                                            : undefined,
                                    }}
                                >
                                    {role.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Permissions preview (only show if user has notable permissions) */}
            {highestRole && highestRole.permissions.length > 0 && (
                <>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                        <div className="text-foreground text-sm font-medium">
                            Key Permissions
                        </div>
                        <div className="text-muted-foreground space-y-1 text-xs">
                            {highestRole.permissions
                                .slice(0, 3)
                                .map((permission) => (
                                    <div
                                        key={permission}
                                        className="capitalize"
                                    >
                                        {permission.replace(/_/g, " ")}
                                    </div>
                                ))}
                            {highestRole.permissions.length > 3 && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"ghost"}
                                            className="hover:bg-background h-auto p-0 text-xs"
                                        >
                                            +
                                            {highestRole.permissions.length - 3}{" "}
                                            more
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        side="right"
                                        align="start"
                                        className="w-auto p-3 pr-2"
                                    >
                                        <div className="space-y-2">
                                            <div className="text-foreground text-sm font-medium">
                                                All Permissions
                                            </div>
                                            <div className="text-muted-foreground max-h-48 space-y-1 overflow-y-auto pr-1 text-xs">
                                                {highestRole.permissions.map(
                                                    (permission) => (
                                                        <div
                                                            key={permission}
                                                            className="capitalize"
                                                        >
                                                            {permission.replace(
                                                                /_/g,
                                                                " ",
                                                            )}
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

interface UserPopoverProps {
    user: User;
    currentUserId?: string;
    children: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
}

export function UserPopover({
    user,
    currentUserId,
    children,
    side = "right",
    align = "start",
}: UserPopoverProps) {
    const [open, setOpen] = React.useState(false);
    const openedViaContextMenu = React.useRef(false);

    function openProfile() {
        openedViaContextMenu.current = true;
        setOpen(true);
    }

    const handleOpenChange = (newOpen: boolean) => {
        // If we just opened via context menu and someone is trying to close it immediately, ignore
        if (openedViaContextMenu.current && !newOpen) {
            openedViaContextMenu.current = false;
            return;
        }
        setOpen(newOpen);
    };

    return (
        <UserContextMenu user={user} openProfile={openProfile}>
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>{children}</PopoverTrigger>
                <PopoverContent
                    side={side}
                    align={align}
                    className="w-auto min-w-72 p-0"
                >
                    <UserPopup user={user} currentUserId={currentUserId} />
                </PopoverContent>
            </Popover>
        </UserContextMenu>
    );
}

export default UserPopup;
