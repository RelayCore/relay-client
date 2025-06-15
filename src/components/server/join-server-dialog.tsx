import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { generateKeyPair } from "@/utils/crypto";
import { joinServer } from "@/api/join";
import { Loader2 } from "lucide-react";
import { getSetting } from "@/utils/settings";
import { addServer } from "@/storage/server-store";
import { useNavigate } from "@tanstack/react-router";

interface JoinServerDialogProps {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: (userId: string) => void;
}

export function JoinServerDialog({
    children,
    open,
    onOpenChange,
    onSuccess,
}: JoinServerDialogProps) {
    const [serverUrl, setServerUrl] = useState("http://localhost:3000");
    const [username, setUsername] = useState(getSetting("username") as string);
    const [nickname, setNickname] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{
        type: "success" | "error" | null;
        message: string;
    }>({ type: null, message: "" });
    const navigate = useNavigate();

    const resetForm = () => {
        setServerUrl("http://localhost:3000");
        setUsername(getSetting("username") as string);
        setNickname("");
        setInviteCode("");
        setConnectionStatus({ type: null, message: "" });
        setIsConnecting(false);
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && !isConnecting) {
            resetForm();
        }
        onOpenChange?.(newOpen);
    };

    const handleJoinServer = async (e: React.FormEvent) => {
        e.preventDefault();

        if (
            !serverUrl.trim() ||
            !username.trim() ||
            !nickname.trim() ||
            !inviteCode.trim()
        ) {
            setConnectionStatus({
                type: "error",
                message: "Please fill in all fields",
            });
            return;
        }

        setIsConnecting(true);
        setConnectionStatus({ type: null, message: "" });

        try {
            // Generate new keypair for this session
            const keypair = generateKeyPair();

            // Attempt to join the server
            const result = await joinServer(
                serverUrl.trim(),
                username.trim(),
                nickname.trim(),
                inviteCode.trim(),
                keypair,
            );

            if (result.success && result.serverInfo) {
                // Create server record
                const serverRecord = {
                    server_url: serverUrl.trim(),
                    username: username.trim(),
                    nickname: nickname.trim(),
                    user_id: result.userId!,
                    public_key: btoa(String.fromCharCode(...keypair.publicKey)),
                    private_key: btoa(
                        String.fromCharCode(...keypair.secretKey),
                    ),
                    joined_at: new Date().toISOString(),
                    server_name: result.serverInfo.name,
                    server_description: result.serverInfo.description,
                    server_allow_invite: result.serverInfo.allow_invite,
                    server_max_users: result.serverInfo.max_users,
                    server_icon: result.serverInfo.icon,
                };

                // Add server to storage
                await addServer(serverRecord);

                setConnectionStatus({
                    type: "success",
                    message: `Successfully joined server!`,
                });

                // Call success callback or navigate
                if (onSuccess) {
                    onSuccess(result.userId!);
                } else {
                    setTimeout(() => {
                        navigate({ to: `/servers/${result.userId}` });
                        handleOpenChange(false);
                    }, 1500);
                }
            } else {
                setConnectionStatus({
                    type: "error",
                    message: result.error || "Failed to join server",
                });
            }
        } catch (error) {
            setConnectionStatus({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Connection failed",
            });
        } finally {
            setIsConnecting(false);
        }
    };

    const dialogContent = (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Join Chat Server</DialogTitle>
                <DialogDescription>
                    Enter server details to connect and start chatting
                </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleJoinServer} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="dialog-serverUrl">Server URL</Label>
                    <Input
                        id="dialog-serverUrl"
                        type="url"
                        placeholder="http://localhost:3000"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        disabled={isConnecting}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="dialog-username">Username</Label>
                    <Input
                        id="dialog-username"
                        type="text"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isConnecting}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="dialog-nickname">Nickname</Label>
                    <Input
                        id="dialog-nickname"
                        type="text"
                        placeholder="Enter your display name"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        disabled={isConnecting}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="dialog-inviteCode">Invite Code</Label>
                    <Input
                        id="dialog-inviteCode"
                        type="text"
                        placeholder="Enter server invite code"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        disabled={isConnecting}
                    />
                </div>

                {connectionStatus.type && (
                    <div
                        className={`rounded-md p-3 text-sm ${
                            connectionStatus.type === "success"
                                ? "border border-green-200 bg-green-50 text-green-700"
                                : "border border-red-200 bg-red-50 text-red-700"
                        }`}
                    >
                        {connectionStatus.message}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isConnecting}
                    >
                        {isConnecting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            "Join Server"
                        )}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );

    if (children) {
        return (
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                {dialogContent}
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {dialogContent}
        </Dialog>
    );
}
