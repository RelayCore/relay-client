import React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Hash,
    Volume2,
    AlertCircle,
    Trash2,
    Plus,
    User,
    Shield,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Channel,
    updateChannel,
    getChannelPermissions,
    setChannelPermission,
    deleteChannelPermission,
    getUsers,
    getRoles,
    Role,
    User as UserType,
    ChannelPermission,
} from "@/api/server";
import { useServerRecord } from "@/contexts/server-context";
import { useConfirm } from "@/contexts/confirm-context";
import { logError } from "@/utils/logger";

interface EditChannelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    channel: Channel | null;
    onChannelUpdated: () => void;
}

export default function EditChannelDialog({
    open,
    onOpenChange,
    channel,
    onChannelUpdated,
}: EditChannelDialogProps) {
    const serverRecord = useServerRecord();
    const { confirm } = useConfirm();
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [position, setPosition] = React.useState<string>("");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Permission states
    const [permissions, setPermissions] = React.useState<ChannelPermission[]>(
        [],
    );
    const [users, setUsers] = React.useState<UserType[]>([]);
    const [roles, setRoles] = React.useState<Role[]>([]);
    const [loadingPermissions, setLoadingPermissions] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState<string>("");
    const [selectedRole, setSelectedRole] = React.useState<string>("");

    // Reset form when dialog opens/closes or channel changes
    React.useEffect(() => {
        if (!open || !channel) {
            setName("");
            setDescription("");
            setPosition("");
            setError(null);
            setPermissions([]);
            setSelectedUser("");
            setSelectedRole("");
        } else {
            setName(channel.name);
            setDescription(channel.description || "");
            setPosition(channel.position.toString());
            loadPermissions();
            loadUsersAndRoles();
        }
    }, [open, channel]);

    const loadPermissions = async () => {
        if (!serverRecord || !channel) return;

        setLoadingPermissions(true);
        try {
            const response = await getChannelPermissions(
                serverRecord.server_url,
                serverRecord.user_id,
                channel.id,
            );
            setPermissions(response.permissions);
        } catch (err) {
            logError("Failed to load permissions", "api", String(err));
        } finally {
            setLoadingPermissions(false);
        }
    };

    const loadUsersAndRoles = async () => {
        if (!serverRecord) return;

        try {
            const [usersResponse, rolesResponse] = await Promise.all([
                getUsers(serverRecord.server_url, serverRecord.user_id),
                getRoles(serverRecord.server_url, serverRecord.user_id),
            ]);

            setUsers(usersResponse.users);
            setRoles(rolesResponse.roles || []);
        } catch (err) {
            logError("Failed to load users/roles", "api", String(err));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serverRecord || !channel || !name.trim()) {
            setError("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const channelPosition = position ? parseInt(position) : undefined;

            await updateChannel(serverRecord.server_url, serverRecord.user_id, {
                channel_id: channel.id,
                name: name.trim(),
                description: description.trim(),
                position: channelPosition,
            });

            onChannelUpdated();
            onOpenChange(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to update channel",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddUserPermission = async () => {
        if (!serverRecord || !channel || !selectedUser) return;

        try {
            await setChannelPermission(
                serverRecord.server_url,
                serverRecord.user_id,
                {
                    channel_id: channel.id,
                    user_id: selectedUser,
                    can_read: true,
                    can_write: false,
                    can_pin: false,
                    is_admin: false,
                },
            );

            setSelectedUser("");
            loadPermissions();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to add permission",
            );
        }
    };

    const handleAddRolePermission = async () => {
        if (!serverRecord || !channel || !selectedRole) return;

        try {
            await setChannelPermission(
                serverRecord.server_url,
                serverRecord.user_id,
                {
                    channel_id: channel.id,
                    role_name: selectedRole,
                    can_read: true,
                    can_write: false,
                    can_pin: false,
                    is_admin: false,
                },
            );

            setSelectedRole("");
            loadPermissions();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to add permission",
            );
        }
    };

    const handleUpdatePermission = async (
        permission: ChannelPermission,
        updates: Partial<ChannelPermission>,
    ) => {
        if (!serverRecord || !channel) return;

        try {
            await setChannelPermission(
                serverRecord.server_url,
                serverRecord.user_id,
                {
                    channel_id: channel.id,
                    user_id: permission.user_id,
                    role_name: permission.role_name,
                    can_read: updates.can_read ?? permission.can_read,
                    can_write: updates.can_write ?? permission.can_write,
                    can_pin: updates.can_pin ?? permission.can_pin,
                    is_admin: updates.is_admin ?? permission.is_admin,
                },
            );

            loadPermissions();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update permission",
            );
        }
    };

    const handleDeletePermission = async (permission: ChannelPermission) => {
        if (!serverRecord || !channel) return;

        const displayName = permission.user_id
            ? users.find((u) => u.id === permission.user_id)?.nickname ||
              users.find((u) => u.id === permission.user_id)?.username ||
              permission.user_id
            : roles.find((r) => r.id === permission.role_name)?.name ||
              permission.role_name;

        const confirmed = await confirm({
            title: "Remove Permission",
            description: `Are you sure you want to remove channel permissions for ${displayName}?`,
            confirmText: "Remove",
            cancelText: "Cancel",
            variant: "destructive",
        });

        if (!confirmed) return;

        try {
            await deleteChannelPermission(
                serverRecord.server_url,
                serverRecord.user_id,
                {
                    channel_id: channel.id,
                    user_id: permission.user_id,
                    role_name: permission.role_name,
                },
            );

            loadPermissions();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete permission",
            );
        }
    };

    const isValid = name.trim().length > 0;
    const hasChanges =
        channel &&
        (name !== channel.name ||
            description !== (channel.description || "") ||
            position !== channel.position.toString());

    if (!channel) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {channel.is_voice ? (
                            <Volume2 className="h-5 w-5" />
                        ) : (
                            <Hash className="h-5 w-5" />
                        )}
                        Edit {channel.is_voice ? "Voice" : "Text"} Channel
                    </DialogTitle>
                    <DialogDescription>
                        Edit the settings and permissions for #{channel.name}.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="permissions">
                            Permissions
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="channel-name">
                                    Channel Name *
                                </Label>
                                <Input
                                    id="channel-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="channel-name"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="channel-description">
                                    Description
                                </Label>
                                <Textarea
                                    id="channel-description"
                                    value={description}
                                    onChange={(e) =>
                                        setDescription(e.target.value)
                                    }
                                    placeholder={`What's this ${channel.is_voice ? "voice" : "text"} channel about?`}
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="channel-position">
                                    Position
                                </Label>
                                <Input
                                    id="channel-position"
                                    type="number"
                                    value={position}
                                    onChange={(e) =>
                                        setPosition(e.target.value)
                                    }
                                    placeholder="0"
                                    min="0"
                                />
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        !isValid || !hasChanges || isSubmitting
                                    }
                                >
                                    {isSubmitting
                                        ? "Saving..."
                                        : "Save Changes"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>

                    <TabsContent value="permissions" className="space-y-4">
                        {loadingPermissions ? (
                            <div className="text-muted-foreground text-center">
                                Loading permissions...
                            </div>
                        ) : (
                            <>
                                {/* Add new permissions */}
                                <div className="space-y-4 border-b pb-4">
                                    <h4 className="font-medium">
                                        Add Permission
                                    </h4>

                                    {/* Add user permission */}
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        <Select
                                            value={selectedUser}
                                            onValueChange={setSelectedUser}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Select user..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {users
                                                    .filter(
                                                        (user) =>
                                                            !permissions.some(
                                                                (p) =>
                                                                    p.user_id ===
                                                                    user.id,
                                                            ),
                                                    )
                                                    .map((user) => (
                                                        <SelectItem
                                                            key={user.id}
                                                            value={user.id}
                                                        >
                                                            {user.nickname ||
                                                                user.username}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            onClick={handleAddUserPermission}
                                            disabled={!selectedUser}
                                            size="sm"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Add role permission */}
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4" />
                                        <Select
                                            value={selectedRole}
                                            onValueChange={setSelectedRole}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Select role..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roles
                                                    .filter(
                                                        (role) =>
                                                            !permissions.some(
                                                                (p) =>
                                                                    p.role_name ===
                                                                    role.id,
                                                            ),
                                                    )
                                                    .map((role) => (
                                                        <SelectItem
                                                            key={role.id}
                                                            value={role.id}
                                                        >
                                                            {role.name}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            onClick={handleAddRolePermission}
                                            disabled={!selectedRole}
                                            size="sm"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Existing permissions */}
                                <div className="space-y-3">
                                    <h4 className="font-medium">
                                        Current Permissions
                                    </h4>

                                    {permissions.length === 0 ? (
                                        <div className="text-muted-foreground py-4 text-center">
                                            No custom permissions set. Channel
                                            uses default permissions.
                                        </div>
                                    ) : (
                                        permissions.map((permission) => (
                                            <div
                                                key={permission.id}
                                                className="space-y-3 rounded-lg border p-4"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {permission.user_id ? (
                                                            <>
                                                                <User className="h-4 w-4" />
                                                                <span className="font-medium">
                                                                    {users.find(
                                                                        (u) =>
                                                                            u.id ===
                                                                            permission.user_id,
                                                                    )
                                                                        ?.nickname ||
                                                                        users.find(
                                                                            (
                                                                                u,
                                                                            ) =>
                                                                                u.id ===
                                                                                permission.user_id,
                                                                        )
                                                                            ?.username ||
                                                                        permission.user_id}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Shield className="h-4 w-4" />
                                                                <span className="font-medium">
                                                                    {roles.find(
                                                                        (r) =>
                                                                            r.id ===
                                                                            permission.role_name,
                                                                    )?.name ||
                                                                        permission.role_name}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDeletePermission(
                                                                permission,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex items-center justify-between">
                                                        <Label
                                                            htmlFor={`read-${permission.id}`}
                                                        >
                                                            Can Read
                                                        </Label>
                                                        <Switch
                                                            id={`read-${permission.id}`}
                                                            checked={
                                                                permission.can_read
                                                            }
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                handleUpdatePermission(
                                                                    permission,
                                                                    {
                                                                        can_read:
                                                                            checked,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <Label
                                                            htmlFor={`write-${permission.id}`}
                                                        >
                                                            Can Write
                                                        </Label>
                                                        <Switch
                                                            id={`write-${permission.id}`}
                                                            checked={
                                                                permission.can_write
                                                            }
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                handleUpdatePermission(
                                                                    permission,
                                                                    {
                                                                        can_write:
                                                                            checked,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <Label
                                                            htmlFor={`pin-${permission.id}`}
                                                        >
                                                            Can Pin
                                                        </Label>
                                                        <Switch
                                                            id={`pin-${permission.id}`}
                                                            checked={
                                                                permission.can_pin
                                                            }
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                handleUpdatePermission(
                                                                    permission,
                                                                    {
                                                                        can_pin:
                                                                            checked,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <Label
                                                            htmlFor={`admin-${permission.id}`}
                                                        >
                                                            Admin
                                                        </Label>
                                                        <Switch
                                                            id={`admin-${permission.id}`}
                                                            checked={
                                                                permission.is_admin
                                                            }
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                handleUpdatePermission(
                                                                    permission,
                                                                    {
                                                                        is_admin:
                                                                            checked,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
