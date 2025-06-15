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
import { ServerIcon, Plus, Users } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { loadServers, ServerRecord } from "@/storage/server-store";
import { JoinServerDialog } from "@/components/server/join-server-dialog";

interface ServerMetadata {
    name: string;
    description: string;
    allow_invite: boolean;
    current_users: number;
    max_users: number;
    max_file_size: number;
    max_attachments: number;
    icon?: string;
}

interface ServerStatus {
    online: boolean;
    metadata?: ServerMetadata;
    lastChecked: number;
}

// Cache key for server status
const SERVER_STATUS_CACHE_KEY = "server-status-cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function HomePage() {
    const [servers, setServers] = useState<ServerRecord[]>([]);
    const [serverStatuses, setServerStatuses] = useState<
        Map<string, ServerStatus>
    >(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

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

    // Fetch server metadata
    const fetchServerMetadata = useCallback(
        async (server: ServerRecord): Promise<ServerStatus> => {
            try {
                const response = await fetch(`${server.server_url}/server`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000), // 10 second timeout
                });

                if (response.ok) {
                    const metadata: ServerMetadata = await response.json();
                    return {
                        online: true,
                        metadata,
                        lastChecked: Date.now(),
                    };
                } else {
                    return {
                        online: false,
                        lastChecked: Date.now(),
                    };
                }
            } catch {
                return {
                    online: false,
                    lastChecked: Date.now(),
                };
            }
        },
        [],
    );

    // Verify all servers
    const verifyServers = useCallback(
        async (serverList: ServerRecord[]) => {
            const cachedStatuses = loadCachedStatuses();
            const newStatuses = new Map(cachedStatuses);
            const promises: Promise<void>[] = [];

            for (const server of serverList) {
                // Check if we have valid cached data
                const cached = cachedStatuses.get(server.user_id);
                if (
                    cached &&
                    Date.now() - cached.lastChecked < CACHE_DURATION
                ) {
                    continue; // Skip if cache is still valid
                }

                // Fetch fresh data
                const promise = fetchServerMetadata(server).then((status) => {
                    newStatuses.set(server.user_id, status);
                });
                promises.push(promise);
            }

            // Wait for all requests to complete
            await Promise.allSettled(promises);

            // Update state and cache
            setServerStatuses(newStatuses);
            saveCachedStatuses(newStatuses);
        },
        [loadCachedStatuses, saveCachedStatuses, fetchServerMetadata],
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

        window.addEventListener("servers-updated", handleServersUpdated);
        return () => {
            window.removeEventListener("servers-updated", handleServersUpdated);
        };
    }, [loadCachedStatuses, verifyServers]);

    // Helper function to get server display name
    const getServerDisplayName = useCallback(
        (server: ServerRecord) => {
            const status = serverStatuses.get(server.user_id);
            if (status?.metadata?.name) {
                return status.metadata.name;
            }
            return server.server_name || server.server_url;
        },
        [serverStatuses],
    );

    // Helper function to get server description
    const getServerDescription = useCallback(
        (server: ServerRecord) => {
            const status = serverStatuses.get(server.user_id);
            if (status?.metadata?.description) {
                return status.metadata.description;
            }
            return server.server_description || "No description available";
        },
        [serverStatuses],
    );

    // Helper function to check if server is online
    const isServerOnline = useCallback(
        (server: ServerRecord) => {
            const status = serverStatuses.get(server.user_id);
            return status?.online ?? true; // Default to true if unknown
        },
        [serverStatuses],
    );

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
                                others.
                            </p>
                            <JoinServerDialog>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Join Server
                                </Button>
                            </JoinServerDialog>
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
                        const serverIcon = status?.metadata?.icon;

                        return (
                            <Card
                                key={server.user_id}
                                className={`hover:bg-muted ease-snappy cursor-pointer gap-0 transition-all ${
                                    !online ? "opacity-60" : ""
                                }`}
                                onClick={() =>
                                    online &&
                                    navigate({
                                        to: `/servers/${server.user_id}`,
                                    })
                                }
                            >
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
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
                                                className={`h-10 w-10 ${
                                                    serverIcon ? "hidden" : ""
                                                }`}
                                            />
                                            <div
                                                className={`border-background absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 ${
                                                    online
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
                                                        online
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                >
                                                    {online
                                                        ? "Online"
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
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
