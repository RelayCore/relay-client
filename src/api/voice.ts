import { ServerRecord } from "@/storage/server-store";
import { getSetting, SettingsInterface } from "@/utils/settings";
import { WebSocketMessage } from "@/websocket/websocket-manager";

// Types
export interface VoiceParticipant {
    id: number;
    user_id: string;
    username: string;
    nickname: string;
    is_muted: boolean;
    is_deafened: boolean;
    is_speaking: boolean;
    joined_at: string;
}

export interface VoiceRoom {
    id: number;
    channel_id: number;
    channel_name: string;
    is_active: boolean;
    participants: VoiceParticipant[];
    created_at: string;
}

export interface VoiceJoinResponse {
    status: string;
    message: string;
}

export type VoiceEvent =
    | "user_joined_voice"
    | "user_left_voice"
    | "voice_state_update"
    | "speaking_update"
    | "connection_error"
    | "audio_error"
    | "permissions_error";

export interface VoiceEventData {
    user_joined_voice: {
        user_id: string;
        channel_id: number;
        participant: VoiceParticipant;
    };
    user_left_voice: {
        user_id: string;
        channel_id: number;
    };
    voice_state_update: {
        user_id: string;
        channel_id: number;
        is_muted: boolean;
        is_deafened: boolean;
    };
    speaking_update: {
        user_id: string;
        channel_id: number;
        is_speaking: boolean;
    };
    connection_error: { error: string };
    audio_error: { error: string };
    permissions_error: { error: string };
}

// HTTP API Client
export class VoiceAPI {
    constructor(private server: ServerRecord) {}

    private get headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.server.user_id}`,
        };
    }

    async joinChannel(channelId: number): Promise<VoiceJoinResponse> {
        const response = await fetch(`${this.server.server_url}/voice/join`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ channel_id: channelId }),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to join voice channel: ${await response.text()}`,
            );
        }

        return response.json();
    }

    async leaveChannel(channelId: number): Promise<void> {
        const response = await fetch(`${this.server.server_url}/voice/leave`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ channel_id: channelId }),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to leave voice channel: ${await response.text()}`,
            );
        }
    }

    async updateState(
        channelId: number,
        isMuted: boolean,
        isDeafened: boolean,
    ): Promise<void> {
        const response = await fetch(`${this.server.server_url}/voice/state`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
                channel_id: channelId,
                is_muted: isMuted,
                is_deafened: isDeafened,
            }),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to update voice state: ${await response.text()}`,
            );
        }
    }

    async getParticipants(channelId: number): Promise<VoiceParticipant[]> {
        const response = await fetch(
            `${this.server.server_url}/voice/participants?channel_id=${channelId}`,
            { headers: this.headers },
        );

        if (!response.ok) {
            throw new Error(
                `Failed to get participants: ${await response.text()}`,
            );
        }

        const data = await response.json();
        return data.participants || [];
    }
}

// WebRTC Audio Manager
export class VoiceAudioManager {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStreams = new Map<string, MediaStream>();
    private audioElements = new Map<string, HTMLAudioElement>();
    private userVolumes = new Map<string, number>();

    private isMuted = false;
    private isDeafened = false;
    private pushToTalkMode = false;
    private isPushToTalkActive = false;
    private voiceActivationThreshold = -30;
    private isVoiceActivated = false;
    private inputVolume = 1.0;
    private outputVolume = 1.0;
    private pushToTalkKey = "Space";

    private analyser: AnalyserNode | null = null;
    private audioContext: AudioContext | null = null;
    private microphoneSource: MediaStreamAudioSourceNode | null = null;
    private gainNode: GainNode | null = null;

    private onSpeakingChange?: (isSpeaking: boolean) => void;
    private keyEventHandlers: {
        keydown: (e: KeyboardEvent) => void;
        keyup: (e: KeyboardEvent) => void;
    } | null = null;

    private speakingCheckInterval: NodeJS.Timeout | null = null;
    private speakingStopTimeout: NodeJS.Timeout | null = null;
    private lastSentSpeakingState = false;
    private speakingStopDelay = 500;

    constructor() {
        this.loadSettings();
        this.loadUserVolumes();
    }

    private loadSettings(): void {
        this.pushToTalkMode = getSetting("pushToTalkMode") as boolean;
        this.voiceActivationThreshold = Math.max(
            -60,
            Math.min(
                0,
                parseInt(getSetting("voiceActivationThreshold") as string),
            ),
        );
        this.inputVolume = parseInt(getSetting("inputVolume") as string) / 100;
        this.outputVolume =
            parseInt(getSetting("outputVolume") as string) / 100;
        this.pushToTalkKey = getSetting("pushToTalkKey") as string;
    }

    private loadUserVolumes(): void {
        try {
            const saved = localStorage.getItem("voice_user_volumes");
            if (saved) {
                const volumes = JSON.parse(saved);
                this.userVolumes = new Map(Object.entries(volumes));
            }
        } catch (error) {
            console.warn("Failed to load user volumes:", error);
        }
    }

    private saveUserVolumes(): void {
        try {
            const volumes = Object.fromEntries(this.userVolumes);
            localStorage.setItem("voice_user_volumes", JSON.stringify(volumes));
        } catch (error) {
            console.warn("Failed to save user volumes:", error);
        }
    }

    async createPeerConnection(
        config: RTCConfiguration,
    ): Promise<RTCPeerConnection> {
        if (this.peerConnection) {
            this.peerConnection.close();
        }

        this.peerConnection = new RTCPeerConnection(config);

        // Handle remote streams
        this.peerConnection.ontrack = (event) => {
            console.log("Received remote track:", event.track.kind);
            const [remoteStream] = event.streams;
            if (remoteStream && event.track.kind === "audio") {
                this.handleRemoteStream(remoteStream);
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log(
                "WebRTC connection state:",
                this.peerConnection?.connectionState,
            );
        };

        return this.peerConnection;
    }

    private handleRemoteStream(stream: MediaStream): void {
        if (this.isDeafened) return;

        // Create audio element for playback
        const audio = document.createElement("audio");
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = this.outputVolume;
        document.body.appendChild(audio);

        // Store for cleanup
        const streamId = stream.id;
        this.audioElements.set(streamId, audio);
        this.remoteStreams.set(streamId, stream);

        // Apply user volume if available
        const userVolume = this.getUserVolume(streamId);
        audio.volume = this.outputVolume * userVolume;
    }

    async requestPermissions(): Promise<MediaStream> {
        try {
            const inputDeviceId = getSetting("inputDevice") as string;
            const constraints: MediaStreamConstraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    ...(inputDeviceId !== "default" && {
                        deviceId: inputDeviceId,
                    }),
                },
            };

            this.localStream =
                await navigator.mediaDevices.getUserMedia(constraints);
            await this.setupAudioAnalysis();
            this.setupPushToTalkListeners();
            return this.localStream;
        } catch (error) {
            throw new Error(`Failed to get microphone access: ${error}`);
        }
    }

    private async setupAudioAnalysis(): Promise<void> {
        if (!this.localStream) return;

        this.audioContext = new AudioContext();
        this.microphoneSource = this.audioContext.createMediaStreamSource(
            this.localStream,
        );
        this.analyser = this.audioContext.createAnalyser();
        this.gainNode = this.audioContext.createGain();

        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.3;
        this.gainNode.gain.value = this.inputVolume;

        this.microphoneSource.connect(this.gainNode);
        this.gainNode.connect(this.analyser);

        // Start monitoring speaking status
        this.startSpeakingDetection();
    }

    private startSpeakingDetection(): void {
        if (this.speakingCheckInterval) {
            clearInterval(this.speakingCheckInterval);
        }

        this.speakingCheckInterval = setInterval(() => {
            const volume = this.getAudioLevel();
            const shouldTransmit = this.pushToTalkMode
                ? this.isPushToTalkActive
                : volume > this.voiceActivationThreshold;

            if (shouldTransmit !== this.isVoiceActivated) {
                this.isVoiceActivated = shouldTransmit;
                this.handleSpeakingStateChange(shouldTransmit);
            }
        }, 100); // Check every 100ms
    }

    private handleSpeakingStateChange(isSpeaking: boolean): void {
        if (isSpeaking) {
            // Started speaking
            if (this.speakingStopTimeout) {
                clearTimeout(this.speakingStopTimeout);
                this.speakingStopTimeout = null;
            }

            if (!this.lastSentSpeakingState) {
                this.lastSentSpeakingState = true;
                this.onSpeakingChange?.(true);
            }
        } else {
            // Stopped speaking - delay the notification
            if (this.lastSentSpeakingState && !this.speakingStopTimeout) {
                this.speakingStopTimeout = setTimeout(() => {
                    this.lastSentSpeakingState = false;
                    this.onSpeakingChange?.(false);
                    this.speakingStopTimeout = null;
                }, this.speakingStopDelay);
            }
        }
    }

    private getAudioLevel(): number {
        if (!this.analyser) return -100;

        const bufferLength = this.analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }

        const rms = Math.sqrt(sum / bufferLength);
        if (rms < 0.0001) return -100;
        return 20 * Math.log10(rms);
    }

    addTrackToPeerConnection(): void {
        if (!this.peerConnection || !this.localStream) return;

        this.localStream.getTracks().forEach((track) => {
            this.peerConnection!.addTrack(track, this.localStream!);
        });
    }

    updateSettings(settings: Partial<SettingsInterface>): void {
        if (settings.pushToTalkMode !== undefined) {
            this.pushToTalkMode = settings.pushToTalkMode;
            if (!this.pushToTalkMode) {
                this.isPushToTalkActive = false;
            }
        }

        if (settings.voiceActivationThreshold !== undefined) {
            this.voiceActivationThreshold = Math.max(
                -60,
                Math.min(
                    0,
                    parseInt(settings.voiceActivationThreshold as string),
                ),
            );
        }

        if (settings.inputVolume !== undefined) {
            this.inputVolume = parseInt(settings.inputVolume as string) / 100;
            this.updateInputVolume();
        }

        if (settings.outputVolume !== undefined) {
            this.outputVolume = parseInt(settings.outputVolume as string) / 100;
            this.updateOutputVolume();
        }

        if (settings.pushToTalkKey !== undefined) {
            this.pushToTalkKey = settings.pushToTalkKey as string;
            this.setupPushToTalkListeners();
        }
    }

    private updateInputVolume(): void {
        if (this.gainNode) {
            this.gainNode.gain.value = this.inputVolume;
        }
    }

    private updateOutputVolume(): void {
        this.audioElements.forEach((audio, userId) => {
            const userVolume = this.getUserVolume(userId);
            audio.volume = this.outputVolume * userVolume;
        });
    }

    setUserVolume(userId: string, volume: number): void {
        // Clamp volume between 0 and 2 (0% to 200%)
        const clampedVolume = Math.max(0, Math.min(2, volume));
        this.userVolumes.set(userId, clampedVolume);

        // Apply to existing audio element if it exists
        const audio = this.audioElements.get(userId);
        if (audio) {
            audio.volume = this.outputVolume * clampedVolume;
        }

        this.saveUserVolumes();
    }

    getUserVolume(userId: string): number {
        return this.userVolumes.get(userId) ?? 1.0;
    }

    resetUserVolume(userId: string): void {
        this.userVolumes.delete(userId);

        // Apply default volume to audio element
        const audio = this.audioElements.get(userId);
        if (audio) {
            audio.volume = this.outputVolume;
        }

        this.saveUserVolumes();
    }

    getAllUserVolumes(): Map<string, number> {
        return new Map(this.userVolumes);
    }

    private setupPushToTalkListeners(): void {
        // Remove existing listeners
        if (this.keyEventHandlers) {
            window.removeEventListener(
                "keydown",
                this.keyEventHandlers.keydown,
            );
            window.removeEventListener("keyup", this.keyEventHandlers.keyup);
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                this.pushToTalkMode &&
                this.matchesShortcut(event, this.pushToTalkKey) &&
                !this.isPushToTalkActive
            ) {
                event.preventDefault();
                this.isPushToTalkActive = true;
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (
                this.pushToTalkMode &&
                this.matchesShortcut(event, this.pushToTalkKey) &&
                this.isPushToTalkActive
            ) {
                event.preventDefault();
                this.isPushToTalkActive = false;
            }
        };

        this.keyEventHandlers = { keydown: handleKeyDown, keyup: handleKeyUp };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
    }

    private matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
        const parts = shortcut.split("+");
        const key = parts[parts.length - 1];
        const modifiers = parts.slice(0, -1);

        // Check modifiers
        const hasCtrl = modifiers.includes("Ctrl")
            ? event.ctrlKey
            : !event.ctrlKey;
        const hasShift = modifiers.includes("Shift")
            ? event.shiftKey
            : !event.shiftKey;
        const hasAlt = modifiers.includes("Alt") ? event.altKey : !event.altKey;

        if (!hasCtrl || !hasShift || !hasAlt) return false;

        // Check key
        if (key === "Space") {
            return event.code === "Space" || event.key === " ";
        }

        return event.key.toUpperCase() === key.toUpperCase();
    }

    setMuted(muted: boolean): void {
        this.isMuted = muted;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach((track) => {
                track.enabled = !muted;
            });
        }
    }

    setDeafened(deafened: boolean): void {
        this.isDeafened = deafened;
        this.audioElements.forEach((audio) => {
            audio.muted = deafened;
        });

        if (deafened) {
            this.setMuted(true);
        }
    }

    setPushToTalkMode(enabled: boolean): void {
        this.pushToTalkMode = enabled;
        if (!enabled) {
            this.isPushToTalkActive = false;
        }
    }

    cleanup(): void {
        if (this.speakingCheckInterval) {
            clearInterval(this.speakingCheckInterval);
            this.speakingCheckInterval = null;
        }

        if (this.speakingStopTimeout) {
            clearTimeout(this.speakingStopTimeout);
            this.speakingStopTimeout = null;
        }

        // Remove event listeners
        if (this.keyEventHandlers) {
            window.removeEventListener(
                "keydown",
                this.keyEventHandlers.keydown,
            );
            window.removeEventListener("keyup", this.keyEventHandlers.keyup);
            this.keyEventHandlers = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
        }

        // Clean up audio elements
        this.audioElements.forEach((audio) => audio.remove());
        this.audioElements.clear();
        this.remoteStreams.clear();
    }

    onSpeaking(callback: (isSpeaking: boolean) => void): void {
        this.onSpeakingChange = callback;
    }

    get muted(): boolean {
        return this.isMuted;
    }
    get deafened(): boolean {
        return this.isDeafened;
    }
    get speaking(): boolean {
        return this.isVoiceActivated;
    }
    get peerConnectionInstance(): RTCPeerConnection | null {
        return this.peerConnection;
    }
}

// Main Voice Client - Updated for WebRTC
export class VoiceClient {
    private api: VoiceAPI;
    private audioManager: VoiceAudioManager;

    private currentChannelId: number | null = null;
    private participants = new Map<string, VoiceParticipant>();
    private eventListeners = new Map<
        VoiceEvent,
        Set<(data: VoiceEventData[VoiceEvent]) => void>
    >();
    private sendSignalingMessage?: (message: WebSocketMessage) => void;

    constructor(private server: ServerRecord) {
        this.api = new VoiceAPI(server);
        this.audioManager = new VoiceAudioManager();
        this.setupEventHandlers();
    }

    setSignalingMessageSender(
        sender: (message: WebSocketMessage) => void,
    ): void {
        this.sendSignalingMessage = sender;
    }

    private setupEventHandlers(): void {
        this.audioManager.onSpeaking((isSpeaking) => {
            if (this.currentChannelId && this.sendSignalingMessage) {
                this.sendSignalingMessage({
                    type: "speaking_update",
                    data: {
                        channel_id: this.currentChannelId,
                        is_speaking: isSpeaking,
                    },
                });
            }
        });
    }

    async joinChannel(channelId: number): Promise<void> {
        if (this.currentChannelId) {
            await this.leaveChannel();
        }

        try {
            await this.audioManager.requestPermissions();
            await this.api.joinChannel(channelId);
            this.currentChannelId = channelId;

            // Load initial participants
            const participants = await this.api.getParticipants(channelId);
            participants.forEach((p) => this.participants.set(p.user_id, p));
        } catch (error) {
            this.cleanup();
            throw error;
        }
    }

    async leaveChannel(): Promise<void> {
        if (!this.currentChannelId) return;

        const channelToLeave = this.currentChannelId;

        try {
            await this.api.leaveChannel(channelToLeave);
            console.log(`Successfully left voice channel ${channelToLeave}`);
        } catch (error) {
            console.error("Failed to leave voice channel via API:", error);
            // Continue with cleanup even if API call fails
        } finally {
            this.cleanup();
        }
    }

    async setMuted(muted: boolean): Promise<void> {
        if (!this.currentChannelId) return;

        this.audioManager.setMuted(muted);
        await this.api.updateState(
            this.currentChannelId,
            muted,
            this.audioManager.deafened,
        );
    }

    async setDeafened(deafened: boolean): Promise<void> {
        if (!this.currentChannelId) return;

        this.audioManager.setDeafened(deafened);
        const muted = deafened || this.audioManager.muted;
        await this.api.updateState(this.currentChannelId, muted, deafened);
    }

    setPushToTalkMode(enabled: boolean): void {
        this.audioManager.setPushToTalkMode(enabled);
    }

    setUserVolume(userId: string, volume: number): void {
        this.audioManager.setUserVolume(userId, volume);
    }

    getUserVolume(userId: string): number {
        return this.audioManager.getUserVolume(userId);
    }

    resetUserVolume(userId: string): void {
        this.audioManager.resetUserVolume(userId);
    }

    getAllUserVolumes(): Map<string, number> {
        return this.audioManager.getAllUserVolumes();
    }

    updateSettings(settings: Partial<SettingsInterface>): void {
        this.audioManager.updateSettings(settings);
    }

    // WebRTC Signaling Handlers
    handleWebRTCConfig(data: {
        channel_id: number;
        config: RTCConfiguration;
    }): void {
        console.log("Received WebRTC config:", data);
        // Config is handled when creating offer
    }

    async handleCreateOffer(data: { channel_id: number }): Promise<void> {
        console.log("Creating WebRTC offer for channel:", data.channel_id);

        try {
            const config: RTCConfiguration = {
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            };

            const pc = await this.audioManager.createPeerConnection(config);
            this.audioManager.addTrackToPeerConnection();

            // Set up ICE candidate handling
            pc.onicecandidate = (event) => {
                if (event.candidate && this.sendSignalingMessage) {
                    this.sendSignalingMessage({
                        type: "ice-candidate",
                        data: {
                            channel_id: data.channel_id,
                            candidate: event.candidate.candidate,
                            sdpMid: event.candidate.sdpMid,
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                        },
                    });
                }
            };

            // Create and send offer
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
            });

            await pc.setLocalDescription(offer);

            if (this.sendSignalingMessage) {
                this.sendSignalingMessage({
                    type: "offer",
                    data: {
                        channel_id: data.channel_id,
                        sdp: offer.sdp,
                        type: offer.type,
                    },
                });
            }
        } catch (error) {
            console.error("Failed to create WebRTC offer:", error);
            this.emit("connection_error", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async handleWebRTCAnswer(data: {
        from: string;
        channel_id: number;
        answer: { type: string; sdp: string };
    }): Promise<void> {
        console.log("Received WebRTC answer:", data);

        const pc = this.audioManager.peerConnectionInstance;
        if (!pc) {
            console.error("No peer connection available for answer");
            return;
        }

        try {
            const answer = new RTCSessionDescription({
                type: "answer",
                sdp: data.answer.sdp,
            });

            await pc.setRemoteDescription(answer);
        } catch (error) {
            console.error("Failed to handle WebRTC answer:", error);
            this.emit("connection_error", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async handleWebRTCIceCandidate(data: {
        from: string;
        candidate: {
            candidate: string;
            sdpMid: string | null;
            sdpMLineIndex: number | null;
        };
    }): Promise<void> {
        console.log("Received ICE candidate:", data);

        const pc = this.audioManager.peerConnectionInstance;
        if (!pc) {
            console.error("No peer connection available for ICE candidate");
            return;
        }

        try {
            const candidate = new RTCIceCandidate({
                candidate: data.candidate.candidate,
                sdpMid: data.candidate.sdpMid,
                sdpMLineIndex: data.candidate.sdpMLineIndex,
            });

            await pc.addIceCandidate(candidate);
        } catch (error) {
            console.error("Failed to add ICE candidate:", error);
        }
    }

    handleConnectionStatus(data: {
        channel_id: number;
        connected: boolean;
        state?: string;
    }): void {
        console.log("WebRTC connection status:", data);

        if (this.sendSignalingMessage) {
            this.sendSignalingMessage({
                type: "webrtc_connection_status",
                data: {
                    channel_id: data.channel_id,
                    connected: data.connected,
                },
            });
        }
    }

    handleConnectionQuality(data: {
        channel_id: number;
        quality: string;
    }): void {
        console.log("Connection quality update:", data);
        // Handle connection quality updates from server
    }

    // WebSocket event handlers - called by the main WebSocket manager
    handleUserJoinedVoice(data: VoiceEventData["user_joined_voice"]): void {
        this.participants.set(data.user_id, data.participant);
        this.emit("user_joined_voice", data);
    }

    handleUserLeftVoice(data: VoiceEventData["user_left_voice"]): void {
        this.participants.delete(data.user_id);
        this.emit("user_left_voice", data);
    }

    handleVoiceStateUpdate(data: VoiceEventData["voice_state_update"]): void {
        const participant = this.participants.get(data.user_id);
        if (participant) {
            participant.is_muted = data.is_muted;
            participant.is_deafened = data.is_deafened;
        }
        this.emit("voice_state_update", data);
    }

    handleSpeakingUpdate(data: VoiceEventData["speaking_update"]): void {
        const participant = this.participants.get(data.user_id);
        if (participant) {
            participant.is_speaking = data.is_speaking;
        }
        this.emit("speaking_update", data);
    }

    private cleanup(): void {
        console.log("Cleaning up voice client...");
        this.currentChannelId = null;
        this.participants.clear();
        this.audioManager.cleanup();
    }

    disconnect(): void {
        this.cleanup();
    }

    // Event system
    on<T extends VoiceEvent>(
        event: T,
        callback: (data: VoiceEventData[T]) => void,
    ): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners
            .get(event)!
            .add(callback as (data: VoiceEventData[VoiceEvent]) => void);
    }

    off<T extends VoiceEvent>(
        event: T,
        callback: (data: VoiceEventData[T]) => void,
    ): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(
                callback as (data: VoiceEventData[VoiceEvent]) => void,
            );
        }
    }

    private emit<T extends VoiceEvent>(
        event: T,
        data: VoiceEventData[T],
    ): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach((callback) => callback(data));
        }
    }
    // Getters
    get currentChannel(): number | null {
        return this.currentChannelId;
    }
    get channelParticipants(): VoiceParticipant[] {
        return Array.from(this.participants.values());
    }
    get muted(): boolean {
        return this.audioManager.muted;
    }
    get deafened(): boolean {
        return this.audioManager.deafened;
    }
    get speaking(): boolean {
        return this.audioManager.speaking;
    }
    get connected(): boolean {
        return this.currentChannelId !== null;
    }
}
