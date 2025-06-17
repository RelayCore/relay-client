import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Server, AlertCircle, Check } from "lucide-react";
import { UserIdentity, ServerRecord } from "@/storage/server-store";

interface ImportConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    newIdentities: UserIdentity[];
    existingServers: Map<string, ServerRecord[]>;
    onConfirm: (serverAssignments: Map<string, string>) => void;
}

export function ImportConfirmationDialog({
    open,
    onOpenChange,
    newIdentities,
    existingServers,
    onConfirm,
}: ImportConfirmationDialogProps) {
    const [serverAssignments, setServerAssignments] = useState<
        Map<string, string>
    >(new Map());

    // Pre-populate server assignments when dialog opens or identities change
    React.useEffect(() => {
        if (newIdentities.length > 0) {
            const assignments = new Map<string, string>();
            newIdentities.forEach((identity) => {
                if (identity.server_url) {
                    assignments.set(identity.user_id, identity.server_url);
                }
            });
            setServerAssignments(assignments);
        }
    }, [newIdentities]);

    const handleServerUrlChange = (identityId: string, serverUrl: string) => {
        setServerAssignments((prev) =>
            new Map(prev).set(identityId, serverUrl),
        );
    };

    const handleConfirm = () => {
        onConfirm(serverAssignments);
        onOpenChange(false);
    };

    const canConfirm = newIdentities.every((identity) =>
        serverAssignments.has(identity.user_id),
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Import Identities Confirmation
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {existingServers.size > 0 && (
                        <div className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-medium">
                                <Check className="h-4 w-4 text-green-500" />
                                Existing Identities ({existingServers.size})
                            </h3>
                            <div className="space-y-2">
                                {Array.from(existingServers.entries()).map(
                                    ([userId, servers]) => (
                                        <div
                                            key={userId}
                                            className="rounded-lg border bg-green-50 p-3 dark:bg-green-950/20"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        Identity:{" "}
                                                        {userId.substring(
                                                            0,
                                                            16,
                                                        )}
                                                        ...
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        Already connected to{" "}
                                                        {servers.length} server
                                                        {servers.length === 1
                                                            ? ""
                                                            : "s"}
                                                    </p>
                                                </div>
                                                <Badge variant="secondary">
                                                    Already exists
                                                </Badge>
                                            </div>
                                            <div className="mt-2 space-y-1">
                                                {servers.map((server) => (
                                                    <p
                                                        key={server.server_url}
                                                        className="text-muted-foreground text-xs"
                                                    >
                                                        •{" "}
                                                        {server.server_name ||
                                                            server.server_url}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    )}

                    {newIdentities.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-medium">
                                <AlertCircle className="h-4 w-4 text-blue-500" />
                                New Identities ({newIdentities.length})
                            </h3>
                            <p className="text-muted-foreground text-xs">
                                These identities need to be assigned to servers.
                                {newIdentities.some((i) => i.server_url)
                                    ? " Server URLs have been pre-filled where available."
                                    : " Enter the server URL for each identity."}
                            </p>
                            <div className="space-y-4">
                                {newIdentities.map((identity) => (
                                    <div
                                        key={identity.user_id}
                                        className="space-y-3 rounded-lg border p-4"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4" />
                                            <span className="text-sm font-medium">
                                                Identity:{" "}
                                                {identity.user_id.substring(
                                                    0,
                                                    16,
                                                )}
                                                ...
                                            </span>
                                            <Badge variant="outline">
                                                Created:{" "}
                                                {new Date(
                                                    identity.created_at,
                                                ).toLocaleDateString()}
                                            </Badge>
                                            {identity.server_url && (
                                                <Badge
                                                    variant="default"
                                                    className="text-xs"
                                                >
                                                    Pre-filled
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label
                                                htmlFor={`server-${identity.user_id}`}
                                            >
                                                Server URL
                                            </Label>
                                            <Input
                                                id={`server-${identity.user_id}`}
                                                placeholder="wss://example.com/ws or https://example.com"
                                                value={
                                                    serverAssignments.get(
                                                        identity.user_id,
                                                    ) || ""
                                                }
                                                onChange={(e) =>
                                                    handleServerUrlChange(
                                                        identity.user_id,
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {newIdentities.length === 0 &&
                        existingServers.size === 0 && (
                            <div className="py-8 text-center">
                                <p className="text-muted-foreground">
                                    No identities to import.
                                </p>
                            </div>
                        )}

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!canConfirm && newIdentities.length > 0}
                        >
                            {newIdentities.length > 0
                                ? "Import & Connect"
                                : "Close"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
