import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ColorPicker } from "@/components/ui/color-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
    Settings,
    Save,
    UserPlus,
    Copy,
    Trash2,
    Plus,
    Crown,
    Edit2,
    Check,
    X,
} from "lucide-react";
import {
    ServerInfo,
    updateServerConfig,
    UpdateServerConfigRequest,
    getInvites,
    createServerInvite,
    deleteServerInvite,
    Invite,
    Role,
    Permission,
    createServerRole,
    updateServerRole,
    deleteServerRole,
    CreateRoleRequest,
    UpdateRoleRequest,
} from "@/api/server";
import { useServer, useServerRecord } from "@/contexts/server-context";
import { useNavigate } from "@tanstack/react-router";
import ServerHeader from "@/components/server/server-header";
import { useConfirm } from "@/contexts/confirm-context";
import { ServerIconCropper } from "@/components/server-edit/server-icon";
import { logError } from "@/utils/logger";

// Available permissions grouped by category
const PERMISSION_GROUPS: {
    category: string;
    permissions: {
        value: Permission;
        label: string;
        description: string;
    }[];
}[] = [
    {
        category: "Messages",
        permissions: [
            {
                value: "send_messages",
                label: "Send Messages",
                description: "Allow sending messages in channels",
            },
            {
                value: "read_messages",
                label: "Read Messages",
                description: "Allow reading messages in channels",
            },
        ],
    },
    {
        category: "Invites",
        permissions: [
            {
                value: "create_invites",
                label: "Create Invites",
                description: "Allow creating server invites",
            },
            {
                value: "manage_invites",
                label: "Manage Invites",
                description: "Allow managing server invites",
            },
        ],
    },
    {
        category: "Channels",
        permissions: [
            {
                value: "create_channels",
                label: "Create Channels",
                description: "Allow creating new channels",
            },
            {
                value: "delete_channels",
                label: "Delete Channels",
                description: "Allow deleting channels",
            },
            {
                value: "manage_channels",
                label: "Manage Channels",
                description: "Allow editing channel settings",
            },
        ],
    },
    {
        category: "Voice",
        permissions: [
            {
                value: "join_voice",
                label: "Join Voice",
                description: "Allow joining voice channels",
            },
            {
                value: "speak_in_voice",
                label: "Speak in Voice",
                description: "Allow speaking in voice channels",
            },
            {
                value: "manage_voice",
                label: "Manage Voice",
                description: "Allow managing voice channels",
            },
        ],
    },
    {
        category: "Moderation",
        permissions: [
            {
                value: "kick_users",
                label: "Kick Users",
                description: "Allow kicking users from server",
            },
            {
                value: "ban_users",
                label: "Ban Users",
                description: "Allow banning users from server",
            },
            {
                value: "manage_users",
                label: "Manage Users",
                description: "Allow managing user settings",
            },
        ],
    },
    {
        category: "Administration",
        permissions: [
            {
                value: "assign_roles",
                label: "Assign Roles",
                description: "Allow assigning roles to users",
            },
            {
                value: "manage_server",
                label: "Manage Server",
                description: "Allow managing server settings",
            },
            {
                value: "manage_roles",
                label: "Manage Roles",
                description: "Allow managing server roles",
            },
            {
                value: "view_audit_log",
                label: "View Audit Log",
                description: "Allow viewing server audit logs",
            },
        ],
    },
];

// Permission presets for quick role creation
const PERMISSION_PRESETS = {
    admin: {
        name: "Administrator",
        permissions: [
            "send_messages",
            "read_messages",
            "create_invites",
            "manage_invites",
            "create_channels",
            "delete_channels",
            "manage_channels",
            "join_voice",
            "speak_in_voice",
            "manage_voice",
            "kick_users",
            "ban_users",
            "manage_users",
            "assign_roles",
            "manage_server",
            "manage_roles",
            "view_audit_log",
        ] as Permission[],
    },
    moderator: {
        name: "Moderator",
        permissions: [
            "send_messages",
            "read_messages",
            "create_invites",
            "manage_channels",
            "join_voice",
            "speak_in_voice",
            "manage_voice",
            "kick_users",
            "manage_users",
            "view_audit_log",
        ] as Permission[],
    },
    member: {
        name: "Member",
        permissions: [
            "send_messages",
            "read_messages",
            "join_voice",
            "speak_in_voice",
        ] as Permission[],
    },
    guest: {
        name: "Guest",
        permissions: ["read_messages", "join_voice"] as Permission[],
    },
};

export default function ServerEditPage() {
    const {
        serverInfo,
        roles: contextRoles,
        refreshServerData,
        clearServerStatusCache,
        loading: contextLoading,
    } = useServer();
    const serverRecord = useServerRecord();
    const navigate = useNavigate();
    const { confirm } = useConfirm();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<ServerInfo>>({});

    // Local roles state to prevent re-renders
    const [roles, setRoles] = useState<Role[]>([]);

    // Invite management state
    const [invites, setInvites] = useState<Invite[]>([]);
    const [loadingInvites, setLoadingInvites] = useState(false);
    const [creatingInvite, setCreatingInvite] = useState(false);
    const [newInvite, setNewInvite] = useState({
        expires_in: 24,
        max_uses: 0,
    });

    // Role management state
    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [creatingRole, setCreatingRole] = useState(false);
    const [newRole, setNewRole] = useState({
        name: "",
        color: "#5865F2",
        rank: 100,
        permissions: PERMISSION_PRESETS.member.permissions as Permission[],
        display_role_members: true,
    });
    const [editRole, setEditRole] = useState<{
        id: string;
        name: string;
        color: string;
        rank: number;
        permissions: Permission[];
        display_role_members: boolean;
    } | null>(null);

    useEffect(() => {
        if (serverInfo) {
            setFormData({
                ...serverInfo,
                max_file_size: Math.round(
                    serverInfo.max_file_size / (1024 * 1024),
                ),
            });
            setLoading(false);
        }
    }, [serverInfo]);

    // Sync roles from context to local state
    useEffect(() => {
        if (contextRoles) {
            setRoles(contextRoles);
        }
    }, [contextRoles]);

    // Load invites when invites tab is accessed
    const loadInvites = async () => {
        if (!serverRecord || loadingInvites) return;

        try {
            setLoadingInvites(true);
            const response = await getInvites(
                serverRecord.server_url,
                serverRecord.user_id,
            );
            setInvites(response.invites || []);
        } catch (error) {
            logError("Failed to load invites", "api", String(error));
            toast.error("Failed to load invites");
        } finally {
            setLoadingInvites(false);
        }
    };

    const handleCreateInvite = async () => {
        if (!serverRecord || creatingInvite) return;

        try {
            setCreatingInvite(true);

            const inviteResponse = await createServerInvite(
                serverRecord.server_url,
                serverRecord.user_id,
                {
                    created_by: serverRecord.user_id,
                    expires_in: newInvite.expires_in,
                    max_uses: newInvite.max_uses,
                },
            );

            // Create the new invite object with proper structure
            const newInviteItem: Invite = {
                code: inviteResponse.invite_code,
                created_by: serverRecord.user_id,
                created_at: new Date().toISOString(),
                expires_at: inviteResponse.expires_at,
                max_uses: inviteResponse.max_uses,
                uses: 0,
            };

            // Optimistically update the UI
            setInvites((prev) => [newInviteItem, ...prev]);

            toast.success("Invite created successfully");

            // Reset form
            setNewInvite({ expires_in: 24, max_uses: 0 });
        } catch (error) {
            logError("Failed to create invite", "api", String(error));
            toast.error("Failed to create invite");
        } finally {
            setCreatingInvite(false);
        }
    };

    const handleDeleteInvite = async (code: string) => {
        if (!serverRecord) return;

        try {
            // Optimistically remove from UI
            setInvites((prev) => prev.filter((invite) => invite.code !== code));

            await deleteServerInvite(
                serverRecord.server_url,
                serverRecord.user_id,
                code,
            );

            toast.success("Invite deleted successfully");
        } catch (error) {
            logError("Failed to delete invite", "api", String(error));
            toast.error("Failed to delete invite");
            // Reload invites on error to restore state
            loadInvites();
        }
    };

    const copyInviteCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success("Invite code copied to clipboard");
    };

    const saveServerConfig = async () => {
        if (!serverRecord) return;

        try {
            setSaving(true);
            const configUpdate: UpdateServerConfigRequest = {
                name: formData.name,
                description: formData.description,
                allow_invite: formData.allow_invite,
                max_users: formData.max_users,
                max_file_size: (formData.max_file_size ?? 50) * 1024 * 1024,
                max_attachments: formData.max_attachments,
            };

            await updateServerConfig(
                serverRecord.server_url,
                serverRecord.user_id,
                configUpdate,
            );

            toast.success("Server configuration updated successfully");
            clearServerStatusCache();
        } catch {
            toast.error("Failed to update server configuration");
        } finally {
            setSaving(false);
        }
    };

    const handleBackClick = () => {
        navigate({
            to: `/servers/${serverRecord?.user_id}`,
        });
    };

    // Add preset selection function
    const applyPermissionPreset = (
        presetKey: keyof typeof PERMISSION_PRESETS,
        isNewRole = true,
    ) => {
        const preset = PERMISSION_PRESETS[presetKey];
        if (isNewRole) {
            setNewRole((prev) => ({
                ...prev,
                permissions: [...preset.permissions],
            }));
        } else if (editRole) {
            setEditRole((prev) =>
                prev
                    ? {
                          ...prev,
                          permissions: [...preset.permissions],
                      }
                    : null,
            );
        }
    };

    // Helper function to check if current permissions match a preset
    const getActivePreset = (
        permissions: Permission[],
    ): keyof typeof PERMISSION_PRESETS | null => {
        for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
            if (
                permissions.length === preset.permissions.length &&
                permissions.every((p) => preset.permissions.includes(p))
            ) {
                return key as keyof typeof PERMISSION_PRESETS;
            }
        }
        return null;
    };

    // Role management functions
    const handleCreateRole = async () => {
        if (!newRole.name.trim() || !serverRecord || creatingRole) return;

        try {
            setCreatingRole(true);

            const roleRequest: CreateRoleRequest = {
                id: newRole.name.toLowerCase().replace(/\s+/g, "-"),
                name: newRole.name,
                color: newRole.color,
                permissions: newRole.permissions,
                rank: newRole.rank,
                assignable: true,
                display_role_members: newRole.display_role_members,
            };

            await createServerRole(
                serverRecord.server_url,
                serverRecord.user_id,
                roleRequest,
            );

            // Optimistically update local roles state
            const newRoleObject: Role = {
                ...roleRequest,
            };
            setRoles((prev) => [...prev, newRoleObject]);

            toast.success("Role created successfully");
            setNewRole({
                name: "",
                color: "#5865F2",
                rank: 100,
                permissions: [],
                display_role_members: true,
            });
            clearServerStatusCache();
        } catch (error) {
            logError("Failed to create role", "api", String(error));
            toast.error("Failed to create role");
            // Only refresh on error to sync with server
            refreshServerData();
        } finally {
            setCreatingRole(false);
        }
    };

    const handleEditRole = (role: Role) => {
        setEditRole({
            id: role.id,
            name: role.name,
            color: role.color,
            rank: role.rank,
            permissions: [...role.permissions],
            display_role_members: role.display_role_members,
        });
        setEditingRole(role.id);
    };

    const handleSaveRole = async () => {
        if (!editRole || !serverRecord) return;

        try {
            const updateRequest: UpdateRoleRequest = {
                id: editRole.id,
                name: editRole.name,
                color: editRole.color,
                rank: editRole.rank,
                permissions: editRole.permissions,
                display_role_members: editRole.display_role_members,
            };

            await updateServerRole(
                serverRecord.server_url,
                serverRecord.user_id,
                updateRequest,
            );

            // Optimistically update local roles state
            setRoles((prev) =>
                prev.map((role) =>
                    role.id === editRole.id
                        ? { ...role, ...updateRequest }
                        : role,
                ),
            );

            toast.success("Role updated successfully");
            setEditingRole(null);
            setEditRole(null);
            clearServerStatusCache();
        } catch (error) {
            logError("Failed to update role", "api", String(error));
            toast.error("Failed to update role");
            // Only refresh on error to sync with server
            refreshServerData();
        }
    };

    const handleCancelEdit = () => {
        setEditingRole(null);
        setEditRole(null);
    };

    const togglePermission = (permission: Permission, isNewRole = false) => {
        if (isNewRole) {
            setNewRole((prev) => ({
                ...prev,
                permissions: prev.permissions.includes(permission)
                    ? prev.permissions.filter((p) => p !== permission)
                    : [...prev.permissions, permission],
            }));
        } else if (editRole) {
            setEditRole((prev) =>
                prev
                    ? {
                          ...prev,
                          permissions: prev.permissions.includes(permission)
                              ? prev.permissions.filter((p) => p !== permission)
                              : [...prev.permissions, permission],
                      }
                    : null,
            );
        }
    };

    const handleDeleteRole = async (role: Role) => {
        if (!serverRecord) return;

        const confirmed = await confirm({
            title: "Delete Role",
            description: `Are you sure you want to delete the role "${role.name}"? This action cannot be undone and will remove this role from all users who have it.`,
            confirmText: "Delete Role",
            cancelText: "Cancel",
            variant: "destructive",
        });

        if (!confirmed) return;

        try {
            await deleteServerRole(
                serverRecord.server_url,
                serverRecord.user_id,
                role.id,
            );

            // Optimistically update local roles state
            setRoles((prev) => prev.filter((r) => r.id !== role.id));

            toast.success("Role deleted successfully");
            clearServerStatusCache();
        } catch (error) {
            logError("Failed to delete role", "api", String(error));
            toast.error("Failed to delete role");
            // Only refresh on error to sync with server
            refreshServerData();
        }
    };

    if (loading || contextLoading) {
        return <ServerEditSkeleton />;
    }

    return (
        <div className="flex h-full flex-col">
            <ServerHeader
                userId={serverRecord?.user_id}
                serverUrl={serverRecord?.server_url || ""}
                showBackButton={true}
                onBackClick={handleBackClick}
                isOnSettingsPage={true}
            />

            <div className="flex-1 overflow-auto">
                <div className="container mx-auto max-w-4xl p-6">
                    <div className="mb-6">
                        <h1 className="flex items-center gap-2 text-3xl font-bold">
                            <Settings className="h-8 w-8" />
                            Server Settings
                        </h1>
                        <p className="text-muted-foreground">
                            Manage your server configuration and settings
                        </p>
                    </div>

                    <Tabs defaultValue="general" className="space-y-6">
                        <div className="flex items-center justify-between">
                            <TabsList className="grid w-fit grid-cols-3">
                                <TabsTrigger value="general">
                                    General
                                </TabsTrigger>
                                <TabsTrigger value="roles">Roles</TabsTrigger>
                                <TabsTrigger
                                    value="invites"
                                    onClick={() => {
                                        if (invites.length === 0) {
                                            loadInvites();
                                        }
                                    }}
                                >
                                    Invites
                                </TabsTrigger>
                            </TabsList>

                            <Button
                                onClick={saveServerConfig}
                                disabled={saving}
                                className="flex items-center gap-2"
                            >
                                <Save className="h-4 w-4" />
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>

                        <TabsContent value="general">
                            <div className="space-y-6">
                                {/* Server Icon Card */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Server Icon</CardTitle>
                                        <CardDescription>
                                            Upload and crop your server&apos;s
                                            icon
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ServerIconCropper
                                            currentIcon={serverInfo?.icon}
                                            onIconUpdated={() => {
                                                // Optionally refresh server data after icon update
                                                refreshServerData();
                                            }}
                                        />
                                    </CardContent>
                                </Card>

                                {/* Server Configuration Card */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Server Configuration
                                        </CardTitle>
                                        <CardDescription>
                                            Configure your server&apos;s basic
                                            information and settings
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {/* Server Name and Max Users */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="name">
                                                    Server Name
                                                </Label>
                                                <Input
                                                    id="name"
                                                    value={formData.name || ""}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            name: e.target
                                                                .value,
                                                        })
                                                    }
                                                    placeholder="Enter server name"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="max-users">
                                                    Max Users
                                                </Label>
                                                <Input
                                                    id="max-users"
                                                    type="number"
                                                    min="1"
                                                    value={
                                                        formData.max_users || ""
                                                    }
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            max_users: parseInt(
                                                                e.target.value,
                                                            ),
                                                        })
                                                    }
                                                    placeholder="Maximum number of users"
                                                />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div className="space-y-2">
                                            <Label htmlFor="description">
                                                Description
                                            </Label>
                                            <Textarea
                                                id="description"
                                                value={
                                                    formData.description || ""
                                                }
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        description:
                                                            e.target.value,
                                                    })
                                                }
                                                placeholder="Describe your server"
                                                rows={3}
                                            />
                                        </div>

                                        {/* File Settings */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="max-file-size">
                                                    Max File Size (MB)
                                                </Label>
                                                <Input
                                                    id="max-file-size"
                                                    type="number"
                                                    min="1"
                                                    value={
                                                        formData.max_file_size ||
                                                        ""
                                                    }
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            max_file_size:
                                                                parseInt(
                                                                    e.target
                                                                        .value,
                                                                ),
                                                        })
                                                    }
                                                    placeholder="Maximum file size"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="max-attachments">
                                                    Max Attachments per Message
                                                </Label>
                                                <Input
                                                    id="max-attachments"
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={
                                                        formData.max_attachments ||
                                                        ""
                                                    }
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            max_attachments:
                                                                parseInt(
                                                                    e.target
                                                                        .value,
                                                                ),
                                                        })
                                                    }
                                                    placeholder="Maximum attachments"
                                                />
                                            </div>
                                        </div>

                                        {/* Allow Invites Toggle */}
                                        <div className="flex items-center justify-between rounded-lg border p-4">
                                            <div>
                                                <Label htmlFor="allow-invite">
                                                    Allow Invites
                                                </Label>
                                                <p className="text-muted-foreground text-sm">
                                                    Allow members to create
                                                    invite links
                                                </p>
                                            </div>
                                            <Switch
                                                id="allow-invite"
                                                checked={
                                                    formData.allow_invite ||
                                                    false
                                                }
                                                onCheckedChange={(checked) =>
                                                    setFormData({
                                                        ...formData,
                                                        allow_invite: checked,
                                                    })
                                                }
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="roles">
                            <div className="space-y-6">
                                {/* Create New Role */}
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle>
                                                    Create New Role
                                                </CardTitle>
                                                <CardDescription>
                                                    Add a new role to your
                                                    server with custom
                                                    permissions
                                                </CardDescription>
                                            </div>
                                            <Button
                                                onClick={handleCreateRole}
                                                disabled={
                                                    creatingRole ||
                                                    !newRole.name.trim()
                                                }
                                                className="flex items-center gap-2"
                                            >
                                                <Plus className="h-4 w-4" />
                                                {creatingRole
                                                    ? "Creating..."
                                                    : "Create Role"}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="new-role-name">
                                                    Role Name
                                                </Label>
                                                <Input
                                                    id="new-role-name"
                                                    placeholder="Enter role name"
                                                    value={newRole.name}
                                                    onChange={(e) =>
                                                        setNewRole((prev) => ({
                                                            ...prev,
                                                            name: e.target
                                                                .value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-role-rank">
                                                    Rank
                                                </Label>
                                                <Input
                                                    id="new-role-rank"
                                                    type="number"
                                                    min="1"
                                                    value={newRole.rank}
                                                    onChange={(e) =>
                                                        setNewRole((prev) => ({
                                                            ...prev,
                                                            rank:
                                                                parseInt(
                                                                    e.target
                                                                        .value,
                                                                ) || 100,
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Role Color</Label>
                                                <ColorPicker
                                                    value={newRole.color}
                                                    onChange={(color) =>
                                                        setNewRole((prev) => ({
                                                            ...prev,
                                                            color: color,
                                                        }))
                                                    }
                                                    className="h-10 w-full"
                                                />
                                            </div>
                                        </div>

                                        {/* Display Role Members Toggle */}
                                        <div className="flex items-center justify-between rounded-lg border p-4">
                                            <div>
                                                <Label htmlFor="new-display-members">
                                                    Display Role Members
                                                </Label>
                                                <p className="text-muted-foreground text-sm">
                                                    Show users with this role in
                                                    the member list
                                                </p>
                                            </div>
                                            <Switch
                                                id="new-display-members"
                                                checked={
                                                    newRole.display_role_members
                                                }
                                                onCheckedChange={(checked) =>
                                                    setNewRole((prev) => ({
                                                        ...prev,
                                                        display_role_members:
                                                            checked,
                                                    }))
                                                }
                                            />
                                        </div>

                                        {/* Permission presets and permissions for new role */}
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>
                                                    Permission Presets
                                                </Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(
                                                        PERMISSION_PRESETS,
                                                    ).map(([key, preset]) => {
                                                        const isActive =
                                                            getActivePreset(
                                                                newRole.permissions,
                                                            ) === key;
                                                        return (
                                                            <Button
                                                                key={key}
                                                                variant={
                                                                    "outline"
                                                                }
                                                                size="sm"
                                                                onClick={() =>
                                                                    applyPermissionPreset(
                                                                        key as keyof typeof PERMISSION_PRESETS,
                                                                        true,
                                                                    )
                                                                }
                                                                className={`${
                                                                    isActive
                                                                        ? "bg-primary text-primary-foreground hover:text-primary-foreground hover:bg-primary/80"
                                                                        : ""
                                                                }`}
                                                                type="button"
                                                            >
                                                                {preset.name}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Permissions</Label>
                                                <TooltipProvider>
                                                    <div className="max-h-64 overflow-y-auto rounded-lg border p-3">
                                                        {PERMISSION_GROUPS.map(
                                                            (group) => (
                                                                <div
                                                                    key={
                                                                        group.category
                                                                    }
                                                                    className="mb-4 last:mb-0"
                                                                >
                                                                    <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                                                                        {
                                                                            group.category
                                                                        }
                                                                    </h4>
                                                                    <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                                                                        {group.permissions.map(
                                                                            (
                                                                                perm,
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        perm.value
                                                                                    }
                                                                                    className="flex items-center space-x-2"
                                                                                >
                                                                                    <Checkbox
                                                                                        id={`new-${perm.value}`}
                                                                                        checked={newRole.permissions.includes(
                                                                                            perm.value,
                                                                                        )}
                                                                                        onCheckedChange={() =>
                                                                                            togglePermission(
                                                                                                perm.value,
                                                                                                true,
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger
                                                                                            asChild
                                                                                        >
                                                                                            <Label
                                                                                                htmlFor={`new-${perm.value}`}
                                                                                                className="cursor-pointer text-sm"
                                                                                            >
                                                                                                {
                                                                                                    perm.label
                                                                                                }
                                                                                            </Label>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>
                                                                                            <p>
                                                                                                {
                                                                                                    perm.description
                                                                                                }
                                                                                            </p>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Existing Roles */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Server Roles</CardTitle>
                                        <CardDescription>
                                            Manage existing roles and their
                                            permissions
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {roles.map((role) => (
                                                <div
                                                    key={role.id}
                                                    className="rounded-lg border p-4"
                                                >
                                                    {editingRole === role.id &&
                                                    editRole ? (
                                                        // Edit mode
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-3 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>
                                                                        Role
                                                                        Name
                                                                    </Label>
                                                                    <Input
                                                                        value={
                                                                            editRole.name
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            setEditRole(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev
                                                                                        ? {
                                                                                              ...prev,
                                                                                              name: e
                                                                                                  .target
                                                                                                  .value,
                                                                                          }
                                                                                        : null,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>
                                                                        Rank
                                                                    </Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={
                                                                            editRole.rank
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            setEditRole(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev
                                                                                        ? {
                                                                                              ...prev,
                                                                                              rank:
                                                                                                  parseInt(
                                                                                                      e
                                                                                                          .target
                                                                                                          .value,
                                                                                                  ) ||
                                                                                                  100,
                                                                                          }
                                                                                        : null,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>
                                                                        Role
                                                                        Color
                                                                    </Label>
                                                                    <ColorPicker
                                                                        value={
                                                                            editRole.color
                                                                        }
                                                                        onChange={(
                                                                            color,
                                                                        ) =>
                                                                            setEditRole(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev
                                                                                        ? {
                                                                                              ...prev,
                                                                                              color: color,
                                                                                          }
                                                                                        : null,
                                                                            )
                                                                        }
                                                                        className="h-10 w-full"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Display Role Members Toggle for Edit */}
                                                            <div className="flex items-center justify-between rounded-lg border p-4">
                                                                <div>
                                                                    <Label
                                                                        htmlFor={`edit-display-members-${role.id}`}
                                                                    >
                                                                        Display
                                                                        Role
                                                                        Members
                                                                    </Label>
                                                                    <p className="text-muted-foreground text-sm">
                                                                        Show
                                                                        users
                                                                        with
                                                                        this
                                                                        role in
                                                                        the
                                                                        member
                                                                        list
                                                                    </p>
                                                                </div>
                                                                <Switch
                                                                    id={`edit-display-members-${role.id}`}
                                                                    checked={
                                                                        editRole.display_role_members
                                                                    }
                                                                    onCheckedChange={(
                                                                        checked,
                                                                    ) =>
                                                                        setEditRole(
                                                                            (
                                                                                prev,
                                                                            ) =>
                                                                                prev
                                                                                    ? {
                                                                                          ...prev,
                                                                                          display_role_members:
                                                                                              checked,
                                                                                      }
                                                                                    : null,
                                                                        )
                                                                    }
                                                                />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label>
                                                                    Permissions
                                                                </Label>
                                                                <div className="max-h-64 overflow-y-auto rounded-lg border p-3">
                                                                    {PERMISSION_GROUPS.map(
                                                                        (
                                                                            group,
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    group.category
                                                                                }
                                                                                className="mb-4 last:mb-0"
                                                                            >
                                                                                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                                                                                    {
                                                                                        group.category
                                                                                    }
                                                                                </h4>
                                                                                <div className="grid grid-cols-2 gap-2">
                                                                                    {group.permissions.map(
                                                                                        (
                                                                                            perm,
                                                                                        ) => (
                                                                                            <div
                                                                                                key={
                                                                                                    perm.value
                                                                                                }
                                                                                                className="flex items-center space-x-2"
                                                                                            >
                                                                                                <Checkbox
                                                                                                    id={`edit-${role.id}-${perm.value}`}
                                                                                                    checked={editRole.permissions.includes(
                                                                                                        perm.value,
                                                                                                    )}
                                                                                                    onCheckedChange={() =>
                                                                                                        togglePermission(
                                                                                                            perm.value,
                                                                                                            false,
                                                                                                        )
                                                                                                    }
                                                                                                />
                                                                                                <Tooltip>
                                                                                                    <TooltipTrigger
                                                                                                        asChild
                                                                                                    >
                                                                                                        <Label
                                                                                                            htmlFor={`edit-${role.id}-${perm.value}`}
                                                                                                            className="cursor-pointer text-sm"
                                                                                                        >
                                                                                                            {
                                                                                                                perm.label
                                                                                                            }
                                                                                                        </Label>
                                                                                                    </TooltipTrigger>
                                                                                                    <TooltipContent>
                                                                                                        <p>
                                                                                                            {
                                                                                                                perm.description
                                                                                                            }
                                                                                                        </p>
                                                                                                    </TooltipContent>
                                                                                                </Tooltip>
                                                                                            </div>
                                                                                        ),
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={
                                                                        handleCancelEdit
                                                                    }
                                                                >
                                                                    <X className="mr-1 h-4 w-4" />
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={
                                                                        handleSaveRole
                                                                    }
                                                                >
                                                                    <Check className="mr-1 h-4 w-4" />
                                                                    Save
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Display mode
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="h-4 w-4 rounded-full"
                                                                    style={{
                                                                        backgroundColor:
                                                                            role.color,
                                                                    }}
                                                                />
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-medium">
                                                                            {
                                                                                role.name
                                                                            }
                                                                        </p>
                                                                        {role.id ===
                                                                            "owner" && (
                                                                            <Crown className="h-4 w-4 text-yellow-500" />
                                                                        )}
                                                                    </div>
                                                                    <p className="text-muted-foreground text-sm">
                                                                        Rank:{" "}
                                                                        {
                                                                            role.rank
                                                                        }{" "}
                                                                        •{" "}
                                                                        {
                                                                            role
                                                                                .permissions
                                                                                .length
                                                                        }{" "}
                                                                        permissions
                                                                        {!role.display_role_members && (
                                                                            <span className="text-amber-600">
                                                                                {
                                                                                    " • Hidden in member list"
                                                                                }
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {!role.assignable && (
                                                                    <Badge
                                                                        variant={
                                                                            "secondary"
                                                                        }
                                                                    >
                                                                        {
                                                                            "System"
                                                                        }
                                                                    </Badge>
                                                                )}
                                                                {role.assignable && (
                                                                    <>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                handleEditRole(
                                                                                    role,
                                                                                )
                                                                            }
                                                                            className="h-8 w-8 p-0"
                                                                        >
                                                                            <Edit2 className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                handleDeleteRole(
                                                                                    role,
                                                                                )
                                                                            }
                                                                            className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8 p-0"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="invites">
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Create Invite</CardTitle>
                                        <CardDescription>
                                            Generate a new invite link for your
                                            server
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-end gap-4">
                                            <div className="flex-1 space-y-2">
                                                <Label htmlFor="expires-in">
                                                    Expires in (hours)
                                                </Label>
                                                <Input
                                                    id="expires-in"
                                                    type="number"
                                                    min="1"
                                                    value={newInvite.expires_in}
                                                    onChange={(e) =>
                                                        setNewInvite(
                                                            (prev) => ({
                                                                ...prev,
                                                                expires_in:
                                                                    parseInt(
                                                                        e.target
                                                                            .value,
                                                                    ) || 24,
                                                            }),
                                                        )
                                                    }
                                                    placeholder="24"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <Label htmlFor="max-uses">
                                                    Max uses (0 = unlimited)
                                                </Label>
                                                <Input
                                                    id="max-uses"
                                                    type="number"
                                                    min="0"
                                                    value={newInvite.max_uses}
                                                    onChange={(e) =>
                                                        setNewInvite(
                                                            (prev) => ({
                                                                ...prev,
                                                                max_uses:
                                                                    parseInt(
                                                                        e.target
                                                                            .value,
                                                                    ) || 0,
                                                            }),
                                                        )
                                                    }
                                                    placeholder="0"
                                                />
                                            </div>
                                            <Button
                                                onClick={handleCreateInvite}
                                                disabled={creatingInvite}
                                                className="flex items-center gap-2"
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                {creatingInvite
                                                    ? "Creating..."
                                                    : "Create Invite"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Active Invites</CardTitle>
                                        <CardDescription>
                                            Manage existing invite links
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {loadingInvites ? (
                                            <div className="space-y-3">
                                                {Array.from({ length: 3 }).map(
                                                    (_, i) => (
                                                        <div
                                                            key={i}
                                                            className="flex items-center justify-between rounded-lg border p-3"
                                                        >
                                                            <div className="space-y-1">
                                                                <Skeleton className="h-4 w-24" />
                                                                <Skeleton className="h-3 w-48" />
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Skeleton className="h-8 w-8" />
                                                                <Skeleton className="h-8 w-8" />
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {invites.map((invite) => (
                                                    <div
                                                        key={invite.code}
                                                        className="flex items-center justify-between rounded-lg border p-3"
                                                    >
                                                        <div>
                                                            <p className="font-mono text-sm font-medium">
                                                                {invite.code}
                                                            </p>
                                                            <p className="text-muted-foreground text-xs">
                                                                Uses:{" "}
                                                                {invite.uses}/
                                                                {invite.max_uses ||
                                                                    "∞"}{" "}
                                                                •
                                                                {invite.expires_at
                                                                    ? ` Expires: ${new Date(invite.expires_at).toLocaleDateString()}`
                                                                    : " Never expires"}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    copyInviteCode(
                                                                        invite.code,
                                                                    )
                                                                }
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <Copy className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleDeleteInvite(
                                                                        invite.code,
                                                                    )
                                                                }
                                                                className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8 p-0"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {invites.length === 0 &&
                                                    !loadingInvites && (
                                                        <div className="text-muted-foreground py-12 text-center">
                                                            <UserPlus className="mx-auto mb-3 h-12 w-12 opacity-50" />
                                                            <p className="mb-1 text-lg font-medium">
                                                                No active
                                                                invites
                                                            </p>
                                                            <p className="text-sm">
                                                                Create your
                                                                first invite to
                                                                get started
                                                            </p>
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

function ServerEditSkeleton() {
    return (
        <div className="flex h-full flex-col">
            <div className="bg-background flex h-12 items-center justify-between border-b px-3">
                <Skeleton className="h-6 w-32" />
                <div className="flex items-center gap-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-8 rounded-md" />
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="container mx-auto max-w-4xl p-6">
                    <div className="mb-6">
                        <Skeleton className="mb-2 h-10 w-64" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-12 w-full" />
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-80" />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <Skeleton className="h-20 w-20 rounded-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
