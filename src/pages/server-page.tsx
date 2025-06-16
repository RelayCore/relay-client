import React from "react";
import { useParams } from "@tanstack/react-router";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import ChannelList from "@/components/server/channel-list";
import MessageChannel from "@/components/server/message-channel";
import MemberList from "@/components/server/member-list";
import ServerHeader from "@/components/server/server-header";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useServer } from "@/contexts/server-context";

interface PanelSizes {
    channels: number;
    messages: number;
    members: number;
}

export default function ServerPage() {
    const { userId } = useParams({ strict: false });
    const {
        serverRecord,
        serverInfo,
        channelGroups,
        selectedChannelId,
        showMembers,
        loading,
        error,
        setSelectedChannelId,
    } = useServer();

    // Panel size state with localStorage persistence
    const [panelSizes, setPanelSizes] = React.useState(() => {
        const saved = localStorage.getItem("server-panel-sizes");
        return saved
            ? JSON.parse(saved)
            : {
                  channels: 20,
                  messages: showMembers ? 60 : 80,
                  members: 20,
              };
    });

    // Update panel sizes and persist to localStorage
    const handlePanelResize = React.useCallback((sizes: number[]) => {
        const newSizes = {
            channels: sizes[0],
            messages: sizes[1],
            members: sizes[2] || 20,
        };
        setPanelSizes(newSizes);
        localStorage.setItem("server-panel-sizes", JSON.stringify(newSizes));
    }, []);

    // Update message panel size when members panel is toggled
    React.useEffect(() => {
        setPanelSizes((prev: PanelSizes) => ({
            ...prev,
            messages: showMembers
                ? prev.messages
                : prev.channels + prev.messages,
        }));
    }, [showMembers]);

    const handleSelectChannel = React.useCallback(
        (channelId: number) => {
            setSelectedChannelId(channelId);
        },
        [setSelectedChannelId],
    );

    const getSelectedChannelName = React.useCallback(() => {
        if (!selectedChannelId) return "general";

        for (const group of channelGroups) {
            const channel = group.channels.find(
                (c) => c.id === selectedChannelId,
            );
            if (channel) return channel.name;
        }
        return "general";
    }, [selectedChannelId, channelGroups]);

    // Loading state
    if (loading) {
        return (
            <div className="flex h-full flex-col">
                <div className="flex h-12 items-center justify-between border-b px-4" />

                <ResizablePanelGroup
                    direction="horizontal"
                    className="flex-1"
                    onLayout={handlePanelResize}
                >
                    <ResizablePanel
                        defaultSize={panelSizes.channels}
                        minSize={15}
                        maxSize={25}
                        className="bg-sidebar"
                    ></ResizablePanel>

                    <ResizableHandle />

                    <ResizablePanel
                        defaultSize={panelSizes.messages}
                    ></ResizablePanel>
                    {showMembers && (
                        <>
                            <ResizableHandle />
                            <ResizablePanel
                                defaultSize={panelSizes.members}
                                minSize={15}
                                maxSize={25}
                            ></ResizablePanel>
                        </>
                    )}
                </ResizablePanelGroup>
            </div>
        );
    }

    // Error state
    if (error || !serverInfo) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center">
                <AlertTriangle size={48} className="text-destructive mb-4" />
                <h2 className="mb-2 text-xl font-semibold">
                    Failed to load server
                </h2>
                <p className="text-muted-foreground mb-4">
                    {error?.message || "The server could not be loaded"}
                </p>
                <Button onClick={() => window.location.reload()}>
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <ServerHeader
                userId={userId}
                serverUrl={serverRecord?.server_url || ""}
                channelName={getSelectedChannelName()}
            />

            <ResizablePanelGroup
                direction="horizontal"
                className="flex-1"
                onLayout={handlePanelResize}
            >
                {/* Channels sidebar */}
                <ResizablePanel
                    defaultSize={panelSizes.channels}
                    minSize={15}
                    maxSize={25}
                    className="bg-sidebar"
                >
                    <ChannelList onSelectChannel={handleSelectChannel} />
                </ResizablePanel>

                <ResizableHandle />

                {/* Messages */}
                <ResizablePanel defaultSize={panelSizes.messages}>
                    <MessageChannel
                        channelId={selectedChannelId || 0}
                        channelName={getSelectedChannelName()}
                        serverUrl={serverRecord?.server_url || ""}
                        currentUserId={userId}
                    />
                </ResizablePanel>

                {/* Members sidebar */}
                {showMembers && (
                    <>
                        <ResizableHandle />
                        <ResizablePanel
                            defaultSize={panelSizes.members}
                            minSize={15}
                            maxSize={25}
                        >
                            <MemberList currentUserId={userId} />
                        </ResizablePanel>
                    </>
                )}
            </ResizablePanelGroup>
        </div>
    );
}
