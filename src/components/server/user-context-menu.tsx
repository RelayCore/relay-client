import React, { useState } from "react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    User as UserIcon,
    Shield,
    ShieldX,
    UserMinus,
    UserX,
    Edit3,
    Copy,
    AlertTriangle,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServer } from "@/contexts/server-context";
import {
    updateUserNickname,
    assignRole,
    removeRole,
    User,
    Role,
    hasPermission,
} from "@/api/server";
import { toast } from "sonner";

interface UserContextMenuProps {
    children: React.ReactNode;
    user: User;
    openProfile: () => void;
}

export function UserContextMenu({
    children,
    user,
    openProfile,
}: UserContextMenuProps) {
    const { currentUser, userId } = useCurrentUser();
    const { serverRecord, roles: serverRoles, refreshServerData } = useServer();
    const [isLoading, setIsLoading] = useState(false);
    const [showNicknameEdit, setShowNicknameEdit] = useState(false);

    if (!serverRecord || !userId) {
        return <>{children}</>;
    }

    const isOwnProfile = currentUser?.id === user.id;
    const canManageUsers = hasPermission(currentUser, "manage_users");
    const canAssignRoles = hasPermission(currentUser, "assign_roles");
    const canKickUsers = hasPermission(currentUser, "kick_users");
    const canBanUsers = hasPermission(currentUser, "ban_users");

    const userHighestRank = Math.max(
        ...(currentUser?.roles?.map((r) => r.rank) ?? [0]),
    );
    const memberHighestRank = Math.max(
        ...(user.roles?.map((r: Role) => r.rank) ?? [0]),
    );
    const canModerateUser =
        canManageUsers && userHighestRank > memberHighestRank;

    const availableRoles = serverRoles?.filter(
        (role) =>
            role.assignable &&
            role.rank < userHighestRank &&
            !user.roles.some((userRole: Role) => userRole.id === role.id),
    );

    const removableRoles = user.roles?.filter(
        (role) => role.id !== "admin" && role.rank < userHighestRank,
    );

    const handleEditNickname = () => {
        setShowNicknameEdit(true);
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(user.id);
        toast.success("User ID copied to clipboard");
    };

    const handleCopyUsername = () => {
        navigator.clipboard.writeText(user.username);
        toast.success("Username copied to clipboard");
    };

    const handleAssignRole = async (roleId: string) => {
        if (!userId || !serverRecord) return;

        setIsLoading(true);
        try {
            await assignRole(serverRecord.server_url, userId, user.id, roleId);
            toast.success("Role assigned successfully");
            await refreshServerData(); // Refresh to get updated user data
        } catch (error) {
            toast.error((error as Error).message || "Failed to assign role");
            console.error("Error assigning role:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveRole = async (roleId: string) => {
        if (!userId || !serverRecord) return;

        setIsLoading(true);
        try {
            await removeRole(serverRecord.server_url, userId, user.id, roleId);
            toast.success("Role removed successfully");
            await refreshServerData(); // Refresh to get updated user data
        } catch (error) {
            toast.error((error as Error).message || "Failed to remove role");
            console.error("Error removing role:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger>{children}</ContextMenuTrigger>
                <ContextMenuContent className="w-56">
                    {/* Profile Actions */}
                    <ContextMenuItem onClick={openProfile}>
                        <UserIcon className="mr-2 h-4 w-4" />
                        View Profile
                    </ContextMenuItem>

                    {/* Nickname Management */}
                    {(isOwnProfile || canManageUsers) && (
                        <>
                            <ContextMenuItem onClick={handleEditNickname}>
                                <Edit3 className="mr-2 h-4 w-4" />
                                {isOwnProfile
                                    ? "Edit Nickname"
                                    : "Change Nickname"}
                            </ContextMenuItem>
                        </>
                    )}

                    {/* Role Management */}
                    {canAssignRoles && !isOwnProfile && (
                        <>
                            <ContextMenuSeparator />
                            <ContextMenuSub>
                                <ContextMenuSubTrigger disabled={isLoading}>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Assign Role
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                    {availableRoles &&
                                    availableRoles.length > 0 ? (
                                        availableRoles.map((role) => (
                                            <ContextMenuItem
                                                key={role.id}
                                                onClick={() =>
                                                    handleAssignRole(role.id)
                                                }
                                                disabled={isLoading}
                                            >
                                                <div
                                                    className="mr-2 h-3 w-3 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            role.color,
                                                    }}
                                                />
                                                {role.name}
                                            </ContextMenuItem>
                                        ))
                                    ) : (
                                        <ContextMenuItem disabled>
                                            No roles available
                                        </ContextMenuItem>
                                    )}
                                </ContextMenuSubContent>
                            </ContextMenuSub>

                            <ContextMenuSub>
                                <ContextMenuSubTrigger disabled={isLoading}>
                                    <ShieldX className="mr-2 h-4 w-4" />
                                    Remove Role
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                    {removableRoles &&
                                    removableRoles.length > 0 ? (
                                        removableRoles.map((role) => (
                                            <ContextMenuItem
                                                key={role.id}
                                                onClick={() =>
                                                    handleRemoveRole(role.id)
                                                }
                                                disabled={isLoading}
                                                variant="destructive"
                                            >
                                                <div
                                                    className="mr-2 h-3 w-3 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            role.color,
                                                    }}
                                                />
                                                {role.name}
                                            </ContextMenuItem>
                                        ))
                                    ) : (
                                        <ContextMenuItem disabled>
                                            No roles to remove
                                        </ContextMenuItem>
                                    )}
                                </ContextMenuSubContent>
                            </ContextMenuSub>
                        </>
                    )}

                    {/* Moderation Actions */}
                    {canModerateUser && !isOwnProfile && (
                        <>
                            <ContextMenuSeparator />

                            {canKickUsers && (
                                <ContextMenuItem variant="destructive">
                                    <UserMinus className="mr-2 h-4 w-4" />
                                    Kick User
                                </ContextMenuItem>
                            )}

                            {canBanUsers && (
                                <ContextMenuItem variant="destructive">
                                    <UserX className="mr-2 h-4 w-4" />
                                    Ban User
                                </ContextMenuItem>
                            )}
                        </>
                    )}

                    {/* Admin Actions */}
                    {currentUser?.roles?.some((role) => role.id === "admin") &&
                        !isOwnProfile && (
                            <>
                                <ContextMenuSeparator />
                                <ContextMenuItem variant="destructive">
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Transfer Ownership
                                </ContextMenuItem>
                            </>
                        )}

                    <ContextMenuSeparator />

                    {/* Copy Actions */}
                    <ContextMenuItem onClick={handleCopyUsername}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Username
                    </ContextMenuItem>

                    <ContextMenuItem onClick={handleCopyId}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy User ID
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {/* Simple nickname edit modal */}
            {showNicknameEdit && (
                <EditNicknameModal
                    user={user}
                    open={showNicknameEdit}
                    onClose={() => setShowNicknameEdit(false)}
                />
            )}
        </>
    );
}

interface EditNicknameModalProps {
    user: User;
    open: boolean;
    onClose: () => void;
}

function EditNicknameModal({ user, open, onClose }: EditNicknameModalProps) {
    const { userId } = useCurrentUser();
    const { serverRecord, refreshServerData } = useServer();
    const [nickname, setNickname] = useState(user.nickname);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!nickname.trim() || !userId || !serverRecord) {
            return;
        }

        if (nickname === user.nickname) {
            onClose();
            return;
        }

        setIsLoading(true);
        try {
            await updateUserNickname(
                serverRecord.server_url,
                userId,
                user.id,
                nickname.trim(),
            );
            toast.success("Nickname updated successfully");
            await refreshServerData(); // Refresh to get updated user data
            onClose();
        } catch (error) {
            toast.error(
                (error as Error).message || "Failed to update nickname",
            );
            console.error("Error updating nickname:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        Edit{" "}
                        {user.id === userId ? "Your" : `${user.username}'s`}{" "}
                        Nickname
                    </DialogTitle>
                    <DialogDescription>
                        Change the display name for this user on the server.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="nickname"
                            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Nickname
                        </label>
                        <input
                            id="nickname"
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Enter nickname..."
                            maxLength={32}
                            disabled={isLoading}
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="ring-offset-background focus-visible:ring-ring border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !nickname.trim()}
                            className="ring-offset-background focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                        >
                            {isLoading ? "Saving..." : "Save Changes"}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
