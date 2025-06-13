import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/utils/tailwind";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from "@/api/server";
import { UserPopover } from "./user-popup";
import { useMembers } from "@/contexts/server-context";

export interface MemberGroup {
    id: string;
    name: string;
    color?: string;
    members: User[];
    position?: number;
}

export interface MemberListProps {
    className?: string;
    currentUserId?: string;
    onMemberClick?: (memberId: string) => void;
}

export default function MemberList({
    className,
    currentUserId,
    onMemberClick,
}: MemberListProps) {
    const { users: members, roles } = useMembers();
    const [groups, setGroups] = React.useState<MemberGroup[]>([]);

    React.useEffect(() => {
        if (members.length) {
            const newGroups: MemberGroup[] = [];

            // If we have roles, group members by role
            if (roles.length) {
                // Sort roles by rank (higher rank first)
                const sortedRoles = [...roles].sort((a, b) => b.rank - a.rank);

                // Create a group for users with each role
                sortedRoles.forEach((role) => {
                    const roleMembers = members.filter((member) =>
                        member.roles.some(
                            (memberRole) => memberRole.id === role.id,
                        ),
                    );

                    if (roleMembers.length > 0) {
                        newGroups.push({
                            id: role.id,
                            name: `${role.name} — ${roleMembers.length}`,
                            color: role.color,
                            members: roleMembers,
                            position: role.rank,
                        });
                    }
                });

                // Create a group for online members without special roles
                const onlineMembersWithoutRoles = members.filter((m) => {
                    const hasRole = m.roles.length > 0;
                    return !hasRole && m.is_online;
                });

                if (onlineMembersWithoutRoles.length > 0) {
                    newGroups.push({
                        id: "online",
                        name: `Online — ${onlineMembersWithoutRoles.length}`,
                        members: onlineMembersWithoutRoles,
                    });
                }

                // Add offline members without roles
                const offlineMembersWithoutRoles = members.filter((m) => {
                    const hasRole = m.roles.length > 0;
                    return !hasRole && !m.is_online;
                });

                if (offlineMembersWithoutRoles.length > 0) {
                    newGroups.push({
                        id: "offline",
                        name: `Offline — ${offlineMembersWithoutRoles.length}`,
                        members: offlineMembersWithoutRoles,
                    });
                }
            }
            // If we don't have roles, group by online status
            else {
                const online = members.filter((m) => m.is_online);
                const offline = members.filter((m) => !m.is_online);

                if (online.length) {
                    newGroups.push({
                        id: "online",
                        name: `Online — ${online.length}`,
                        members: online,
                    });
                }

                if (offline.length) {
                    newGroups.push({
                        id: "offline",
                        name: `Offline — ${offline.length}`,
                        members: offline,
                    });
                }
            }

            setGroups(newGroups);
        }
    }, [members, roles]); // This will trigger when members' online status changes

    if (!members.length) {
        return <MemberListSkeleton />;
    }

    return (
        <div className={cn("h-full w-full", className)}>
            <ScrollArea className="h-full">
                {groups.map((group) => (
                    <div key={group.id} className="mb-6">
                        <div
                            className={cn(
                                "text-muted-foreground mt-2 px-3 py-1 text-xs font-semibold",
                                group.color && "text-foreground",
                            )}
                            style={{
                                color: group.color || undefined,
                            }}
                        >
                            {group.name}
                        </div>

                        {group.members.map((member) => (
                            <MemberItem
                                key={member.id}
                                member={member}
                                currentUserId={currentUserId}
                                onClick={() => onMemberClick?.(member.id)}
                            />
                        ))}
                    </div>
                ))}
            </ScrollArea>
        </div>
    );
}

function MemberItem({
    member,
    currentUserId,
    onClick,
}: {
    member: User;
    currentUserId?: string;
    onClick?: () => void;
}) {
    const displayName = member.nickname || member.username;
    const statusColor = member.is_online ? "bg-green-500" : "bg-gray-500";

    // Find highest role with a color
    const highestColoredRole = [...member.roles]
        .sort((a, b) => b.rank - a.rank)
        .find((role) => role.color);

    const roleColor = highestColoredRole?.color;

    return (
        <UserPopover user={member} currentUserId={currentUserId}>
            <button
                className="hover:bg-accent/30 hover:text-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                }}
            >
                <div className="relative">
                    <div className="bg-muted-foreground/20 h-8 w-8 overflow-hidden rounded-full">
                        <div className="flex h-full w-full items-center justify-center text-xs">
                            {displayName.substring(0, 2).toUpperCase()}
                        </div>
                    </div>

                    <div
                        className={cn(
                            "border-background absolute right-0 bottom-0 h-3 w-3 rounded-full border-2",
                            statusColor,
                        )}
                    />
                </div>

                <div className="flex flex-col items-start truncate">
                    <span className="truncate" style={{ color: roleColor }}>
                        {displayName}
                    </span>
                    {member.nickname && (
                        <span className="text-muted-foreground truncate text-xs">
                            {member.username}
                        </span>
                    )}
                </div>
            </button>
        </UserPopover>
    );
}

function MemberListSkeleton() {
    return (
        <div className="px-2">
            {/* Group title skeleton */}
            <div className="mb-2">
                <Skeleton className="mb-3 h-3 w-24" />
            </div>

            {/* Member skeletons */}
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="mb-3 flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                </div>
            ))}

            {/* Another group */}
            <div className="mt-6 mb-2">
                <Skeleton className="mb-3 h-3 w-20" />
            </div>

            {/* More member skeletons */}
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="mb-3 flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                </div>
            ))}
        </div>
    );
}
