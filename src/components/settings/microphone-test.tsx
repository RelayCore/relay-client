import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/utils/tailwind";
import { useSetting } from "@/utils/settings";
import { logError } from "@/utils/logger";

interface MicrophoneTestProps {
    className?: string;
}

export function MicrophoneTest({ className }: MicrophoneTestProps) {
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [audioLevel, setAudioLevel] = useState(-100);
    const [isPlaybackEnabled, setIsPlaybackEnabled] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const voiceActivationThreshold = useSetting(
        "voiceActivationThreshold",
    ) as string;
    const threshold = parseInt(voiceActivationThreshold);

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);

    const cleanup = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }

        if (gainNodeRef.current) {
            gainNodeRef.current.disconnect();
            gainNodeRef.current = null;
        }

        if (analyserRef.current) {
            analyserRef.current.disconnect();
            analyserRef.current = null;
        }

        if (
            audioContextRef.current &&
            audioContextRef.current.state !== "closed"
        ) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);
    const getAudioLevel = useCallback(() => {
        if (!analyserRef.current) {
            return -100;
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }

        const rms = Math.sqrt(sum / bufferLength);
        const dbLevel = 20 * Math.log10(rms / 255);
        return isFinite(dbLevel) ? Math.max(dbLevel, -100) : -100;
    }, []);

    const smoothLevelRef = useRef(-100);

    const updateAudioLevel = useCallback(() => {
        if (!analyserRef.current || !mediaStreamRef.current) {
            return;
        }

        const rawLevel = getAudioLevel();
        const alpha = 0.4;
        smoothLevelRef.current =
            alpha * rawLevel + (1 - alpha) * smoothLevelRef.current;
        setAudioLevel(smoothLevelRef.current);

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }, [getAudioLevel]);

    const startMicrophoneTest = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000,
                },
            });

            mediaStreamRef.current = stream;

            const audioContext = new AudioContext({ sampleRate: 48000 });
            audioContextRef.current = audioContext;

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.1;
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;

            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0;
            gainNodeRef.current = gainNode;

            source.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);

            setIsTestingMic(true);
            updateAudioLevel();
        } catch (err) {
            logError(
                "Failed to start microphone test",
                "electron",
                String(err),
            );
            setError(
                "Failed to access microphone. Please check permissions and try again.",
            );
            cleanup();
        }
    };

    const stopMicrophoneTest = () => {
        setIsTestingMic(false);
        setIsPlaybackEnabled(false);
        setAudioLevel(-100);
        cleanup();
    };

    const togglePlayback = () => {
        if (gainNodeRef.current) {
            const newPlaybackState = !isPlaybackEnabled;
            gainNodeRef.current.gain.value = newPlaybackState ? 0.3 : 0;
            setIsPlaybackEnabled(newPlaybackState);
        }
    };

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    const audioLevelPercent = Math.max(
        0,
        Math.min(100, ((audioLevel + 100) / 100) * 100),
    );

    const thresholdPercent = Math.max(
        0,
        Math.min(100, ((threshold + 100) / 100) * 100),
    );

    const isVoiceActivated = audioLevel > threshold;

    return (
        <Card className={cn("w-full max-w-md", className)}>
            <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Microphone Test</h3>
                    <div className="flex items-center gap-2">
                        {isTestingMic && (
                            <Button
                                size="sm"
                                variant={
                                    isPlaybackEnabled ? "default" : "outline"
                                }
                                onClick={togglePlayback}
                                className="gap-2"
                            >
                                {isPlaybackEnabled ? (
                                    <Volume2 size={16} />
                                ) : (
                                    <VolumeX size={16} />
                                )}
                                {isPlaybackEnabled ? "Disable" : "Enable"}{" "}
                                Playback
                            </Button>
                        )}
                        <Button
                            onClick={
                                isTestingMic
                                    ? stopMicrophoneTest
                                    : startMicrophoneTest
                            }
                            variant={isTestingMic ? "destructive" : "default"}
                            className="gap-2"
                        >
                            {isTestingMic ? (
                                <MicOff size={16} />
                            ) : (
                                <Mic size={16} />
                            )}
                            {isTestingMic ? "Stop Test" : "Start Test"}
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-md bg-red-100 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                {isTestingMic && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    Audio Level
                                </span>
                                <span
                                    className={cn(
                                        "font-mono font-medium",
                                        isVoiceActivated
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-muted-foreground",
                                    )}
                                >
                                    {audioLevel.toFixed(1)} dB
                                    {isVoiceActivated && " (ACTIVE)"}
                                </span>
                            </div>
                            <div className="relative">
                                <Progress
                                    value={audioLevelPercent}
                                    className="h-6"
                                />
                                <div
                                    className={cn(
                                        "absolute top-0 bottom-0 z-10 w-0.5 rounded-full bg-blue-500",
                                        "before:absolute before:-top-1 before:-left-1.5 before:h-3 before:w-3 before:rounded-full before:bg-blue-500 before:content-['']",
                                    )}
                                    style={{ left: `${thresholdPercent}%` }}
                                    title={`Voice Activation Threshold: ${threshold} dB`}
                                />
                            </div>
                            <div className="text-muted-foreground flex justify-between text-xs">
                                <span>-100 dB</span>
                                <span>Threshold: {threshold} dB</span>
                                <span>0 dB</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div
                                    className={cn(
                                        "h-3 w-3 rounded-full",
                                        isVoiceActivated
                                            ? "animate-pulse bg-green-500"
                                            : "bg-gray-300 dark:bg-gray-600",
                                    )}
                                />
                                <span
                                    className={cn(
                                        isVoiceActivated
                                            ? "font-medium text-green-600 dark:text-green-400"
                                            : "text-muted-foreground",
                                    )}
                                >
                                    Voice Detection
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    className={cn(
                                        "h-3 w-3 rounded-full",
                                        isPlaybackEnabled
                                            ? "bg-blue-500"
                                            : "bg-gray-300 dark:bg-gray-600",
                                    )}
                                />
                                <span
                                    className={cn(
                                        isPlaybackEnabled
                                            ? "font-medium text-blue-600 dark:text-blue-400"
                                            : "text-muted-foreground",
                                    )}
                                >
                                    Playback
                                </span>
                            </div>
                        </div>

                        <div className="bg-muted rounded-md p-3 text-sm">
                            <p className="mb-1 font-medium">Instructions:</p>
                            <ul className="text-muted-foreground space-y-1 text-xs">
                                <li>
                                    • Speak into your microphone to see the
                                    audio level
                                </li>
                                <li>
                                    • The blue line shows your voice activation
                                    threshold
                                </li>
                                <li>
                                    • Voice detection activates when audio
                                    exceeds the threshold
                                </li>
                                <li>
                                    • Enable playback to hear your microphone in
                                    real-time
                                </li>
                                <li>
                                    • Adjust the threshold in Voice Detection
                                    settings if needed
                                </li>
                            </ul>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
