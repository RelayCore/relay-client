import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X, Star } from "lucide-react";
import { cn } from "@/utils/tailwind";
import { formatFileSize } from "@/api/server";
import { downloadFile } from "@/utils/assets";

interface ImageModalProps {
    openedImage: {
        id: number;
        file_path: string;
        file_name: string;
        file_size: number;
    } | null;
    sourceImageRect: DOMRect | null;
    starredImages: string[];
    onClose: () => void;
    onStar: (imageUrl: string) => void;
}

export function ImageModal({
    openedImage,
    sourceImageRect,
    starredImages,
    onClose,
    onStar,
}: ImageModalProps) {
    const [visible, setVisible] = React.useState(false);
    const prevImage = React.useRef<typeof openedImage>(null);
    const [zoom, setZoom] = React.useState(1);
    const [pan, setPan] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
    const imageRef = React.useRef<HTMLImageElement>(null);

    React.useEffect(() => {
        if (openedImage) {
            setVisible(true);
            prevImage.current = openedImage;
            setZoom(1);
            setPan({ x: 0, y: 0 });
        }
    }, [openedImage]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!visible) return;

            if (e.key === "Escape") {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                requestAnimationFrame(() => {
                    handleRequestClose();
                });
            } else if (e.key === "0" || e.key === "r") {
                setZoom(1);
                setPan({ x: 0, y: 0 });
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [visible]);

    const handleRequestClose = React.useCallback(() => {
        setVisible(false);
    }, []);

    const handleExited = React.useCallback(() => {
        onClose();
    }, [onClose]);

    const handleWheel = React.useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((prev) => Math.max(0.1, Math.min(5, prev * delta)));
    }, []);

    const handleMouseDown = React.useCallback(
        (e: React.MouseEvent) => {
            if (e.button === 0) {
                e.preventDefault();
                setIsDragging(true);
                setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            }
        },
        [pan],
    );

    const handleMouseMove = React.useCallback(
        (e: React.MouseEvent) => {
            if (isDragging) {
                setPan({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y,
                });
            }
        },
        [isDragging, dragStart],
    );

    const handleMouseUp = React.useCallback(() => {
        setIsDragging(false);
    }, []);

    if (!openedImage && !prevImage.current) return null;
    const image = openedImage || prevImage.current;

    return (
        <AnimatePresence onExitComplete={handleExited}>
            {visible && image && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
                    onClick={handleRequestClose}
                >
                    {/* Controls at the top */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                        className="flex items-center justify-between p-4 text-white"
                    >
                        <div className="max-w-md truncate text-sm">
                            {image.file_name} ({formatFileSize(image.file_size)}
                            ){zoom !== 1 && ` - ${Math.round(zoom * 100)}%`}
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                            <Button
                                size="icon"
                                variant="secondary"
                                className={cn(
                                    "h-8 w-8",
                                    starredImages.includes(image.file_path) &&
                                        "bg-yellow-500 text-yellow-50 hover:bg-yellow-600",
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStar(image.file_path);
                                }}
                                title={
                                    starredImages.includes(image.file_path)
                                        ? "Remove from starred"
                                        : "Add to starred"
                                }
                            >
                                <Star
                                    size={16}
                                    className={
                                        starredImages.includes(image.file_path)
                                            ? "fill-current"
                                            : ""
                                    }
                                />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    downloadFile(
                                        image.file_path,
                                        image.file_name,
                                    );
                                }}
                            >
                                <Download size={16} />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(image.file_path, "_blank");
                                }}
                            >
                                <ExternalLink size={16} />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8"
                                onClick={handleRequestClose}
                            >
                                <X size={16} />
                            </Button>
                        </div>
                    </motion.div>

                    {/* Image container with animation from source */}
                    <div
                        className="flex flex-1 items-center justify-center overflow-hidden p-4"
                        onWheel={handleWheel}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{
                            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                            cursor: isDragging
                                ? "grabbing"
                                : zoom > 1
                                  ? "grab"
                                  : "default",
                        }}
                    >
                        <motion.img
                            ref={imageRef}
                            key={image.id}
                            src={image.file_path}
                            alt={image.file_name}
                            className="max-h-full max-w-full object-contain select-none"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={handleMouseDown}
                            initial={
                                sourceImageRect
                                    ? {
                                          x:
                                              sourceImageRect.left +
                                              sourceImageRect.width / 2 -
                                              window.innerWidth / 2,
                                          y:
                                              sourceImageRect.top +
                                              sourceImageRect.height / 2 -
                                              window.innerHeight / 2,
                                          scale: Math.min(
                                              sourceImageRect.width / 400,
                                              sourceImageRect.height / 400,
                                          ),
                                          opacity: 1,
                                      }
                                    : { scale: 0.8, opacity: 0 }
                            }
                            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                            exit={
                                sourceImageRect
                                    ? {
                                          x:
                                              sourceImageRect.left +
                                              sourceImageRect.width / 2 -
                                              window.innerWidth / 2,
                                          y:
                                              sourceImageRect.top +
                                              sourceImageRect.height / 2 -
                                              window.innerHeight / 2,
                                          scale: Math.min(
                                              sourceImageRect.width / 400,
                                              sourceImageRect.height / 400,
                                          ),
                                          opacity: 1,
                                      }
                                    : { scale: 0.8, opacity: 0 }
                            }
                            transition={{
                                duration: 0.3,
                                ease: [0.4, 0, 0.2, 1],
                            }}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
