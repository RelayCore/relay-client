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
    User as UserIcon,
    Shield,
    UserMinus,
    UserX,
    Edit3,
    Copy,
    Volume2,
    VolumeX,
    Volume1,
    Headphones,
    MicOff,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServer } from "@/contexts/server-context";
import {
    assignRole,
    User,
    hasPermission,
    VoiceParticipant,
} from "@/api/server";
import { webSocketManager } from "@/websocket/websocket-manager";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { EditNicknameModal } from "./user-context-menu";

interface VoiceUserContextMenuProps {
    children: React.ReactNode;
    participant: VoiceParticipant;
    openProfile: () => void;
}

export function VoiceUserContextMenu({
    children,
    participant,
    openProfile,
}: VoiceUserContextMenuProps) {
    const { userId } = useParams({ strict: false });
    const { currentUser } = useCurrentUser();
    const { serverRecord, roles: serverRoles, refreshServerData } = useServer();
    const [isLoading, setIsLoading] = useState(false);
    const [showNicknameEdit, setShowNicknameEdit] = useState(false);

    if (!serverRecord || !userId || !currentUser) {
        return <>{children}</>;
    }

    // Convert VoiceParticipant to User-like object for compatibility
    const user: User = {
        id: participant.user_id,
        username: participant.username,
        nickname: participant.nickname,
        profile_picture_url: participant.profile_picture_url,
        roles: [],
        is_online: true,
    };

    const isOwnProfile = currentUser.id === participant.user_id;
    const canManageUsers = hasPermission(currentUser, "manage_users");
    const canAssignRoles = hasPermission(currentUser, "assign_roles");
    const canKickUsers = hasPermission(currentUser, "kick_users");
    const canBanUsers = hasPermission(currentUser, "ban_users");

    const userHighestRank = Math.max(
        ...(currentUser?.roles?.map((r) => r.rank) ?? [0]),
    );
    const canModerateUser = canManageUsers && !isOwnProfile;

    const availableRoles = serverRoles?.filter(
        (role) => role.assignable && role.rank < userHighestRank,
    );

    const handleEditNickname = () => {
        setShowNicknameEdit(true);
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(participant.user_id);
        toast.success("User ID copied to clipboard");
    };

    const handleCopyUsername = () => {
        navigator.clipboard.writeText(participant.username);
        toast.success("Username copied to clipboard");
    };

    const handleAssignRole = async (roleId: string) => {
        if (!userId || !serverRecord) return;

        setIsLoading(true);
        try {
            await assignRole(
                serverRecord.server_url,
                userId,
                participant.user_id,
                roleId,
            );
            toast.success("Role assigned successfully");
            await refreshServerData();
        } catch (error) {
            toast.error((error as Error).message || "Failed to assign role");
            console.error("Error assigning role:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMuteUser = async () => {
        // This would require server-side implementation to force mute a user
        toast.info("Force mute functionality not yet implemented");
    };

    const handleDeafenUser = async () => {
        // This would require server-side implementation to force deafen a user
        toast.info("Force deafen functionality not yet implemented");
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

                    {/* Voice Controls */}
                    <>
                        <ContextMenuSeparator />
                        <ContextMenuItem>
                            <Volume2 className="mr-2 h-4 w-4" />
                            Adjust Volume
                        </ContextMenuItem>
                        <div className="px-2 pb-2">
                            <InlineVolumeSlider participant={participant} />
                        </div>
                    </>

                    {/* Nickname Management */}
                    {(isOwnProfile || canManageUsers) && (
                        <>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={handleEditNickname}>
                                <Edit3 className="mr-2 h-4 w-4" />
                                {isOwnProfile
                                    ? "Edit Nickname"
                                    : "Change Nickname"}
                            </ContextMenuItem>
                        </>
                    )}

                    {/* Role Management */}
                    {canAssignRoles && (
                        <>
                            <ContextMenuSeparator />
                            <ContextMenuSub>
                                <ContextMenuSubTrigger disabled={isLoading}>
                                    <Shield className="mr-4 h-4 w-4" />
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
                        </>
                    )}

                    {/* Voice Moderation Actions */}
                    {canModerateUser && !isOwnProfile && (
                        <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                                onClick={handleMuteUser}
                                variant="destructive"
                            >
                                <MicOff className="mr-2 h-4 w-4" />
                                Force Mute
                            </ContextMenuItem>
                            <ContextMenuItem
                                onClick={handleDeafenUser}
                                variant="destructive"
                            >
                                <Headphones className="mr-2 h-4 w-4" />
                                Force Deafen
                            </ContextMenuItem>
                        </>
                    )}

                    {/* Regular Moderation Actions */}
                    {canModerateUser && !isOwnProfile && (
                        <>
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

            {/* Nickname Edit Modal */}
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

function InlineVolumeSlider({
    participant,
}: {
    participant: VoiceParticipant;
}) {
    const { userId } = useParams({ strict: false });
    const [volume, setVolume] = useState(() => {
        if (!userId) return 100;
        const voiceClient = webSocketManager.getVoiceClient(userId);
        return Math.round(
            (voiceClient?.audioManager?.getUserVolume(participant.user_id) ??
                1.0) * 100,
        );
    });
    const [lastVolume, setLastVolume] = useState(volume);

    const handleVolumeChange = (values: number[]) => {
        const newVolume = values[0];
        setVolume(newVolume);
        if (userId) {
            const voiceClient = webSocketManager.getVoiceClient(userId);
            voiceClient?.audioManager?.setUserVolume(
                participant.user_id,
                newVolume / 100,
            );
        }
    };

    const handleMute = () => {
        if (volume === 0) {
            setVolume(lastVolume);
            return;
        }

        setLastVolume(volume);
        setVolume(0);
    };

    const getVolumeIcon = () => {
        if (volume === 0) return <VolumeX className="h-4 w-4" />;
        if (volume < 50) return <Volume1 className="h-4 w-4" />;
        return <Volume2 className="h-4 w-4" />;
    };

    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium">Volume</label>
                <div className="flex items-center">
                    <button
                        onClick={handleMute}
                        className="hover:bg-muted rounded p-1"
                    >
                        {getVolumeIcon()}
                    </button>
                    <span className="w-8 text-right font-mono text-xs">
                        {volume}%
                    </span>
                </div>
            </div>
            <Slider
                min={0}
                max={200}
                step={1}
                value={[volume]}
                onValueChange={handleVolumeChange}
                className="w-full"
            />
        </div>
    );
}
