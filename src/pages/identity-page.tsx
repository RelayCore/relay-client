// filepath: c:\Users\lucas\Documents\GitHub\relay-client\src\pages\identity-page.tsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Cloud,
    Download,
    Upload,
    RefreshCw,
    User,
    LogOut,
    CheckCircle,
    XCircle,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { IdentitySyncSignIn } from "@/components/identity/identity-sync-sign-in";
import { setAuthBaseURL } from "@/utils/auth";
import {
    loadServers,
    syncIdentitiesWithServer,
    pullServerIdentitiesToLocal,
    pushLocalIdentitiesToServer,
} from "@/storage/server-store";
import type { ServerRecord } from "@/storage/server-store";

export default function IdentityPage() {
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [serverUrl, setServerUrl] = useState<string | null>(null);
    const [servers, setServers] = useState<ServerRecord[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">(
        "idle",
    );
    const [error, setError] = useState<string | null>(null);

    // Check if user is already signed in
    useEffect(() => {
        const storedUrl = localStorage.getItem("authBaseURL");
        if (storedUrl) {
            setServerUrl(storedUrl);
            setIsSignedIn(true);
        }
        loadLocalServers();
    }, []);

    const loadLocalServers = async () => {
        try {
            const localServers = await loadServers();
            setServers(localServers);
        } catch (error) {
            console.error("Failed to load local servers:", error);
        }
    };

    const handleSignInSuccess = (url: string) => {
        setServerUrl(url);
        setIsSignedIn(true);
        setError(null);
        toast.success("Connected to identity sync server");
    };

    const handleSignOut = () => {
        setAuthBaseURL(null);
        setIsSignedIn(false);
        setServerUrl(null);
        setLastSyncTime(null);
        setSyncStatus("idle");
        setError(null);
        toast.success("Signed out from identity sync server");
    };

    const handleFullSync = async () => {
        if (!serverUrl) return;

        setIsSyncing(true);
        setError(null);

        try {
            await syncIdentitiesWithServer(serverUrl);
            await loadLocalServers();
            setLastSyncTime(new Date());
            setSyncStatus("success");
            toast.success("Identities synchronized successfully");
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Sync failed";
            setError(errorMessage);
            setSyncStatus("error");
            toast.error(`Sync failed: ${errorMessage}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePullFromServer = async () => {
        if (!serverUrl) return;

        setIsSyncing(true);
        setError(null);

        try {
            await pullServerIdentitiesToLocal(serverUrl);
            await loadLocalServers();
            setLastSyncTime(new Date());
            setSyncStatus("success");
            toast.success("Identities pulled from server successfully");
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Pull failed";
            setError(errorMessage);
            setSyncStatus("error");
            toast.error(`Pull failed: ${errorMessage}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePushToServer = async () => {
        if (!serverUrl) return;

        setIsSyncing(true);
        setError(null);

        try {
            await pushLocalIdentitiesToServer(serverUrl);
            setLastSyncTime(new Date());
            setSyncStatus("success");
            toast.success("Identities pushed to server successfully");
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Push failed";
            setError(errorMessage);
            setSyncStatus("error");
            toast.error(`Push failed: ${errorMessage}`);
        } finally {
            setIsSyncing(false);
        }
    };

    if (!isSignedIn) {
        return (
            <div className="flex h-full w-full items-center justify-center p-6">
                <div className="w-full max-w-md space-y-6">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold">
                            Identity Management
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Connect to your identity sync server to manage
                            identities across devices
                        </p>
                    </div>
                    <IdentitySyncSignIn onSignInSuccess={handleSignInSuccess} />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Identity Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Sync and manage your identities across devices
                    </p>
                </div>
                <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </Button>
            </div>

            {/* Connection Status */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Cloud className="h-5 w-5 text-green-500" />
                        <CardTitle>Connection Status</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Server URL</p>
                                <p className="text-muted-foreground text-sm">
                                    {serverUrl}
                                </p>
                            </div>
                            <Badge
                                variant="default"
                                className="bg-green-100 text-green-800"
                            >
                                Connected
                            </Badge>
                        </div>

                        {lastSyncTime && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Last Sync</p>
                                    <p className="text-muted-foreground text-sm">
                                        {lastSyncTime.toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {syncStatus === "success" && (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                    )}
                                    {syncStatus === "error" && (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    <Badge
                                        variant={
                                            syncStatus === "success"
                                                ? "default"
                                                : syncStatus === "error"
                                                  ? "destructive"
                                                  : "secondary"
                                        }
                                    >
                                        {syncStatus === "success"
                                            ? "Success"
                                            : syncStatus === "error"
                                              ? "Error"
                                              : "Idle"}
                                    </Badge>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Sync Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Sync Actions</CardTitle>
                    <CardDescription>
                        Synchronize your identities between local storage and
                        the server
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Button
                            onClick={handleFullSync}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2"
                        >
                            {isSyncing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Full Sync
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handlePullFromServer}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2"
                        >
                            {isSyncing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            Pull from Server
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handlePushToServer}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2"
                        >
                            {isSyncing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4" />
                            )}
                            Push to Server
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Local Identities */}
            <Card>
                <CardHeader>
                    <CardTitle>Local Identities</CardTitle>
                    <CardDescription>
                        Identities stored locally on this device (
                        {servers.length} total)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {servers.length === 0 ? (
                        <div className="py-8 text-center">
                            <User className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                            <p className="text-muted-foreground">
                                No local identities found
                            </p>
                            <p className="text-muted-foreground text-sm">
                                Try pulling from the server or joining some
                                servers first
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {servers.map((server) => (
                                <div
                                    key={server.user_id}
                                    className="flex items-center justify-between rounded-lg border p-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <User className="h-8 w-8 rounded-full border p-1" />
                                        <div>
                                            <p className="font-medium">
                                                {server.server_name ||
                                                    server.server_url}
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                User ID:{" "}
                                                {server.user_id.substring(0, 8)}
                                                ...
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                Server: {server.server_url}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">
                                            {new Date(
                                                server.joined_at,
                                            ).toLocaleDateString()}
                                        </Badge>
                                        {server.last_modified && (
                                            <Badge variant="outline">
                                                Modified:{" "}
                                                {new Date(
                                                    server.last_modified,
                                                ).toLocaleDateString()}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Help Section */}
            <Card>
                <CardHeader>
                    <CardTitle>How It Works</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 text-sm">
                        <div>
                            <p className="mb-1 font-medium">Full Sync</p>
                            <p className="text-muted-foreground">
                                Synchronizes identities in both directions,
                                ensuring both local and server have the latest
                                versions.
                            </p>
                        </div>
                        <Separator />
                        <div>
                            <p className="mb-1 font-medium">Pull from Server</p>
                            <p className="text-muted-foreground">
                                Downloads identities from the server and updates
                                local copies if the server versions are newer.
                            </p>
                        </div>
                        <Separator />
                        <div>
                            <p className="mb-1 font-medium">Push to Server</p>
                            <p className="text-muted-foreground">
                                Uploads local identities to the server, creating
                                new ones or updating existing ones if local
                                versions are newer.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
