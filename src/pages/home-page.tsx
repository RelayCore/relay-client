import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateKeyPair } from "@/utils/crypto";
import { joinServer } from "@/api/join";
import { Loader2 } from "lucide-react";
import { getSetting } from "@/utils/settings";
import { addServer } from "@/storage/server-store";
import { useNavigate } from "@tanstack/react-router";

export default function HomePage() {
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
                    message: `Successfully joined server! Redirecting...`,
                });

                // Navigate to the server after a brief delay
                setTimeout(() => {
                    navigate({ to: `/servers/${result.userId}` });
                }, 1500);
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

    return (
        <div className="flex h-full w-full flex-col items-center justify-center p-8">
            <Card className="w-full max-w-md p-6">
                <div className="space-y-6">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">Join Chat Server</h1>
                        <p className="text-muted-foreground mt-2 text-sm">
                            Enter server details to connect and start chatting
                        </p>
                    </div>

                    <form onSubmit={handleJoinServer} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="serverUrl">Server URL</Label>
                            <Input
                                id="serverUrl"
                                type="url"
                                placeholder="http://localhost:3000"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                disabled={isConnecting}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isConnecting}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nickname">Nickname</Label>
                            <Input
                                id="nickname"
                                type="text"
                                placeholder="Enter your display name"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                disabled={isConnecting}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="inviteCode">Invite Code</Label>
                            <Input
                                id="inviteCode"
                                type="text"
                                placeholder="Enter server invite code"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                disabled={isConnecting}
                            />
                        </div>

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
                    </form>

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
                </div>
            </Card>

            <div className="text-muted-foreground mt-8 max-w-md text-center text-sm">
                <p>Your connection is secured with cryptographic signatures.</p>
                <p>A new keypair will be generated for each session.</p>
            </div>
        </div>
    );
}
