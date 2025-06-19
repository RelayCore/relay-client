import React from "react";
import { cn } from "@/utils/tailwind";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    Download,
    ExternalLink,
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize,
} from "lucide-react";
import { Attachment, formatFileSize } from "@/api/server";
import { logError } from "@/utils/logger";

export function CustomVideoPlayer({
    attachment,
    onDownload,
}: {
    attachment: Attachment;
    onDownload: (e: React.MouseEvent) => void;
}) {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const animationFrameIdRef = React.useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolume] = React.useState(1);
    const [isMuted, setIsMuted] = React.useState(false);
    const [showControls, setShowControls] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const hideControlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const fileSize = formatFileSize(attachment.file_size);

    const showControlsTemporarily = React.useCallback(() => {
        setShowControls(true);
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
        }
        hideControlsTimeoutRef.current = setTimeout(() => {
            if (!isFullscreen) {
                setShowControls(false);
            }
        }, 3000);
    }, [isFullscreen]);

    const handlePlayPause = React.useCallback(async () => {
        if (!videoRef.current) return;

        try {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                await videoRef.current.play();
            }
        } catch (error) {
            logError("Error playing video", "electron", String(error));
        }
    }, [isPlaying]);

    const handleTimeUpdate = React.useCallback(() => {
        // Used for discrete updates, e.g., after seeking.
        if (!videoRef.current) return;
        setCurrentTime(videoRef.current.currentTime);
    }, []);

    const handleLoadedMetadata = React.useCallback(() => {
        if (!videoRef.current) return;
        setDuration(videoRef.current.duration);
        setIsLoading(false);
    }, []);

    const handleVolumeChange = React.useCallback((newVolume: number) => {
        if (!videoRef.current) return;
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    }, []);

    const handleMuteToggle = React.useCallback(() => {
        if (!videoRef.current) return;

        if (isMuted) {
            const newVolume = volume > 0 ? volume : 0.5;
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(false);
        } else {
            videoRef.current.volume = 0;
            setIsMuted(true);
        }
    }, [isMuted, volume]);

    const handleSeek = React.useCallback((newTime: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    }, []);

    const handleFullscreen = React.useCallback(async () => {
        if (!containerRef.current) return;

        try {
            if (!isFullscreen) {
                if (containerRef.current.requestFullscreen) {
                    await containerRef.current.requestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
            }
        } catch (error) {
            logError("Fullscreen error", "electron", String(error));
        }
    }, [isFullscreen]);

    const formatTime = React.useCallback((time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }, []);

    // Handle fullscreen changes
    React.useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange,
            );
        };
    }, []);

    // Show controls permanently in fullscreen
    React.useEffect(() => {
        if (isFullscreen) {
            setShowControls(true);
            if (hideControlsTimeoutRef.current) {
                clearTimeout(hideControlsTimeoutRef.current);
            }
        } else {
            showControlsTemporarily();
        }
    }, [isFullscreen, showControlsTemporarily]);

    // Effect for managing video event listeners
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlayEvent = () => {
            setIsPlaying(true);
            setIsLoading(false);
        };
        const handlePauseEvent = () => {
            setIsPlaying(false);
        };
        const handleEndedEvent = () => {
            setIsPlaying(false);
            if (videoRef.current) setCurrentTime(videoRef.current.duration);
        };
        const handleWaitingEvent = () => setIsLoading(true);
        const handlePlayingEvent = () => {
            setIsPlaying(true);
            setIsLoading(false);
        };
        const handleCanPlayEvent = () => {
            setIsLoading(false);
            if (videoRef.current) {
                setDuration(videoRef.current.duration);
            }
        };

        video.addEventListener("play", handlePlayEvent);
        video.addEventListener("pause", handlePauseEvent);
        video.addEventListener("ended", handleEndedEvent);
        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("waiting", handleWaitingEvent);
        video.addEventListener("playing", handlePlayingEvent);
        video.addEventListener("canplay", handleCanPlayEvent);

        return () => {
            video.removeEventListener("play", handlePlayEvent);
            video.removeEventListener("pause", handlePauseEvent);
            video.removeEventListener("ended", handleEndedEvent);
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("waiting", handleWaitingEvent);
            video.removeEventListener("playing", handlePlayingEvent);
            video.removeEventListener("canplay", handleCanPlayEvent);
        };
    }, [handleTimeUpdate, handleLoadedMetadata]);

    // Effect for RAF loop to update currentTime smoothly
    React.useEffect(() => {
        if (isPlaying) {
            const loop = () => {
                if (
                    videoRef.current &&
                    !videoRef.current.paused &&
                    !videoRef.current.ended
                ) {
                    setCurrentTime(videoRef.current.currentTime);
                    animationFrameIdRef.current = requestAnimationFrame(loop);
                } else {
                    // Video stopped or ref lost, ensure loop is cancelled
                    if (animationFrameIdRef.current) {
                        cancelAnimationFrame(animationFrameIdRef.current);
                        animationFrameIdRef.current = null;
                    }
                    // Update final time if video is paused/ended
                    if (videoRef.current) {
                        setCurrentTime(videoRef.current.currentTime);
                    }
                }
            };
            animationFrameIdRef.current = requestAnimationFrame(loop);
        } else {
            // Not playing, ensure loop is stopped
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
            }
            // Update currentTime one last time when pausing or if initially not playing
            if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
            }
        }

        return () => {
            // Cleanup for this effect run
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
            }
        };
    }, [isPlaying]); // Re-run when isPlaying changes

    React.useEffect(() => {
        return () => {
            if (hideControlsTimeoutRef.current) {
                clearTimeout(hideControlsTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={cn(
                "group relative inline-block overflow-hidden rounded-md bg-black",
                isFullscreen && "!fixed !inset-0 !z-50 !rounded-none",
            )}
            onMouseEnter={showControlsTemporarily}
            onMouseMove={showControlsTemporarily}
            onMouseLeave={() => {
                if (!isFullscreen && isPlaying) {
                    if (hideControlsTimeoutRef.current) {
                        clearTimeout(hideControlsTimeoutRef.current);
                    }
                    setShowControls(false);
                } else if (!isFullscreen && !isPlaying) {
                    setShowControls(true);
                }
            }}
        >
            <video
                ref={videoRef}
                src={attachment.file_path}
                className={cn(
                    "border-border object-contain",
                    isFullscreen
                        ? "h-full w-full border-0"
                        : "max-h-[300px] max-w-full rounded-md border",
                )}
                preload="metadata"
                onClick={handlePlayPause}
            >
                Your browser does not support the video tag.
            </video>

            {/* Loading indicator */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
            )}

            {/* Play/Pause overlay when not playing */}
            {!isPlaying && !isLoading && (
                <div
                    className="absolute inset-0 flex cursor-pointer items-center justify-center"
                    onClick={handlePlayPause}
                >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/70 text-white transition-all hover:scale-110 hover:bg-black/80">
                        <Play size={24} />
                    </div>
                </div>
            )}

            {/* Custom controls */}
            <div
                className={cn(
                    "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300",
                    isFullscreen ? "p-6" : "p-3",
                    showControls || !isPlaying || isLoading
                        ? "opacity-100"
                        : "opacity-0",
                )}
            >
                {/* Progress bar */}
                <div className={cn("mb-2", isFullscreen && "mb-4")}>
                    <div
                        className={cn(
                            "relative cursor-pointer rounded-full bg-white/30",
                            isFullscreen ? "h-2" : "h-1",
                        )}
                        onClick={(e) => {
                            const rect =
                                e.currentTarget.getBoundingClientRect();
                            const progress =
                                (e.clientX - rect.left) / rect.width;
                            handleSeek(progress * duration);
                        }}
                    >
                        <div
                            className="absolute top-0 left-0 h-full rounded-full bg-white" // Removed transition-all
                            style={{
                                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                            }}
                        />
                    </div>
                </div>

                {/* Controls row */}
                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "text-white hover:bg-white/20",
                                isFullscreen ? "h-12 w-12" : "h-8 w-8",
                            )}
                            onClick={handlePlayPause}
                        >
                            {isPlaying ? (
                                <Pause size={isFullscreen ? 24 : 16} />
                            ) : (
                                <Play size={isFullscreen ? 24 : 16} />
                            )}
                        </Button>

                        <div className="flex items-center gap-1">
                            <Button
                                size="icon"
                                variant="ghost"
                                className={cn(
                                    "text-white hover:bg-white/20",
                                    isFullscreen ? "h-8 w-8" : "h-6 w-6",
                                )}
                                onClick={handleMuteToggle}
                            >
                                {isMuted ? (
                                    <VolumeX size={isFullscreen ? 18 : 14} />
                                ) : (
                                    <Volume2 size={isFullscreen ? 18 : 14} />
                                )}
                            </Button>
                            <Slider
                                value={[isMuted ? 0 : volume]}
                                onValueChange={(values) =>
                                    handleVolumeChange(values[0])
                                }
                                max={1}
                                step={0.1}
                                className={cn(isFullscreen ? "w-24" : "w-16")}
                            />
                        </div>

                        <span
                            className={cn("text-xs", isFullscreen && "text-sm")}
                        >
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {!isFullscreen && (
                            <span className="max-w-[160px] truncate text-xs">
                                {attachment.file_name} ({fileSize})
                            </span>
                        )}

                        {isFullscreen && (
                            <span className="mr-4 max-w-[50vw] truncate text-sm">
                                {attachment.file_name} ({fileSize})
                            </span>
                        )}

                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "text-white hover:bg-white/20",
                                isFullscreen ? "h-8 w-8" : "h-6 w-6",
                            )}
                            onClick={onDownload}
                        >
                            <Download size={isFullscreen ? 18 : 14} />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "text-white hover:bg-white/20",
                                isFullscreen ? "h-8 w-8" : "h-6 w-6",
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(attachment.file_path, "_blank");
                            }}
                        >
                            <ExternalLink size={isFullscreen ? 18 : 14} />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "text-white hover:bg-white/20",
                                isFullscreen ? "h-8 w-8" : "h-6 w-6",
                            )}
                            onClick={handleFullscreen}
                        >
                            <Maximize size={isFullscreen ? 18 : 14} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
