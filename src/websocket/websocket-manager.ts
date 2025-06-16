import { ServerRecord } from "@/storage/server-store";
import { VoiceClient, VoiceEventData } from "@/api/voice";
import { toast } from "sonner";
import { inDevelopment } from "@/config";
import { Attachment } from "@/api/server";

export interface WebSocketMessage {
    type: string;
    data: unknown;
}

export interface MessageBroadcast {
    id: number;
    channel_id: number;
    author_id: string;
    content: string;
    created_at: string;
    username?: string;
    nickname?: string;
}

export interface OnlineUsersData {
    online_users: string[];
    user_count: number;
}

export interface UserStatusData {
    user_id: string;
    status: string; // "online" or "offline"
}

export interface MessageDeletedBroadcast {
    message_id: number;
    channel_id: number;
    deleted_by: string;
}

export interface MessageEditedBroadcast {
    id: number;
    channel_id: number;
    author_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    username?: string;
    nickname?: string;
    attachments?: Attachment[];
    pinned: boolean;
}

export const MESSAGE_TYPES = {
    ONLINE_USERS: "online_users",
    USER_STATUS: "user_status",
    MESSAGE_BROADCAST: "new_message",
    MESSAGE_DELETED: "message_deleted",
    MESSAGE_EDITED: "message_edited",
    USER_JOINED_VOICE: "user_joined_voice",
    USER_LEFT_VOICE: "user_left_voice",
    VOICE_STATE_UPDATE: "voice_state_update",
    SPEAKING_UPDATE: "speaking_update",
    WEBRTC_CONFIG: "webrtc_config",
    CREATE_WEBRTC_OFFER: "create_webrtc_offer",
    WEBRTC_ANSWER: "webrtc_answer",
    WEBRTC_ICE_CANDIDATE: "webrtc_ice_candidate",
    WEBRTC_CONNECTION_STATUS: "webrtc_connection_status",
    CONNECTION_QUALITY_UPDATE: "connection_quality_update",
} as const;

type MessageHandler = (message: WebSocketMessage) => void;

export class WebSocketConnection {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private maxReconnectDelay = 30000;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private isIntentionallyClosed = false;
    private messageHandlers = new Set<MessageHandler>();
    private voiceClient: VoiceClient;
    private connectionState: "disconnected" | "connecting" | "connected" =
        "disconnected";
    private lastPingTime = 0;
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(
        private server: ServerRecord,
        private onConnectionChange?: (connected: boolean) => void,
    ) {
        this.voiceClient = new VoiceClient(server);
        this.voiceClient.setSignalingMessageSender(
            (message: WebSocketMessage) => this.send(message),
        );
    }

    async connect(): Promise<void> {
        if (
            this.connectionState === "connected" ||
            this.connectionState === "connecting"
        ) {
            return;
        }

        this.connectionState = "connecting";

        // Clear any existing connection
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        return new Promise((resolve, reject) => {
            try {
                this.isIntentionallyClosed = false;
                const wsUrl = this.server.server_url
                    .replace(/^https?:\/\//, "ws://")
                    .replace(/^http:\/\//, "ws://");
                const url = `${wsUrl}/ws?user_id=${encodeURIComponent(this.server.user_id)}`;

                console.log(`[WebSocket] Connecting to: ${url}`);
                this.ws = new WebSocket(url);

                // Set connection timeout
                const connectionTimeout = setTimeout(() => {
                    if (this.connectionState === "connecting") {
                        this.ws?.close();
                        reject(new Error("Connection timeout"));
                    }
                }, 10000);

                this.ws.onopen = () => {
                    clearTimeout(connectionTimeout);
                    console.log(
                        `[WebSocket] Connected to ${this.server.server_name}`,
                    );
                    this.connectionState = "connected";
                    this.reconnectAttempts = 0;
                    this.reconnectDelay = 1000;
                    this.startPingMonitoring();
                    this.onConnectionChange?.(true);

                    // Emit connection change event
                    window.dispatchEvent(
                        new CustomEvent("websocket-connection-changed", {
                            detail: {
                                userId: this.server.user_id,
                                connected: true,
                            },
                        }),
                    );

                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.lastPingTime = Date.now();

                    try {
                        if (typeof event.data === "string") {
                            const message: WebSocketMessage = JSON.parse(
                                event.data,
                            );
                            console.log(
                                `[WebSocket] Message received:`,
                                message,
                            );
                            this.handleMessage(message);
                        }
                        // Remove binary message handling
                    } catch (error) {
                        console.error(
                            `[WebSocket] Failed to parse message:`,
                            error,
                        );
                    }
                };

                this.ws.onclose = (event) => {
                    clearTimeout(connectionTimeout);
                    console.log(
                        `[WebSocket] Disconnected:`,
                        event.code,
                        event.reason,
                    );
                    this.connectionState = "disconnected";
                    this.stopPingMonitoring();
                    this.onConnectionChange?.(false);

                    // Emit connection change event
                    window.dispatchEvent(
                        new CustomEvent("websocket-connection-changed", {
                            detail: {
                                userId: this.server.user_id,
                                connected: false,
                            },
                        }),
                    );

                    if (
                        !this.isIntentionallyClosed &&
                        this.reconnectAttempts < this.maxReconnectAttempts
                    ) {
                        this.scheduleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    console.error(`[WebSocket] Error:`, error);
                    this.connectionState = "disconnected";
                    reject(error);
                };
            } catch (error) {
                this.connectionState = "disconnected";
                reject(error);
            }
        });
    }

    private startPingMonitoring() {
        this.lastPingTime = Date.now();
        this.pingInterval = setInterval(() => {
            const timeSinceLastPing = Date.now() - this.lastPingTime;
            if (timeSinceLastPing > 70000) {
                // 70 seconds without any message
                console.warn(
                    "[WebSocket] Connection appears dead, forcing reconnect",
                );
                this.ws?.close();
            }
        }, 30000);
    }

    private stopPingMonitoring() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay,
        );

        console.log(
            `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`,
        );

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch((error) => {
                console.error(`[WebSocket] Reconnection failed:`, error);
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error(
                        `[WebSocket] Max reconnection attempts reached`,
                    );
                }
            });
        }, delay);
    }

    private handleMessage(message: WebSocketMessage) {
        // Show a toast for every websocket event in development mode
        if (inDevelopment) {
            toast.info(`[WebSocket] Event: ${message.type}`, {
                description:
                    typeof message.data === "object"
                        ? JSON.stringify(message.data)
                        : String(message.data),
            });
        }

        // First, let all registered handlers process the message
        this.messageHandlers.forEach((handler) => {
            try {
                handler(message);
            } catch (error) {
                console.error(`[WebSocket] Handler error:`, error);
            }
        });

        // Then, handle voice-specific messages
        this.handleVoiceMessage(message);
    }

    private handleVoiceMessage(message: WebSocketMessage) {
        switch (message.type) {
            case MESSAGE_TYPES.USER_JOINED_VOICE:
                this.voiceClient.handleUserJoinedVoice(
                    message.data as VoiceEventData["user_joined_voice"],
                );
                break;
            case MESSAGE_TYPES.USER_LEFT_VOICE:
                this.voiceClient.handleUserLeftVoice(
                    message.data as VoiceEventData["user_left_voice"],
                );
                break;
            case MESSAGE_TYPES.VOICE_STATE_UPDATE:
                this.voiceClient.handleVoiceStateUpdate(
                    message.data as VoiceEventData["voice_state_update"],
                );
                break;
            case MESSAGE_TYPES.SPEAKING_UPDATE:
                this.voiceClient.handleSpeakingUpdate(
                    message.data as VoiceEventData["speaking_update"],
                );
                break;
            case MESSAGE_TYPES.WEBRTC_CONFIG:
                this.voiceClient.handleWebRTCConfig(
                    message.data as {
                        channel_id: number;
                        config: RTCConfiguration;
                    },
                );
                break;
            case MESSAGE_TYPES.CREATE_WEBRTC_OFFER:
                this.voiceClient.handleCreateOffer(
                    message.data as { channel_id: number },
                );
                break;
            case MESSAGE_TYPES.WEBRTC_ANSWER:
                this.voiceClient.handleWebRTCAnswer(
                    message.data as {
                        from: string;
                        channel_id: number;
                        answer: { type: string; sdp: string };
                    },
                );
                break;
            case MESSAGE_TYPES.WEBRTC_ICE_CANDIDATE:
                this.voiceClient.handleWebRTCIceCandidate(
                    message.data as {
                        from: string;
                        candidate: {
                            candidate: string;
                            sdpMid: string | null;
                            sdpMLineIndex: number | null;
                        };
                    },
                );
                break;
            case MESSAGE_TYPES.WEBRTC_CONNECTION_STATUS:
                this.voiceClient.handleConnectionStatus(
                    message.data as {
                        channel_id: number;
                        connected: boolean;
                        state?: string;
                    },
                );
                break;
            case MESSAGE_TYPES.CONNECTION_QUALITY_UPDATE:
                this.voiceClient.handleConnectionQuality(
                    message.data as { channel_id: number; quality: string },
                );
                break;
        }
    }

    addMessageHandler(handler: MessageHandler) {
        this.messageHandlers.add(handler);
    }

    removeMessageHandler(handler: MessageHandler) {
        this.messageHandlers.delete(handler);
    }

    send(message: WebSocketMessage) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn(`[WebSocket] Cannot send message - not connected`);
        }
    }

    disconnect() {
        this.isIntentionallyClosed = true;
        this.connectionState = "disconnected";
        this.stopPingMonitoring();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Emit connection change event
        window.dispatchEvent(
            new CustomEvent("websocket-connection-changed", {
                detail: { userId: this.server.user_id, connected: false },
            }),
        );
    }

    get isConnected(): boolean {
        return (
            this.connectionState === "connected" &&
            this.ws?.readyState === WebSocket.OPEN
        );
    }

    get voice(): VoiceClient {
        return this.voiceClient;
    }
}

export class WebSocketManager {
    private connections = new Map<string, WebSocketConnection>();

    async addServer(server: ServerRecord): Promise<void> {
        const existingConnection = this.connections.get(server.user_id);
        if (existingConnection) {
            return;
        }

        const connection = new WebSocketConnection(server, (connected) =>
            console.log(
                `[WebSocketManager] ${server.user_id} connection changed: ${connected}`,
            ),
        );

        this.connections.set(server.user_id, connection);

        try {
            await connection.connect();
            console.log(
                `[WebSocketManager] Successfully connected ${server.user_id}`,
            );
        } catch (error) {
            console.error(
                `[WebSocketManager] Failed to connect ${server.user_id}:`,
                error,
            );
            this.connections.delete(server.user_id);
            throw error;
        }
    }

    removeServer(userId: string) {
        const connection = this.connections.get(userId);
        if (connection) {
            connection.disconnect();
            this.connections.delete(userId);
            console.log(`[WebSocketManager] Removed server for ${userId}`);
        }
    }

    addMessageHandler(userId: string, handler: MessageHandler) {
        const connection = this.connections.get(userId);
        if (connection) {
            connection.addMessageHandler(handler);
            console.log(
                `[WebSocketManager] Added message handler for ${userId}`,
            );
        } else {
            console.warn(
                `[WebSocketManager] No connection found for ${userId}`,
            );
        }
    }

    removeMessageHandler(userId: string, handler: MessageHandler) {
        const connection = this.connections.get(userId);
        if (connection) {
            connection.removeMessageHandler(handler);
            console.log(
                `[WebSocketManager] Removed message handler for ${userId}`,
            );
        }
    }

    // Voice methods
    async joinVoiceChannel(userId: string, channelId: number): Promise<void> {
        const connection = this.connections.get(userId);
        if (connection?.voice) {
            await connection.voice.joinChannel(channelId);
        } else {
            throw new Error(`No voice client found for ${userId}`);
        }
    }

    async leaveVoiceChannel(userId: string): Promise<void> {
        const connection = this.connections.get(userId);
        if (connection?.voice) {
            await connection.voice.leaveChannel();
        } else {
            throw new Error(`No voice client found for ${userId}`);
        }
    }

    async setMuted(userId: string, muted: boolean): Promise<void> {
        const connection = this.connections.get(userId);
        if (connection?.voice) {
            await connection.voice.setMuted(muted);
        }
    }

    async setDeafened(userId: string, deafened: boolean): Promise<void> {
        const connection = this.connections.get(userId);
        if (connection?.voice) {
            await connection.voice.setDeafened(deafened);
        }
    }

    getVoiceClient(userId: string): VoiceClient | null {
        const connection = this.connections.get(userId);
        return connection?.voice || null;
    }

    getConnection(userId: string): WebSocketConnection | undefined {
        return this.connections.get(userId);
    }

    isConnected(userId: string): boolean {
        const connection = this.connections.get(userId);
        return connection?.isConnected || false;
    }

    disconnectAll() {
        this.connections.forEach((connection) => connection.disconnect());
        this.connections.clear();
        console.log(`[WebSocketManager] Disconnected all connections`);
    }

    get allConnections() {
        return Array.from(this.connections.values());
    }
}

export const webSocketManager = new WebSocketManager();
