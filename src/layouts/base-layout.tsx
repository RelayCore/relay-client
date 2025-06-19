import React from "react";
import DragWindowRegion from "@/components/drag-window-region";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    useSidebar,
} from "@/components/ui/sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { HomeIcon, ServerIcon, SettingsIcon, Plus } from "lucide-react";
import {
    useNavigate,
    useParams,
    useRouter,
    useRouterState,
} from "@tanstack/react-router";
import { SelectionProvider, useSelection } from "@/contexts/selection-context";
// @ts-expect-error - Ignoring ESM/CommonJS module warning
import { useSelectionContainer, Box } from "@air/react-drag-to-select";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/contexts/confirm-context";
import { DevContextMenu } from "@/components/dev/dev-context-menu";
import { platform } from "@/platform";
import { loadServers, ServerRecord, saveServers } from "@/storage/server-store";
import { ServerProvider } from "@/contexts/server-context";
import { webSocketManager } from "@/websocket/websocket-manager";
import { JoinServerDialog } from "@/components/server/join-server-dialog";
import { getServerInfo, ServerInfo } from "@/api/server";
// @ts-expect-error - Ignoring ESM/CommonJS module warning
import { DndProvider, useDrag, useDrop } from "react-dnd";
// @ts-expect-error - Ignoring ESM/CommonJS module warning
import { HTML5Backend } from "react-dnd-html5-backend";
import { logInfo, logWarning, logError } from "@/utils/logger";

interface ServerStatus {
    online: boolean;
    metadata?: ServerInfo;
    lastChecked: number;
}

// Cache key for server status
const SERVER_STATUS_CACHE_KEY = "server-status-cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const MainElementContext =
    React.createContext<React.RefObject<HTMLElement | null> | null>(null);
export function useMainElement() {
    const context = React.useContext(MainElementContext);
    if (!context) {
        throw new Error("useMainElement must be used within a BaseLayout");
    }
    return context;
}

function removeTextSelection() {
    if (window.getSelection) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
    }
}

interface DragItem {
    type: string;
    index: number;
    serverId: string;
}

interface DraggableServerItemProps {
    server: ServerRecord;
    index: number;
    moveServer: (dragIndex: number, hoverIndex: number) => void;
    isServerAccessible: (server: ServerRecord) => boolean;
    getServerDisplayName: (server: ServerRecord) => string;
    serverStatuses: Map<string, ServerStatus>;
    router: ReturnType<typeof useRouter>;
    navigate: ReturnType<typeof useNavigate>;
}

function DraggableServerItem({
    server,
    index,
    moveServer,
    isServerAccessible,
    getServerDisplayName,
    serverStatuses,
    router,
    navigate,
}: DraggableServerItemProps) {
    const ref = React.useRef<HTMLLIElement>(null);

    const [{ handlerId }, drop] = useDrop<
        DragItem,
        void,
        { handlerId: unknown }
    >({
        accept: "server",
        collect: (monitor) => ({
            handlerId: monitor.getHandlerId(),
        }),
        hover(item, monitor) {
            if (!ref.current) {
                return;
            }
            const dragIndex = item.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) {
                return;
            }

            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY =
                (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
                return;
            }

            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
                return;
            }

            moveServer(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag, preview] = useDrag({
        type: "server",
        item: () => {
            return { serverId: server.user_id, index };
        },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const accessible = isServerAccessible(server);
    const displayName = getServerDisplayName(server);
    const status = serverStatuses.get(server.user_id);
    const serverIcon = status?.metadata?.icon;

    preview(drop(ref));

    return (
        <SidebarMenuItem
            ref={ref}
            data-handler-id={handlerId}
            className={isDragging ? "opacity-50" : ""}
        >
            <div
                ref={(node) => {
                    drag(node);
                }}
            >
                <SidebarMenuButton
                    tooltip={`${displayName}${
                        accessible
                            ? ""
                            : status?.online
                              ? " (Connecting...)"
                              : " (Offline)"
                    }`}
                    onClick={() => {
                        if (accessible) {
                            navigate({
                                to: `/servers/${server.user_id}`,
                            });
                        }
                    }}
                    isActive={
                        router.state.location.pathname ===
                        `/servers/${server.user_id}`
                    }
                    className={`${
                        !accessible
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                    }`}
                    disabled={!accessible}
                >
                    <div className="relative">
                        {serverIcon ? (
                            <img
                                src={serverIcon}
                                alt={`${displayName} icon`}
                                className="h-6 w-6 min-w-6 rounded object-cover"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    target.nextElementSibling?.classList.remove(
                                        "hidden",
                                    );
                                }}
                            />
                        ) : null}
                        <ServerIcon
                            className={`min-w-6 ${serverIcon ? "hidden" : ""}`}
                        />
                        {!accessible && (
                            <div className="bg-destructive absolute -right-1 -bottom-1 h-2 w-2 rounded-full" />
                        )}
                    </div>
                    <span className="truncate">{displayName}</span>
                </SidebarMenuButton>
            </div>
        </SidebarMenuItem>
    );
}

function BaseLayoutContent({
    children,
    mainRef,
}: {
    children: React.ReactNode;
    mainRef: React.RefObject<HTMLElement | null>;
}) {
    const { getState, setIsSelecting } = useSelection();
    const [servers, setServers] = React.useState<ServerRecord[]>([]);
    const [serverStatuses, setServerStatuses] = React.useState<
        Map<string, ServerStatus>
    >(new Map());
    const [connectionStates, setConnectionStates] = React.useState<
        Map<string, boolean>
    >(new Map());

    // Load cached server statuses
    const loadCachedStatuses = React.useCallback(() => {
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
            logError(
                "Failed to load cached server statuses",
                "api",
                String(error),
            );
        }
        return new Map<string, ServerStatus>();
    }, []);

    // Save server statuses to cache
    const saveCachedStatuses = React.useCallback(
        (statuses: Map<string, ServerStatus>) => {
            try {
                const cacheObj = Object.fromEntries(statuses);
                localStorage.setItem(
                    SERVER_STATUS_CACHE_KEY,
                    JSON.stringify(cacheObj),
                );
            } catch (error) {
                logError(
                    "Failed to save server statuses to cache",
                    "api",
                    String(error),
                );
            }
        },
        [],
    );

    // Fetch server metadata
    const fetchServerMetadata = React.useCallback(
        async (server: ServerRecord): Promise<ServerStatus> => {
            try {
                const metadata = await getServerInfo(server.server_url);
                return {
                    online: true,
                    metadata,
                    lastChecked: Date.now(),
                };
            } catch (error) {
                logWarning(
                    `Failed to fetch metadata for ${server.server_name || server.server_url}`,
                    "api",
                    String(error),
                );
                return {
                    online: false,
                    lastChecked: Date.now(),
                };
            }
        },
        [],
    );

    // Verify all servers
    const verifyServers = React.useCallback(
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
                    // Still connect to WebSocket even if cached
                    try {
                        await webSocketManager.addServer(server);
                    } catch (wsError) {
                        logWarning(
                            `Failed to connect to WebSocket for server ${server.server_name || server.server_url}`,
                            "websocket",
                            String(wsError),
                        );
                    }
                    continue; // Skip HTTP check if cache is still valid
                }

                // Fetch fresh data and connect to WebSocket
                const promise = fetchServerMetadata(server).then(
                    async (status) => {
                        newStatuses.set(server.user_id, status);

                        // Connect to WebSocket if server is online
                        if (status.online) {
                            try {
                                await webSocketManager.addServer(server);
                                logInfo(
                                    `Connected to WebSocket for server: ${server.server_name || server.server_url}`,
                                    "websocket",
                                );
                            } catch (wsError) {
                                logWarning(
                                    `Failed to connect to WebSocket for server ${server.server_name || server.server_url}`,
                                    "websocket",
                                    String(wsError),
                                );
                            }
                        }
                    },
                );
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

    React.useEffect(() => {
        const loadServerData = async () => {
            try {
                const serverData = await loadServers();
                setServers(serverData);

                // Verify servers and connect to WebSockets
                verifyServers(serverData);

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
                logError("Failed to load servers", "api", String(error));
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

            // Cleanup all WebSocket connections
            servers.forEach((server) => {
                webSocketManager.removeServer(server.user_id);
            });
        };
    }, [verifyServers]);

    const { DragSelection } = useSelectionContainer({
        eventsElement: document.body,
        onSelectionChange: (box: Box) => {
            const state = getState();
            if (state.onSelectionChange) {
                state.onSelectionChange(box || null);
            }
        },
        shouldStartSelecting: (target: EventTarget) => {
            const state = getState();
            if (!state.enabled) return false;
            const shouldStart = state.shouldStartSelecting
                ? state.shouldStartSelecting(target)
                : false;
            if (shouldStart) {
                removeTextSelection();
            }
            return shouldStart;
        },
        selectionProps: {
            style: {
                border: "2px dashed var(--primary)",
                backgroundColor:
                    "color-mix(in srgb, var(--primary) 10%, transparent)",
                borderRadius: "0.5rem",
                position: "fixed",
                pointerEvents: "none",
                zIndex: 50,
            },
        },
        onSelectionStart: () => {
            setIsSelecting(true);
        },
        onSelectionEnd: () => {
            setTimeout(() => {
                setIsSelecting(false);
            }, 0);
        },
    });

    const router = useRouter();
    const navigate = useNavigate();
    const routerState = useRouterState();
    const [segments, setSegments] = React.useState<string[]>([]);
    const [lastPathname, setLastPathname] = React.useState<string>("/");
    const { state: sidebarState } = useSidebar();
    const isSidebarCollapsed = sidebarState === "collapsed";
    const defaultPath = "home";

    React.useEffect(() => {
        sessionStorage.setItem("lastPathname", lastPathname);
        const pathname = routerState.location.pathname;
        setLastPathname(pathname);
        let segments = pathname.split("/").filter(Boolean);

        if (segments.length === 0) {
            segments = [defaultPath];
        }

        setSegments(segments);
    }, [routerState.location.pathname]);

    const getSegmentDisplayName = (segment: string) => {
        const decodedSegment = decodeURIComponent(segment);

        const matchingServer = servers.find(
            (server) => server.user_id === decodedSegment,
        );
        if (matchingServer) {
            return getServerDisplayName(matchingServer);
        }

        return decodedSegment.charAt(0).toUpperCase() + decodedSegment.slice(1);
    };

    function getSegmentLink(
        segment: string,
        index: number,
        segments: string[],
    ) {
        if (segment === defaultPath) {
            return "/";
        }

        return `/${segments.slice(0, index + 1).join("/")}`;
    }

    // Helper function to get server display name
    const getServerDisplayName = React.useCallback(
        (server: ServerRecord) => {
            const status = serverStatuses.get(server.user_id);
            if (status?.metadata?.name) {
                return status.metadata.name;
            }
            return server.server_name || server.server_url;
        },
        [serverStatuses],
    );

    // Helper function to check if server is accessible (online AND WebSocket connected)
    const isServerAccessible = React.useCallback(
        (server: ServerRecord) => {
            const status = serverStatuses.get(server.user_id);
            const isOnline = status?.online ?? true;
            const isWebSocketConnected =
                connectionStates.get(server.user_id) ?? false;
            return isOnline && isWebSocketConnected;
        },
        [serverStatuses, connectionStates],
    );

    const moveServer = React.useCallback(
        async (dragIndex: number, hoverIndex: number) => {
            const newServers = [...servers];
            const draggedServer = newServers[dragIndex];

            newServers.splice(dragIndex, 1);
            newServers.splice(hoverIndex, 0, draggedServer);

            setServers(newServers);

            // Persist the new order
            try {
                await saveServers(newServers);
                window.dispatchEvent(new CustomEvent("servers-updated"));
            } catch (error) {
                logError("Failed to save server order", "ui", String(error));
                setServers(servers);
            }
        },
        [servers],
    );

    return (
        <div className="flex h-screen flex-col">
            <DragSelection />
            <DragWindowRegion title="App Template">
                <div
                    className={`flex h-full items-center pr-2 transition-all ${isSidebarCollapsed ? "pl-2" : "pl-1"}`}
                >
                    <Breadcrumb>
                        <BreadcrumbList>
                            {segments.map((segment, index) => (
                                <React.Fragment key={index}>
                                    {index != 0 && <BreadcrumbSeparator />}
                                    <BreadcrumbItem>
                                        <BreadcrumbLink
                                            href={getSegmentLink(
                                                segment,
                                                index,
                                                segments,
                                            )}
                                        >
                                            {getSegmentDisplayName(segment)}
                                        </BreadcrumbLink>
                                    </BreadcrumbItem>
                                </React.Fragment>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </DragWindowRegion>
            <div className="bg-sidebar flex flex-1 overflow-hidden">
                <Sidebar collapsible="icon">
                    <SidebarContent>
                        <DndProvider backend={HTML5Backend}>
                            <SidebarMenu className="relative bottom-0.5 p-2">
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        tooltip="Home"
                                        onClick={() => navigate({ to: "/" })}
                                        isActive={
                                            router.state.location.pathname ===
                                            "/"
                                        }
                                    >
                                        <>
                                            <HomeIcon />
                                            <span>Home</span>
                                        </>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                {servers.map((server, index) => (
                                    <DraggableServerItem
                                        key={server.user_id}
                                        server={server}
                                        index={index}
                                        moveServer={moveServer}
                                        isServerAccessible={isServerAccessible}
                                        getServerDisplayName={
                                            getServerDisplayName
                                        }
                                        serverStatuses={serverStatuses}
                                        router={router}
                                        navigate={navigate}
                                    />
                                ))}
                            </SidebarMenu>
                        </DndProvider>
                    </SidebarContent>
                    <SidebarFooter>
                        <SidebarMenuItem>
                            <JoinServerDialog>
                                <SidebarMenuButton tooltip="Join Server">
                                    <Plus />
                                    <span className="truncate">
                                        Join Server
                                    </span>
                                </SidebarMenuButton>
                            </JoinServerDialog>
                        </SidebarMenuItem>

                        <SidebarMenuItem>
                            <SidebarMenuButton
                                tooltip="Settings"
                                onClick={() =>
                                    navigate({
                                        to: `/settings`,
                                    })
                                }
                                isActive={
                                    router.state.location.pathname ===
                                    "/settings"
                                }
                            >
                                <SettingsIcon />
                                <span>Settings</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarFooter>
                </Sidebar>
                <main
                    ref={mainRef}
                    className="bg-background flex-1 overflow-auto overflow-x-hidden border-t md:rounded-tl-xl md:border-l"
                >
                    <div className="h-full">{children}</div>
                    <Toaster />
                </main>
            </div>
        </div>
    );
}

export default function BaseLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId } = useParams({ strict: false });
    const mainRef = React.useRef<HTMLElement>(null);
    const isWeb = platform.isWeb();

    return (
        <MainElementContext.Provider value={mainRef}>
            <SidebarProvider defaultOpen={false}>
                <SelectionProvider>
                    <ConfirmProvider>
                        <ServerProvider userId={userId}>
                            {isWeb ? (
                                <BaseLayoutContent mainRef={mainRef}>
                                    {children}
                                </BaseLayoutContent>
                            ) : (
                                <DevContextMenu>
                                    <BaseLayoutContent mainRef={mainRef}>
                                        {children}
                                    </BaseLayoutContent>
                                </DevContextMenu>
                            )}
                        </ServerProvider>
                    </ConfirmProvider>
                </SelectionProvider>
            </SidebarProvider>
        </MainElementContext.Provider>
    );
}
