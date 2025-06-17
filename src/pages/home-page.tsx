import React, { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ServerIcon,
    Plus,
    Users,
    LogOut,
    RefreshCw,
    Download,
    Upload,
    FileDown,
    FileUp,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
    loadServers,
    ServerRecord,
    removeServer,
    UserIdentity,
    restoreIdentityToServer,
    findExistingServersForIdentities,
    getNewIdentities,
} from "@/storage/server-store";
import { JoinServerDialog } from "@/components/server/join-server-dialog";
import { ExportIdentityDialog } from "@/components/identity/export-identity";
import { ImportIdentityDialog } from "@/components/identity/import-identity";
import { ImportConfirmationDialog } from "@/components/identity/import-identity-confirmation";
import { ExportAllIdentitiesDialog } from "@/components/identity/export-all-identities";
import { webSocketManager } from "@/websocket/websocket-manager";
import { leaveServer, getServerInfo, ServerInfo } from "@/api/server";
import { toast } from "sonner";
import { useConfirm } from "@/contexts/confirm-context";

interface ServerStatus {
    online: boolean;
    metadata?: ServerInfo;
    lastChecked: number;
}

// Cache key for server status
const SERVER_STATUS_CACHE_KEY = "server-status-cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface ServerRetryInfo {
    retryCount: number;
    nextRetry: number;
    lastAttempt: number;
}

// Cache key for server retry info
const SERVER_RETRY_CACHE_KEY = "server-retry-cache";
const INITIAL_RETRY_DELAY = 30 * 60 * 1000; // 30 minutes
const MAX_RETRY_DELAY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRY_COUNT = 10;

export default function HomePage() {
    const [servers, setServers] = useState<ServerRecord[]>([]);
    const [serverStatuses, setServerStatuses] = useState<
        Map<string, ServerStatus>
    >(new Map());
    const [serverRetries, setServerRetries] = useState<
        Map<string, ServerRetryInfo>
    >(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [connectionStates, setConnectionStates] = useState<
        Map<string, boolean>
    >(new Map());
    const [leavingServers, setLeavingServers] = useState<Set<string>>(
        new Set(),
    );
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportAllDialogOpen, setExportAllDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importConfirmationOpen, setImportConfirmationOpen] = useState(false);
    const [pendingIdentities, setPendingIdentities] = useState<{
        new: UserIdentity[];
        existing: Map<string, ServerRecord[]>;
    }>({
        new: [],
        existing: new Map(),
    });
    const [selectedServerForExport, setSelectedServerForExport] = useState<{
        serverUrl: string;
        userId: string;
    } | null>(null);
    const navigate = useNavigate();
    const { confirm } = useConfirm();

    // Load cached server statuses
    const loadCachedStatuses = useCallback(() => {
        try {
            const cached = localStorage.getItem(SERVER_STATUS_CACHE_KEY);
            if (cached) {
                const parsedCache = JSON.parse(cached);
                const statusMap = new Map<string, ServerStatus>();

                Object.entries(parsedCache).forEach(([userId, status]) => {
                    const serverStatus = status as ServerStatus;
                    // Check if cache is still valid
                    if (
                        Date.now() - serverStatus.lastChecked <
                        CACHE_DURATION
                    ) {
                        statusMap.set(userId, serverStatus);
                    }
                });

                setServerStatuses(statusMap);
                return statusMap;
            }
        } catch (error) {
            console.error("Failed to load cached server statuses:", error);
        }
        return new Map<string, ServerStatus>();
    }, []);

    // Save server statuses to cache
    const saveCachedStatuses = useCallback(
        (statuses: Map<string, ServerStatus>) => {
            try {
                const cacheObj = Object.fromEntries(statuses);
                localStorage.setItem(
                    SERVER_STATUS_CACHE_KEY,
                    JSON.stringify(cacheObj),
                );
            } catch (error) {
                console.error(
                    "Failed to save server statuses to cache:",
                    error,
                );
            }
        },
        [],
    );

    // Load cached retry info
    const loadCachedRetries = useCallback(() => {
        try {
            const cached = localStorage.getItem(SERVER_RETRY_CACHE_KEY);
            if (cached) {
                const parsedCache = JSON.parse(cached);
                const retryMap = new Map<string, ServerRetryInfo>();

                Object.entries(parsedCache).forEach(([userId, retryInfo]) => {
                    retryMap.set(userId, retryInfo as ServerRetryInfo);
                });

                setServerRetries(retryMap);
                return retryMap;
            }
        } catch (error) {
            console.error("Failed to load cached retry info:", error);
        }
        return new Map<string, ServerRetryInfo>();
    }, []);

    // Save retry info to cache
    const saveCachedRetries = useCallback(
        (retries: Map<string, ServerRetryInfo>) => {
            try {
                const cacheObj = Object.fromEntries(retries);
                localStorage.setItem(
                    SERVER_RETRY_CACHE_KEY,
                    JSON.stringify(cacheObj),
                );
            } catch (error) {
                console.error("Failed to save retry info to cache:", error);
            }
        },
        [],
    );

    // Fetch server metadata
    const fetchServerMetadata = useCallback(
        async (server: ServerRecord): Promise<ServerStatus> => {
            try {
                const metadata = await getServerInfo(server.server_url);
                return {
                    online: true,
                    metadata,
                    lastChecked: Date.now(),
                };
            } catch {
                return {
                    online: false,
                    lastChecked: Date.now(),
                };
            }
        },
        [],
    );

    // Calculate next retry delay with exponential backoff
    const calculateRetryDelay = useCallback((retryCount: number) => {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        return Math.min(delay, MAX_RETRY_DELAY);
    }, []);

    // Update retry info for a server
    const updateRetryInfo = useCallback(
        (userId: string, success: boolean) => {
            setServerRetries((prev) => {
                const newRetries = new Map(prev);
                const current = newRetries.get(userId);

                if (success) {
                    // Remove retry info on success
                    newRetries.delete(userId);
                } else {
                    // Update retry info on failure
                    const retryCount = (current?.retryCount || 0) + 1;
                    const now = Date.now();
                    const delay = calculateRetryDelay(retryCount - 1);

                    if (retryCount <= MAX_RETRY_COUNT) {
                        newRetries.set(userId, {
                            retryCount,
                            nextRetry: now + delay,
                            lastAttempt: now,
                        });
                    }
                }

                saveCachedRetries(newRetries);
                return newRetries;
            });
        },
        [calculateRetryDelay, saveCachedRetries],
    );

    // Verify all servers
    const verifyServers = useCallback(
        async (serverList: ServerRecord[]) => {
            const cachedStatuses = loadCachedStatuses();
            const cachedRetries = loadCachedRetries();
            const newStatuses = new Map(cachedStatuses);
            const promises: Promise<void>[] = [];
            const now = Date.now();

            for (const server of serverList) {
                const cached = cachedStatuses.get(server.user_id);
                const retryInfo = cachedRetries.get(server.user_id);

                // Check if we should skip this server due to retry logic
                if (
                    retryInfo &&
                    retryInfo.nextRetry > now &&
                    retryInfo.retryCount <= MAX_RETRY_COUNT
                ) {
                    continue;
                }

                // Check if we have valid cached data
                if (
                    cached &&
                    Date.now() - cached.lastChecked < CACHE_DURATION
                ) {
                    continue;
                }

                // Fetch fresh data
                const promise = fetchServerMetadata(server).then((status) => {
                    newStatuses.set(server.user_id, status);
                    updateRetryInfo(server.user_id, status.online);
                });
                promises.push(promise);
            }

            // Wait for all requests to complete
            await Promise.allSettled(promises);

            // Update state and cache
            setServerStatuses(newStatuses);
            saveCachedStatuses(newStatuses);
        },
        [
            loadCachedStatuses,
            saveCachedStatuses,
            fetchServerMetadata,
            loadCachedRetries,
            updateRetryInfo,
        ],
    );

    useEffect(() => {
        const loadServerData = async () => {
            try {
                const serverData = await loadServers();
                setServers(serverData);

                // Load cached statuses first
                loadCachedStatuses();

                // Then verify servers
                await verifyServers(serverData);

                // Initialize connection states
                const initialConnectionStates = new Map<string, boolean>();
                serverData.forEach((server) => {
                    initialConnectionStates.set(
                        server.user_id,
                        webSocketManager.isConnected(server.user_id),
                    );
                });
                setConnectionStates(initialConnectionStates);
            } catch (error) {
                console.error("Failed to load servers:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadServerData();

        // Listen for server updates
        const handleServersUpdated = () => {
            loadServerData();
        };

        // Listen for connection changes
        const handleConnectionChange = (event: CustomEvent) => {
            const { userId, connected } = event.detail;
            setConnectionStates((prev) => new Map(prev).set(userId, connected));
        };

        window.addEventListener("servers-updated", handleServersUpdated);
        window.addEventListener(
            "websocket-connection-changed",
            handleConnectionChange as EventListener,
        );

        return () => {
            window.removeEventListener("servers-updated", handleServersUpdated);
            window.removeEventListener(
                "websocket-connection-changed",
                handleConnectionChange as EventListener,
            );
        };
    }, [loadCachedStatuses, verifyServers]);

    // Helper functions (moved after all useState calls and before other useCallback calls)
    const getServerDisplayName = (server: ServerRecord) => {
        const status = serverStatuses.get(server.user_id);
        if (status?.metadata?.name) {
            return status.metadata.name;
        }
        return server.server_name || server.server_url;
    };

    const getServerDescription = (server: ServerRecord) => {
        const status = serverStatuses.get(server.user_id);
        if (status?.metadata?.description) {
            return status.metadata.description;
        }
        return server.server_description || "No description available";
    };

    const isServerOnline = (server: ServerRecord) => {
        const status = serverStatuses.get(server.user_id);
        return status?.online ?? true; // Default to true if unknown
    };

    const isServerAccessible = (server: ServerRecord) => {
        const status = serverStatuses.get(server.user_id);
        const isOnline = status?.online ?? true;
        const isWebSocketConnected =
            connectionStates.get(server.user_id) ?? false;
        return isOnline && isWebSocketConnected;
    };

    const getRetryTimeString = (server: ServerRecord) => {
        const retryInfo = serverRetries.get(server.user_id);
        if (!retryInfo) return null;

        const timeUntilRetry = retryInfo.nextRetry - Date.now();
        if (timeUntilRetry <= 0) return "Retrying soon...";

        const hours = Math.floor(timeUntilRetry / (60 * 60 * 1000));
        const minutes = Math.floor(
            (timeUntilRetry % (60 * 60 * 1000)) / (60 * 1000),
        );

        if (hours > 0) {
            return `Retry in ${hours}h ${minutes}m`;
        }
        return `Retry in ${minutes}m`;
    };

    // Handle exporting identity
    const handleExportIdentity = useCallback((server: ServerRecord) => {
        setSelectedServerForExport({
            serverUrl: server.server_url,
            userId: server.user_id,
        });
        setExportDialogOpen(true);
    }, []);

    // Handle leaving a server
    const handleLeaveServer = useCallback(
        async (server: ServerRecord) => {
            const displayName = getServerDisplayName(server);
            const online = isServerOnline(server);

            const confirmed = await confirm({
                title: "Leave Server",
                description: `Are you sure you want to leave "${displayName}"?${
                    !online
                        ? "\n\nNote: The server is currently offline. You will be removed locally, but the server won't be notified until it comes back online."
                        : ""
                }`,
                confirmText: "Leave Server",
                variant: "destructive",
            });

            if (!confirmed) return;

            setLeavingServers((prev) => new Set(prev).add(server.user_id));

            try {
                if (online) {
                    // Try to leave gracefully if server is online
                    try {
                        await leaveServer(server.server_url, server.user_id);
                        toast.success("Successfully left the server");
                    } catch (error) {
                        // If leaving fails but server is online, show error but don't remove locally
                        if (
                            error instanceof Error &&
                            error.message.includes(
                                "Cannot leave server: you are the owner",
                            )
                        ) {
                            toast.error(
                                "Cannot leave server: you are the owner",
                            );
                            return;
                        }
                        toast.warning(
                            "Failed to notify server, but removed locally",
                        );
                    }
                }

                // Disconnect websocket
                webSocketManager.disconnect(server.user_id);

                // Remove from local storage
                await removeServer(server.server_url, server.user_id);

                // Clear caches
                setServerStatuses((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(server.user_id);
                    return newMap;
                });

                setServerRetries((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(server.user_id);
                    saveCachedRetries(newMap);
                    return newMap;
                });

                // Clear from localStorage caches
                try {
                    const serverCache = localStorage.getItem(
                        SERVER_STATUS_CACHE_KEY,
                    );
                    if (serverCache) {
                        const parsed = JSON.parse(serverCache);
                        delete parsed[server.user_id];
                        localStorage.setItem(
                            SERVER_STATUS_CACHE_KEY,
                            JSON.stringify(parsed),
                        );
                    }
                } catch (error) {
                    console.warn("Failed to clear server cache:", error);
                }

                if (!online) {
                    toast.success(
                        "Server removed locally (server was offline)",
                    );
                }
            } catch (error) {
                console.error("Failed to leave server:", error);
                toast.error("Failed to leave server");
            } finally {
                setLeavingServers((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(server.user_id);
                    return newSet;
                });
            }
        },
        [confirm, saveCachedRetries],
    );

    // Handle importing identities
    const handleImportIdentities = useCallback(
        async (identities: UserIdentity[]) => {
            try {
                // Check for existing servers
                const existingServers =
                    await findExistingServersForIdentities(identities);
                const newIdentities = await getNewIdentities(identities);

                if (newIdentities.length === 0 && existingServers.size === 0) {
                    toast.error("No new identities to import");
                    return;
                }

                // Store pending identities and show confirmation dialog
                setPendingIdentities({
                    new: newIdentities,
                    existing: existingServers,
                });
                setImportConfirmationOpen(true);

                if (existingServers.size > 0) {
                    toast.info(
                        `${existingServers.size} identit${existingServers.size === 1 ? "y" : "ies"} already exist${existingServers.size === 1 ? "s" : ""}`,
                    );
                }
            } catch (error) {
                console.error("Failed to process imported identities:", error);
                toast.error("Failed to process imported identities");
            }
        },
        [],
    );

    // Handle confirming identity import with server assignments
    const handleConfirmImport = useCallback(
        async (serverAssignments: Map<string, string>) => {
            const { new: newIdentities } = pendingIdentities;
            let successCount = 0;
            let errorCount = 0;

            for (const identity of newIdentities) {
                const serverUrl = serverAssignments.get(identity.user_id);
                if (!serverUrl) continue;

                try {
                    // Try to get server info for metadata
                    let serverMetadata;
                    try {
                        const serverInfo = await getServerInfo(serverUrl);
                        serverMetadata = {
                            name: serverInfo.name,
                            description: serverInfo.description,
                            icon: serverInfo.icon,
                            allowInvite: serverInfo.allow_invite,
                            maxUsers: serverInfo.max_users,
                        };
                    } catch (infoError) {
                        console.warn(
                            `Could not fetch server info for ${serverUrl}:`,
                            infoError,
                        );
                        // Continue without metadata
                    }

                    // Create server record and save it
                    await restoreIdentityToServer(
                        identity,
                        serverUrl,
                        serverMetadata,
                    );

                    successCount++;
                } catch (error) {
                    console.error(
                        `Failed to restore identity ${identity.user_id}:`,
                        error,
                    );

                    // If joining fails, still save the identity locally for manual connection later
                    try {
                        await restoreIdentityToServer(identity, serverUrl);
                        toast.warning(
                            `Identity saved but couldn't connect to server: ${serverUrl}`,
                        );
                        successCount++;
                    } catch (saveError) {
                        console.error(
                            `Failed to save identity ${identity.user_id}:`,
                            saveError,
                        );
                        errorCount++;
                    }
                }
            }

            // Reset pending identities
            setPendingIdentities({ new: [], existing: new Map() });

            // Show results
            if (successCount > 0) {
                toast.success(
                    `Successfully imported ${successCount} identit${successCount === 1 ? "y" : "ies"}`,
                );
            }
            if (errorCount > 0) {
                toast.error(
                    `Failed to import ${errorCount} identit${errorCount === 1 ? "y" : "ies"}`,
                );
            }

            // Close confirmation dialog
            setImportConfirmationOpen(false);
        },
        [pendingIdentities],
    );

    // Manual retry function
    const handleRetryServer = useCallback(
        async (server: ServerRecord) => {
            const status = await fetchServerMetadata(server);
            setServerStatuses((prev) =>
                new Map(prev).set(server.user_id, status),
            );
            updateRetryInfo(server.user_id, status.online);

            const displayName =
                status?.metadata?.name ||
                server.server_name ||
                server.server_url;
            if (status.online) {
                toast.success(`${displayName} is back online!`);
            } else {
                toast.error(`${displayName} is still offline`);
            }
        },
        [fetchServerMetadata, updateRetryInfo],
    );

    // Setup retry interval
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const serversToRetry = servers.filter((server) => {
                const retryInfo = serverRetries.get(server.user_id);
                const status = serverStatuses.get(server.user_id);
                return (
                    retryInfo &&
                    retryInfo.nextRetry <= now &&
                    retryInfo.retryCount <= MAX_RETRY_COUNT &&
                    !status?.online
                );
            });

            if (serversToRetry.length > 0) {
                console.log(
                    `Retrying ${serversToRetry.length} offline servers`,
                );
                verifyServers(serversToRetry);
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [servers, serverRetries, serverStatuses, verifyServers]);

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
                    <p className="text-muted-foreground mt-2">
                        Loading servers...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">My Servers</h1>
                        <p className="text-muted-foreground mt-1">
                            {servers.length === 0
                                ? "No servers joined yet. Join your first server to get started!"
                                : `Connected to ${servers.length} server${
                                      servers.length === 1 ? "" : "s"
                                  }`}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setImportDialogOpen(true)}
                        >
                            <FileUp className="mr-2 h-4 w-4" />
                            Import Identities
                        </Button>
                        {servers.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={() => setExportAllDialogOpen(true)}
                            >
                                <FileDown className="mr-2 h-4 w-4" />
                                Export All
                            </Button>
                        )}
                        <JoinServerDialog>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Join Server
                            </Button>
                        </JoinServerDialog>
                    </div>
                </div>
            </div>

            {servers.length === 0 ? (
                <div className="flex h-64 items-center justify-center">
                    <Card className="max-w-md text-center">
                        <CardContent className="pt-6">
                            <ServerIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                            <h3 className="mb-2 text-lg font-semibold">
                                No servers yet
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                Join your first server to start chatting with
                                others, or import existing identities.
                            </p>
                            <div className="flex justify-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setImportDialogOpen(true)}
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import Identities
                                </Button>
                                <JoinServerDialog>
                                    <Button>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Join Server
                                    </Button>
                                </JoinServerDialog>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {servers.map((server) => {
                        const online = isServerOnline(server);
                        const displayName = getServerDisplayName(server);
                        const description = getServerDescription(server);
                        const status = serverStatuses.get(server.user_id);
                        const retryInfo = serverRetries.get(server.user_id);
                        const serverIcon = status?.metadata?.icon;
                        const isLeaving = leavingServers.has(server.user_id);
                        const retryTimeString = getRetryTimeString(server);

                        return (
                            <Card
                                key={server.user_id}
                                className={`ease-snappy transition-all ${
                                    !isServerAccessible(server)
                                        ? "cursor-not-allowed opacity-60"
                                        : "hover:bg-muted cursor-pointer"
                                } ${isLeaving ? "pointer-events-none opacity-50" : ""}`}
                                onClick={() => {
                                    const accessible =
                                        isServerAccessible(server);
                                    if (accessible) {
                                        navigate({
                                            to: `/servers/${server.user_id}`,
                                        });
                                    }
                                }}
                            >
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`relative ${!isServerAccessible(server) ? "" : "cursor-pointer"}`}
                                            onClick={() => {
                                                if (
                                                    isServerAccessible(server)
                                                ) {
                                                    navigate({
                                                        to: `/servers/${server.user_id}`,
                                                    });
                                                }
                                            }}
                                        >
                                            {serverIcon ? (
                                                <img
                                                    src={serverIcon}
                                                    alt={`${displayName} icon`}
                                                    className="h-10 w-10 rounded-lg object-cover"
                                                    onError={(e) => {
                                                        const target =
                                                            e.target as HTMLImageElement;
                                                        target.style.display =
                                                            "none";
                                                        target.nextElementSibling?.classList.remove(
                                                            "hidden",
                                                        );
                                                    }}
                                                />
                                            ) : null}
                                            <ServerIcon
                                                className={`h-10 w-10 ${serverIcon ? "hidden" : ""}`}
                                            />
                                            <div
                                                className={`border-background absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 ${
                                                    isServerAccessible(server)
                                                        ? "bg-green-500"
                                                        : "bg-red-500"
                                                }`}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <CardTitle className="truncate text-lg">
                                                {displayName}
                                            </CardTitle>
                                            <div className="mt-1 flex items-center gap-2">
                                                <Badge
                                                    variant={
                                                        isServerAccessible(
                                                            server,
                                                        )
                                                            ? "default"
                                                            : retryInfo
                                                              ? "outline"
                                                              : "secondary"
                                                    }
                                                >
                                                    {isServerAccessible(server)
                                                        ? "Connected"
                                                        : retryInfo
                                                          ? "Retrying"
                                                          : online
                                                            ? "Connecting..."
                                                            : "Offline"}
                                                </Badge>
                                                {status?.metadata && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs"
                                                    >
                                                        <Users className="mr-1 h-3 w-3" />
                                                        {status.metadata
                                                            .current_users || 0}
                                                        /
                                                        {
                                                            status.metadata
                                                                .max_users
                                                        }
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="hover:border-primary h-8 w-8 p-0 hover:border-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleExportIdentity(
                                                        server,
                                                    );
                                                }}
                                                title="Export Identity"
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            {!online && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRetryServer(
                                                            server,
                                                        );
                                                    }}
                                                    title="Retry Connection"
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive h-8 w-8 border-1 p-0"
                                                onClick={(
                                                    e: React.MouseEvent,
                                                ) => {
                                                    e.stopPropagation();
                                                    handleLeaveServer(server);
                                                }}
                                                title="Leave Server"
                                            >
                                                <LogOut className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="line-clamp-2">
                                        {description}
                                    </CardDescription>
                                    <div className="text-muted-foreground mt-3 text-xs">
                                        <p>
                                            Joined:{" "}
                                            {new Date(
                                                server.joined_at,
                                            ).toLocaleDateString()}
                                        </p>
                                        {retryTimeString && (
                                            <p className="text-yellow-600 dark:text-yellow-400">
                                                {retryTimeString}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Export Identity Dialog */}
            {selectedServerForExport && (
                <ExportIdentityDialog
                    open={exportDialogOpen}
                    onOpenChange={setExportDialogOpen}
                    serverUrl={selectedServerForExport.serverUrl}
                    userId={selectedServerForExport.userId}
                />
            )}

            {/* Export All Identities Dialog */}
            <ExportAllIdentitiesDialog
                open={exportAllDialogOpen}
                onOpenChange={setExportAllDialogOpen}
            />

            {/* Import Identities Dialog */}
            <ImportIdentityDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onIdentitiesImported={handleImportIdentities}
            />

            {/* Import Confirmation Dialog */}
            <ImportConfirmationDialog
                open={importConfirmationOpen}
                onOpenChange={setImportConfirmationOpen}
                newIdentities={pendingIdentities.new}
                existingServers={pendingIdentities.existing}
                onConfirm={handleConfirmImport}
            />
        </div>
    );
}
