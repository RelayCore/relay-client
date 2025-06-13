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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorPicker } from "@/components/ui/color-picker";
import { toast } from "sonner";
import {
    Upload,
    Settings,
    Trash2,
    Plus,
    Crown,
    UserPlus,
    Copy,
    X,
} from "lucide-react";
import {
    ServerInfo,
    removeRole,
    getInvites,
    uploadServerIcon,
    createServerRole,
    createServerInvite,
    deleteServerInvite,
} from "@/api/server";
import { useServer, useServerRecord } from "@/contexts/server-context";
import { useNavigate } from "@tanstack/react-router";
import ServerHeader from "@/components/server/server-header";

interface Invite {
    code: string;
    created_by: string;
    created_at: string;
    expires_at?: string;
    max_uses: number;
    uses: number;
}

export default function ServerEditPage() {
    const {
        serverInfo,
        users,
        roles,
        refreshServerData,
        clearServerStatusCache,
        loading: contextLoading,
    } = useServer();
    const serverRecord = useServerRecord();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [invites, setInvites] = useState<Invite[]>([]);

    // Form states
    const [formData, setFormData] = useState<Partial<ServerInfo>>({});
    const [newRole, setNewRole] = useState({ name: "", color: "#5865F2" });
    const [newInvite, setNewInvite] = useState({ expires_in: 24, max_uses: 0 });

    useEffect(() => {
        if (serverInfo) {
            setFormData(serverInfo);
            setLoading(false);
        }
        loadInvites();
    }, [serverInfo]);

    const loadInvites = async () => {
        if (!serverRecord) return;

        try {
            const response = await getInvites(
                serverRecord.server_url,
                serverRecord.user_id, // Changed from serverRecord.id
            );
            setInvites(response.invites || []);
        } catch (error) {
            console.error("Failed to load invites:", error);
        }
    };

    const handleIconUpload = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file || !serverRecord) return;

        try {
            setSaving(true);
            await uploadServerIcon(
                serverRecord.server_url,
                serverRecord.user_id,
                file,
            );
            toast.success("Server icon updated successfully");
            clearServerStatusCache();
            refreshServerData();
        } catch {
            toast.error("Failed to upload server icon");
        } finally {
            setSaving(false);
        }
    };

    const createRole = async () => {
        if (!newRole.name.trim() || !serverRecord) return;

        try {
            await createServerRole(
                serverRecord.server_url,
                serverRecord.user_id,
                {
                    id: newRole.name.toLowerCase().replace(/\s+/g, "-"),
                    name: newRole.name,
                    color: newRole.color,
                    permissions: [],
                    rank: 100,
                    assignable: true,
                },
            );
            toast.success("Role created successfully");
            setNewRole({ name: "", color: "#5865F2" });
            clearServerStatusCache();
            refreshServerData();
        } catch {
            toast.error("Failed to create role");
        }
    };

    const handleRemoveRole = async (userId: string, roleId: string) => {
        if (!serverRecord) return;

        try {
            await removeRole(
                serverRecord.server_url,
                serverRecord.user_id,
                userId,
                roleId,
            );
            toast.success("Role removed successfully");
            clearServerStatusCache();
            refreshServerData();
        } catch {
            toast.error("Failed to remove role");
        }
    };

    const createInvite = async () => {
        if (!serverRecord) return;

        try {
            await createServerInvite(
                serverRecord.server_url,
                serverRecord.user_id,
                {
                    // Changed from serverRecord.id
                    created_by: serverRecord.user_id, // Changed from serverRecord.id
                    expires_in: newInvite.expires_in,
                    max_uses: newInvite.max_uses,
                },
            );
            toast.success("Invite created successfully");
            loadInvites();
        } catch {
            toast.error("Failed to create invite");
        }
    };

    const deleteInvite = async (code: string) => {
        if (!serverRecord) return;

        try {
            await deleteServerInvite(
                serverRecord.server_url,
                serverRecord.user_id, // Changed from serverRecord.id
                code,
            );
            toast.success("Invite deleted successfully");
            loadInvites();
        } catch {
            toast.error("Failed to delete invite");
        }
    };

    const copyInviteCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success("Invite code copied to clipboard");
    };

    const handleBackClick = () => {
        navigate({
            to: `/servers/${serverRecord?.user_id}`,
        });
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
                <div className="container mx-auto max-w-6xl p-6">
                    <div className="mb-2">
                        <div>
                            <h1 className="flex items-center gap-2 text-3xl font-bold">
                                <Settings className="h-8 w-8" />
                                Server Settings
                            </h1>
                            <p className="text-muted-foreground">
                                Manage your server&apos;s configuration, roles,
                                and members
                            </p>
                        </div>
                    </div>

                    <Tabs defaultValue="general" className="space-y-2">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="roles">Roles</TabsTrigger>
                            <TabsTrigger value="members">Members</TabsTrigger>
                            <TabsTrigger value="invites">Invites</TabsTrigger>
                            <TabsTrigger value="security">Security</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Server Information</CardTitle>
                                    <CardDescription>
                                        Configure your server&apos;s basic
                                        information and settings
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center space-x-4">
                                        <div className="relative">
                                            <Avatar className="h-20 w-20">
                                                <AvatarImage
                                                    src={serverInfo?.icon}
                                                />
                                                <AvatarFallback>
                                                    {serverInfo?.name
                                                        ?.substring(0, 2)
                                                        .toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <Label
                                                htmlFor="icon-upload"
                                                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100"
                                            >
                                                <Upload className="h-5 w-5" />
                                            </Label>
                                            <Input
                                                id="icon-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleIconUpload}
                                                disabled={saving}
                                            />
                                        </div>
                                        <div>
                                            <h3 className="font-medium">
                                                Server Icon
                                            </h3>
                                            <p className="text-muted-foreground text-sm">
                                                PNG, JPG, GIF up to 5MB
                                            </p>
                                        </div>
                                    </div>

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
                                                        name: e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="max-users">
                                                Max Users
                                            </Label>
                                            <Input
                                                id="max-users"
                                                type="number"
                                                value={formData.max_users || ""}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        max_users: parseInt(
                                                            e.target.value,
                                                        ),
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="description">
                                            Description
                                        </Label>
                                        <Textarea
                                            id="description"
                                            value={formData.description || ""}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    description: e.target.value,
                                                })
                                            }
                                            rows={3}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="allow-invite">
                                                Allow Invites
                                            </Label>
                                            <p className="text-muted-foreground text-sm">
                                                Allow members to create invite
                                                links
                                            </p>
                                        </div>
                                        <Switch
                                            id="allow-invite"
                                            checked={
                                                formData.allow_invite || false
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
                        </TabsContent>

                        <TabsContent value="roles">
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Create New Role</CardTitle>
                                        <CardDescription>
                                            Add a new role to your server
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-4">
                                            <Input
                                                placeholder="Role name"
                                                value={newRole.name}
                                                onChange={(e) =>
                                                    setNewRole({
                                                        ...newRole,
                                                        name: e.target.value,
                                                    })
                                                }
                                                className="h-10 w-full"
                                            />
                                            <ColorPicker
                                                value={newRole.color}
                                                onChange={(color) =>
                                                    setNewRole({
                                                        ...newRole,
                                                        color: color,
                                                    })
                                                }
                                                className="h-10 w-12"
                                            />
                                            <Button onClick={createRole}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Server Roles</CardTitle>
                                        <CardDescription>
                                            Manage roles and their permissions
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {roles.map((role) => (
                                                <div
                                                    key={role.id}
                                                    className="flex items-center justify-between rounded-lg border p-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="h-4 w-4 rounded-full"
                                                            style={{
                                                                backgroundColor:
                                                                    role.color,
                                                            }}
                                                        />
                                                        <div>
                                                            <p className="font-medium">
                                                                {role.name}
                                                            </p>
                                                            <p className="text-muted-foreground text-sm">
                                                                Rank:{" "}
                                                                {role.rank} •{" "}
                                                                {
                                                                    role
                                                                        .permissions
                                                                        .length
                                                                }{" "}
                                                                permissions
                                                            </p>
                                                        </div>
                                                        {role.id ===
                                                            "admin" && (
                                                            <Crown className="h-4 w-4 text-yellow-500" />
                                                        )}
                                                    </div>
                                                    <Badge
                                                        variant={
                                                            role.assignable
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {role.assignable
                                                            ? "Assignable"
                                                            : "System"}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="members">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Server Members</CardTitle>
                                    <CardDescription>
                                        Manage member roles and permissions
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {users.map((user) => (
                                            <div
                                                key={user.id}
                                                className="flex items-center justify-between rounded-lg border p-4"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <Avatar>
                                                            <AvatarFallback>
                                                                {user.username
                                                                    .substring(
                                                                        0,
                                                                        2,
                                                                    )
                                                                    .toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {user.is_online && (
                                                            <div className="border-background absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 bg-green-500" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">
                                                            {user.nickname ||
                                                                user.username}
                                                        </p>
                                                        <p className="text-muted-foreground text-sm">
                                                            @{user.username}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {user.roles.map((role) => (
                                                        <Badge
                                                            key={role.id}
                                                            variant="outline"
                                                            className="gap-1"
                                                            style={{
                                                                borderColor:
                                                                    role.color,
                                                                color: role.color,
                                                            }}
                                                        >
                                                            {role.name}
                                                            {role.assignable && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="hover:bg-destructive hover:text-destructive-foreground h-4 w-4 p-0"
                                                                    onClick={() =>
                                                                        handleRemoveRole(
                                                                            user.id,
                                                                            role.id,
                                                                        )
                                                                    }
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
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
                                        <div className="flex gap-4">
                                            <div className="space-y-2">
                                                <Label>
                                                    Expires in (hours)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    value={newInvite.expires_in}
                                                    onChange={(e) =>
                                                        setNewInvite({
                                                            ...newInvite,
                                                            expires_in:
                                                                parseInt(
                                                                    e.target
                                                                        .value,
                                                                ),
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>
                                                    Max uses (0 = unlimited)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    value={newInvite.max_uses}
                                                    onChange={(e) =>
                                                        setNewInvite({
                                                            ...newInvite,
                                                            max_uses: parseInt(
                                                                e.target.value,
                                                            ),
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <Button onClick={createInvite}>
                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                    Create Invite
                                                </Button>
                                            </div>
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
                                        <div className="space-y-3">
                                            {invites.map((invite) => (
                                                <div
                                                    key={invite.code}
                                                    className="flex items-center justify-between rounded-lg border p-3"
                                                >
                                                    <div>
                                                        <p className="font-mono text-sm">
                                                            {invite.code}
                                                        </p>
                                                        <p className="text-muted-foreground text-xs">
                                                            Uses: {invite.uses}/
                                                            {invite.max_uses ||
                                                                "∞"}{" "}
                                                            •
                                                            {invite.expires_at
                                                                ? ` Expires: ${new Date(
                                                                      invite.expires_at,
                                                                  ).toLocaleDateString()}`
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
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                deleteInvite(
                                                                    invite.code,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {invites.length === 0 && (
                                                <p className="text-muted-foreground py-8 text-center">
                                                    No active invites
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="security">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Security Settings</CardTitle>
                                    <CardDescription>
                                        Configure security and moderation
                                        settings
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Max File Size (MB)</Label>
                                            <Input
                                                type="number"
                                                value={
                                                    formData.max_file_size || ""
                                                }
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        max_file_size: parseInt(
                                                            e.target.value,
                                                        ),
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>
                                                Max Attachments per Message
                                            </Label>
                                            <Input
                                                type="number"
                                                value={
                                                    formData.max_attachments ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        max_attachments:
                                                            parseInt(
                                                                e.target.value,
                                                            ),
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
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
                <div className="container mx-auto max-w-6xl p-6">
                    <div className="mb-2">
                        <Skeleton className="mb-2 h-10 w-64" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <div className="space-y-2">
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
