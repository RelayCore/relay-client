import { ServerRecord } from "@/storage/server-store";
import { getSetting, SettingsInterface } from "@/utils/settings";
import { WebSocketMessage } from "@/websocket/websocket-manager";
import { VoiceParticipant } from "./server";
import { apiRequest } from "./server";

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
    constructor(
        private serverUrl: string,
        private userId: string,
    ) {}

    async joinChannel(channelId: number): Promise<VoiceJoinResponse> {
        return apiRequest<VoiceJoinResponse>(
            this.serverUrl,
            "/voice/join",
            this.userId,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channel_id: channelId }),
            },
        );
    }

    async leaveChannel(channelId: number): Promise<void> {
        await apiRequest<void>(this.serverUrl, "/voice/leave", this.userId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel_id: channelId }),
        });
    }

    async updateState(
        channelId: number,
        isMuted: boolean,
        isDeafened: boolean,
    ): Promise<void> {
        await apiRequest<void>(this.serverUrl, "/voice/state", this.userId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                channel_id: channelId,
                is_muted: isMuted,
                is_deafened: isDeafened,
            }),
        });
    }

    async getParticipants(channelId: number): Promise<VoiceParticipant[]> {
        const endpoint = `/voice/participants?channel_id=${channelId}`;
        const data = await apiRequest<{ participants: VoiceParticipant[] }>(
            this.serverUrl,
            endpoint,
            this.userId,
        );
        return data.participants || [];
    }
}

// WebRTC Audio Manager
export class VoiceAudioManager {
    private peerConnection: RTCPeerConnection | null = null;
    private rawMicStream: MediaStream | null = null;
    private outgoingStream: MediaStream | null = null;
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

    private speakingStopTimeout: NodeJS.Timeout | null = null;
    private streamDisableTimeout: NodeJS.Timeout | null = null;
    private lastSentSpeakingState = false;
    private speakingStopDelay = 500;
    private streamDisableDelay = 300;
    private lastTrackEnabledState = false;

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

        this.peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            if (remoteStream && event.track.kind === "audio") {
                this.handleRemoteStream(remoteStream);
            }
        };

        return this.peerConnection;
    }

    private handleRemoteStream(stream: MediaStream): void {
        if (this.isDeafened) return;

        const audio = document.createElement("audio");
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = this.outputVolume;
        document.body.appendChild(audio);

        const streamId = stream.id;
        this.audioElements.set(streamId, audio);
        this.remoteStreams.set(streamId, stream);

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

            this.rawMicStream =
                await navigator.mediaDevices.getUserMedia(constraints);

            this.outgoingStream = new MediaStream(
                this.rawMicStream
                    .getAudioTracks()
                    .map((track) => track.clone()),
            );

            this.setOutgoingStreamEnabled(false);
            this.lastTrackEnabledState = false;

            setTimeout(async () => {
                if (this.rawMicStream) {
                    await this.setupAudioAnalysis();
                }
            }, 1000);

            this.setupPushToTalkListeners();
            return this.rawMicStream;
        } catch (error) {
            throw new Error(`Failed to get microphone access: ${error}`);
        }
    }

    private async setupAudioAnalysis(): Promise<void> {
        if (!this.rawMicStream || this.audioContext) return;

        this.audioContext = new AudioContext();

        this.microphoneSource = this.audioContext.createMediaStreamSource(
            this.rawMicStream,
        );
        this.analyser = this.audioContext.createAnalyser();
        this.gainNode = this.audioContext.createGain();

        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.3;
        this.gainNode.gain.value = Math.max(this.inputVolume, 1.0);

        this.microphoneSource.connect(this.gainNode);
        this.gainNode.connect(this.analyser);

        this.startSpeakingDetection();
    }

    private startSpeakingDetection(): void {
        const checkSpeaking = () => {
            if (!this.analyser) return;

            const volume = this.getAudioLevel();
            const shouldTransmit = this.pushToTalkMode
                ? this.isPushToTalkActive
                : volume > this.voiceActivationThreshold;

            const shouldEnable =
                shouldTransmit && !this.isMuted && !this.isDeafened;

            this.setOutgoingStreamEnabledWithDelay(shouldEnable);

            if (shouldTransmit !== this.isVoiceActivated) {
                this.isVoiceActivated = shouldTransmit;
                this.handleSpeakingStateChange(shouldTransmit);
            }

            if (this.analyser) {
                requestAnimationFrame(checkSpeaking);
            }
        };

        requestAnimationFrame(checkSpeaking);
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

        if (rms < 0.001) return -100;

        return 20 * Math.log10(rms);
    }

    private setOutgoingStreamEnabled(enabled: boolean): void {
        if (this.outgoingStream) {
            this.outgoingStream.getAudioTracks().forEach((track) => {
                track.enabled = enabled;
            });
        }
    }

    private setOutgoingStreamEnabledWithDelay(enabled: boolean): void {
        if (enabled) {
            if (this.streamDisableTimeout) {
                clearTimeout(this.streamDisableTimeout);
                this.streamDisableTimeout = null;
            }

            if (!this.lastTrackEnabledState) {
                this.setOutgoingStreamEnabled(true);
                this.lastTrackEnabledState = true;
            }
        } else {
            if (this.lastTrackEnabledState && !this.streamDisableTimeout) {
                this.streamDisableTimeout = setTimeout(() => {
                    this.setOutgoingStreamEnabled(false);
                    this.lastTrackEnabledState = false;
                    this.streamDisableTimeout = null;
                }, this.streamDisableDelay);
            }
        }
    }

    private handleSpeakingStateChange(isSpeaking: boolean): void {
        if (isSpeaking) {
            if (this.speakingStopTimeout) {
                clearTimeout(this.speakingStopTimeout);
                this.speakingStopTimeout = null;
            }

            if (!this.lastSentSpeakingState) {
                this.lastSentSpeakingState = true;
                this.onSpeakingChange?.(true);
            }
        } else {
            if (this.lastSentSpeakingState && !this.speakingStopTimeout) {
                this.speakingStopTimeout = setTimeout(() => {
                    this.lastSentSpeakingState = false;
                    this.onSpeakingChange?.(false);
                    this.speakingStopTimeout = null;
                }, this.speakingStopDelay);
            }
        }
    }

    addTrackToPeerConnection(): void {
        if (!this.peerConnection || !this.outgoingStream) return;

        this.outgoingStream.getTracks().forEach((track) => {
            this.peerConnection!.addTrack(track, this.outgoingStream!);
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
            this.gainNode.gain.value = Math.max(this.inputVolume, 1.0);
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
        if (this.rawMicStream) {
            this.rawMicStream.getAudioTracks().forEach((track) => {
                track.enabled = !muted;
            });
        }
        const shouldEnable =
            !muted && !this.isDeafened && this.isVoiceActivated;

        if (this.streamDisableTimeout) {
            clearTimeout(this.streamDisableTimeout);
            this.streamDisableTimeout = null;
        }

        this.setOutgoingStreamEnabled(shouldEnable);
        this.lastTrackEnabledState = shouldEnable;
    }

    setDeafened(deafened: boolean): void {
        this.isDeafened = deafened;
        this.audioElements.forEach((audio) => {
            audio.muted = deafened;
        });

        if (deafened) {
            this.setMuted(true);
        } else {
            this.setMuted(this.isMuted);
        }
    }

    cleanup(): void {
        if (this.analyser) {
            this.analyser = null;
        }

        if (this.speakingStopTimeout) {
            clearTimeout(this.speakingStopTimeout);
            this.speakingStopTimeout = null;
        }

        if (this.streamDisableTimeout) {
            clearTimeout(this.streamDisableTimeout);
            this.streamDisableTimeout = null;
        }

        if (this.keyEventHandlers) {
            window.removeEventListener(
                "keydown",
                this.keyEventHandlers.keydown,
            );
            window.removeEventListener("keyup", this.keyEventHandlers.keyup);
            this.keyEventHandlers = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.rawMicStream) {
            this.rawMicStream.getTracks().forEach((track) => track.stop());
            this.rawMicStream = null;
        }

        if (this.outgoingStream) {
            this.outgoingStream.getTracks().forEach((track) => track.stop());
            this.outgoingStream = null;
        }

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
    public audioManager: VoiceAudioManager;

    private currentChannelId: number | null = null;
    private participants = new Map<string, VoiceParticipant>();
    private eventListeners = new Map<
        VoiceEvent,
        Set<(data: VoiceEventData[VoiceEvent]) => void>
    >();
    private sendSignalingMessage?: (message: WebSocketMessage) => void;

    constructor(private server: ServerRecord) {
        this.api = new VoiceAPI(server.server_url, server.user_id);
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
        } catch (error) {
            console.error("Failed to leave voice channel via API:", error);
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

    // WebRTC Signaling Handlers
    handleWebRTCConfig(data: {
        channel_id: number;
        config: RTCConfiguration;
    }): void {
        // Config is handled when creating offer
    }

    async handleCreateOffer(data: { channel_id: number }): Promise<void> {
        try {
            const config: RTCConfiguration = {
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            };

            const pc = await this.audioManager.createPeerConnection(config);
            this.audioManager.addTrackToPeerConnection();

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
