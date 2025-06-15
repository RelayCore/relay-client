import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Download, X } from "lucide-react";
import { updateAvatarOnAllServers } from "@/api/profile-picture";

interface AvatarCropperProps {
    value: string;
}

interface CropArea {
    x: number;
    y: number;
    size: number;
}

type DragHandle =
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "center"
    | null;

export function AvatarCropper({ value }: AvatarCropperProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [cropArea, setCropArea] = useState<CropArea>({
        x: 50,
        y: 50,
        size: 100,
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragHandle, setDragHandle] = useState<DragHandle>(null);
    const [dragStart, setDragStart] = useState({
        x: 0,
        y: 0,
        cropX: 0,
        cropY: 0,
        cropSize: 0,
    });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const minCropSize = 20;

    const getRelativeMousePosition = useCallback(
        (clientX: number, clientY: number) => {
            if (!imageRef.current) return { x: 0, y: 0 };
            const rect = imageRef.current.getBoundingClientRect();
            return {
                x: clientX - rect.left,
                y: clientY - rect.top,
            };
        },
        [],
    );

    const constrainCropArea = useCallback(
        (requestedCrop: CropArea): CropArea => {
            let { x, y, size } = requestedCrop;

            size = Math.max(minCropSize, size);
            size = Math.min(size, imageSize.width, imageSize.height);

            x = Math.max(0, x);
            y = Math.max(0, y);

            if (x + size > imageSize.width) {
                x = imageSize.width - size;
            }
            if (y + size > imageSize.height) {
                y = imageSize.height - size;
            }
            x = Math.max(0, x); // Re-check after size adjustment
            y = Math.max(0, y); // Re-check after size adjustment

            return { x, y, size };
        },
        [imageSize, minCropSize],
    );

    const handleFileSelect = useCallback((file: File) => {
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageUrl = e.target?.result as string;
                setSelectedImage(imageUrl);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleImageLoad = useCallback(() => {
        if (imageRef.current) {
            const rect = imageRef.current.getBoundingClientRect();
            setImageSize({ width: rect.width, height: rect.height });
            const initialSize = Math.min(rect.width, rect.height) * 0.5;
            setCropArea(
                constrainCropArea({
                    x: (rect.width - initialSize) / 2,
                    y: (rect.height - initialSize) / 2,
                    size: initialSize,
                }),
            );
        }
    }, [constrainCropArea]);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        },
        [handleFileSelect],
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                handleFileSelect(files[0]);
            }
        },
        [handleFileSelect],
    );

    const handleMouseDown = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            if (
                !imageRef.current ||
                imageSize.width === 0 ||
                imageSize.height === 0
            ) {
                return;
            }

            const pos = getRelativeMousePosition(e.clientX, e.clientY);
            const handleSize = 10; // Increased handle clickable area slightly
            const { x: cropX, y: cropY, size: cropSize } = cropArea;

            let clickedHandle: DragHandle = null;

            // Corner handles
            if (
                pos.x >= cropX - handleSize / 2 &&
                pos.x <= cropX + handleSize / 2 &&
                pos.y >= cropY - handleSize / 2 &&
                pos.y <= cropY + handleSize / 2
            )
                clickedHandle = "top-left";
            else if (
                pos.x >= cropX + cropSize - handleSize / 2 &&
                pos.x <= cropX + cropSize + handleSize / 2 &&
                pos.y >= cropY - handleSize / 2 &&
                pos.y <= cropY + handleSize / 2
            )
                clickedHandle = "top-right";
            else if (
                pos.x >= cropX - handleSize / 2 &&
                pos.x <= cropX + handleSize / 2 &&
                pos.y >= cropY + cropSize - handleSize / 2 &&
                pos.y <= cropY + cropSize + handleSize / 2
            )
                clickedHandle = "bottom-left";
            else if (
                pos.x >= cropX + cropSize - handleSize / 2 &&
                pos.x <= cropX + cropSize + handleSize / 2 &&
                pos.y >= cropY + cropSize - handleSize / 2 &&
                pos.y <= cropY + cropSize + handleSize / 2
            )
                clickedHandle = "bottom-right";
            // Edge handles (check if not already a corner)
            else if (
                pos.y >= cropY - handleSize / 2 &&
                pos.y <= cropY + handleSize / 2 &&
                pos.x > cropX + handleSize / 2 &&
                pos.x < cropX + cropSize - handleSize / 2
            )
                clickedHandle = "top";
            else if (
                pos.y >= cropY + cropSize - handleSize / 2 &&
                pos.y <= cropY + cropSize + handleSize / 2 &&
                pos.x > cropX + handleSize / 2 &&
                pos.x < cropX + cropSize - handleSize / 2
            )
                clickedHandle = "bottom";
            else if (
                pos.x >= cropX - handleSize / 2 &&
                pos.x <= cropX + handleSize / 2 &&
                pos.y > cropY + handleSize / 2 &&
                pos.y < cropY + cropSize - handleSize / 2
            )
                clickedHandle = "left";
            else if (
                pos.x >= cropX + cropSize - handleSize / 2 &&
                pos.x <= cropX + cropSize + handleSize / 2 &&
                pos.y > cropY + handleSize / 2 &&
                pos.y < cropY + cropSize - handleSize / 2
            )
                clickedHandle = "right";
            // Center (move)
            else if (
                pos.x > cropX + handleSize / 2 &&
                pos.x < cropX + cropSize - handleSize / 2 &&
                pos.y > cropY + handleSize / 2 &&
                pos.y < cropY + cropSize - handleSize / 2
            )
                clickedHandle = "center";

            if (clickedHandle) {
                setDragStart({
                    x: pos.x,
                    y: pos.y,
                    cropX: cropArea.x,
                    cropY: cropArea.y,
                    cropSize: cropArea.size,
                });
                setDragHandle(clickedHandle);
                setIsDragging(true);
            }
        },
        [cropArea, imageSize, getRelativeMousePosition],
    );

    const performDrag = useCallback(
        (currentMousePos: { x: number; y: number }) => {
            if (!dragHandle) return;

            const deltaX = currentMousePos.x - dragStart.x;
            const deltaY = currentMousePos.y - dragStart.y;
            const newCrop = { ...dragStart };

            switch (dragHandle) {
                case "center":
                    newCrop.cropX = dragStart.cropX + deltaX;
                    newCrop.cropY = dragStart.cropY + deltaY;
                    break;
                // Corner handles
                case "top-left": {
                    const sizeChange = Math.min(deltaX, deltaY);
                    newCrop.cropSize = dragStart.cropSize - sizeChange;
                    newCrop.cropX = dragStart.cropX + sizeChange;
                    newCrop.cropY = dragStart.cropY + sizeChange;
                    break;
                }
                case "top-right": {
                    const sizeChange = Math.min(-deltaX, deltaY);
                    newCrop.cropSize = dragStart.cropSize - sizeChange;
                    newCrop.cropY = dragStart.cropY + sizeChange;
                    // newCrop.cropX remains dragStart.cropX
                    break;
                }
                case "bottom-left": {
                    const sizeChange = Math.min(deltaX, -deltaY);
                    newCrop.cropSize = dragStart.cropSize - sizeChange;
                    newCrop.cropX = dragStart.cropX + sizeChange;
                    // newCrop.cropY remains dragStart.cropY
                    break;
                }
                case "bottom-right": {
                    const sizeChange = Math.min(-deltaX, -deltaY);
                    newCrop.cropSize = dragStart.cropSize - sizeChange;
                    // newCrop.cropX and newCrop.cropY remain dragStart.cropX, dragStart.cropY
                    break;
                }
                // Edge handles
                case "top": {
                    newCrop.cropSize = dragStart.cropSize - deltaY;
                    newCrop.cropY = dragStart.cropY + deltaY;
                    newCrop.cropX = dragStart.cropX + deltaY / 2; // Adjust X to keep centered
                    break;
                }
                case "bottom": {
                    newCrop.cropSize = dragStart.cropSize + deltaY;
                    // newCrop.cropY remains dragStart.cropY
                    newCrop.cropX = dragStart.cropX - deltaY / 2; // Adjust X to keep centered
                    break;
                }
                case "left": {
                    newCrop.cropSize = dragStart.cropSize - deltaX;
                    newCrop.cropX = dragStart.cropX + deltaX;
                    newCrop.cropY = dragStart.cropY + deltaX / 2; // Adjust Y to keep centered
                    break;
                }
                case "right": {
                    newCrop.cropSize = dragStart.cropSize + deltaX;
                    // newCrop.cropX remains dragStart.cropX
                    newCrop.cropY = dragStart.cropY - deltaX / 2; // Adjust Y to keep centered
                    break;
                }
            }
            setCropArea(
                constrainCropArea({
                    x: newCrop.cropX,
                    y: newCrop.cropY,
                    size: newCrop.cropSize,
                }),
            );
        },
        [dragHandle, dragStart, constrainCropArea],
    );

    useEffect(() => {
        const handleGlobalMouseMove = (event: MouseEvent) => {
            if (!isDragging || !imageRef.current) return;
            const currentMousePos = getRelativeMousePosition(
                event.clientX,
                event.clientY,
            );
            performDrag(currentMousePos);
        };

        const handleGlobalMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                setDragHandle(null);
            }
        };

        if (isDragging) {
            window.addEventListener("mousemove", handleGlobalMouseMove);
            window.addEventListener("mouseup", handleGlobalMouseUp);
            return () => {
                window.removeEventListener("mousemove", handleGlobalMouseMove);
                window.removeEventListener("mouseup", handleGlobalMouseUp);
            };
        }
    }, [isDragging, performDrag, getRelativeMousePosition]);

    const cropAndSave = useCallback(async () => {
        if (!selectedImage || !canvasRef.current || !imageRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const img = new Image();
        img.onload = async () => {
            // Set canvas size to desired output size (e.g., 256x256)
            const outputSize = 256;
            canvas.width = outputSize;
            canvas.height = outputSize;

            // Calculate scale factor between displayed image and actual image
            const imageElement = imageRef.current!;
            const scaleX = img.width / imageElement.offsetWidth;
            const scaleY = img.height / imageElement.offsetHeight;

            // Scale crop area to actual image dimensions
            const actualCropX = cropArea.x * scaleX;
            const actualCropY = cropArea.y * scaleY;
            const actualCropSize = cropArea.size * Math.min(scaleX, scaleY);

            // Draw cropped image onto canvas
            ctx.drawImage(
                img,
                actualCropX,
                actualCropY,
                actualCropSize,
                actualCropSize,
                0,
                0,
                outputSize,
                outputSize,
            );

            // Convert to base64 and save
            const croppedDataUrl = canvas.toDataURL("image/png");
            const pathsResult = await window.fileSystem.getSystemPaths();

            if (!pathsResult.success || !pathsResult.data?.appData) {
                console.error(
                    "App data path not found or error fetching paths:",
                    pathsResult.error,
                );
                return;
            }
            const appDataPath = pathsResult.data.appData;
            const fileName = "avatar.png";
            const filePath = `${appDataPath}\\${fileName}`;

            // Extract pure base64 data from the data URL
            const base64Data = croppedDataUrl.replace(
                /^data:image\/png;base64,/,
                "",
            );

            // Pass the base64 string directly with 'base64' encoding
            const writeResult = await window.fileSystem.writeFile(
                filePath,
                base64Data,
                "base64",
            );

            if (writeResult.success) {
                console.log("Avatar saved successfully to:", filePath);
                updateAvatarOnAllServers(filePath);
            } else {
                console.error("Failed to save avatar:", writeResult.error);
            }

            setSelectedImage(null);
        };
        img.src = selectedImage;
    }, [selectedImage, cropArea]);

    const getCursorForHandle = (handle: DragHandle | null) => {
        switch (handle) {
            case "top-left":
            case "bottom-right":
                return "nwse-resize";
            case "top-right":
            case "bottom-left":
                return "nesw-resize";
            case "top":
            case "bottom":
                return "ns-resize";
            case "left":
            case "right":
                return "ew-resize";
            case "center":
                return "move";
            default:
                return "default";
        }
    };

    const handleStyle = {
        width: "8px",
        height: "8px",
        backgroundColor: "hsl(var(--primary))",
        border: "2px solid hsl(var(--background))",
        position: "absolute" as const,
        boxSizing: "content-box" as const,
    };

    return (
        <div className="space-y-4">
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Current Avatar Display */}
            {value && (
                <div className="flex items-center gap-3">
                    <img
                        src={value}
                        alt="Current avatar"
                        className="border-border h-16 w-16 rounded-full border-2 object-cover"
                    />
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">
                            Current Avatar
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAvatarOnAllServers("")}
                            className="w-fit gap-2"
                        >
                            <X className="h-4 w-4" />
                            Remove
                        </Button>
                    </div>
                </div>
            )}

            {/* Image Selection */}
            {!selectedImage ? (
                <Card>
                    <CardContent className="p-6">
                        <div
                            className="border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors"
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
                            <p className="mb-2 text-lg font-medium">
                                Upload Avatar Image
                            </p>
                            <p className="text-muted-foreground mb-4 text-sm">
                                Drag and drop an image here, or click to browse
                            </p>
                            <p className="text-muted-foreground text-xs">
                                Supports PNG, JPG, JPEG, GIF, WebP
                            </p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                    </CardContent>
                </Card>
            ) : (
                /* Image Cropping Interface */
                <Card>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">
                                    Crop Your Avatar
                                </h3>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setSelectedImage(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={cropAndSave}
                                        disabled={cropArea.size < 20}
                                        className="gap-2"
                                    >
                                        <Download className="h-4 w-4" />
                                        Save Avatar
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-6">
                                {/* Image with crop overlay */}
                                <div
                                    className="relative inline-block select-none"
                                    onMouseDown={handleMouseDown}
                                    style={{
                                        cursor: getCursorForHandle(dragHandle),
                                    }}
                                >
                                    <img
                                        ref={imageRef}
                                        src={selectedImage}
                                        alt="Image to crop"
                                        className="max-h-96 max-w-full object-contain"
                                        onLoad={handleImageLoad}
                                        draggable={false}
                                    />

                                    {/* Crop Overlay */}
                                    <div
                                        className="border-primary bg-primary/10 pointer-events-none absolute border-2"
                                        style={{
                                            left: cropArea.x,
                                            top: cropArea.y,
                                            width: cropArea.size,
                                            height: cropArea.size,
                                        }}
                                    />

                                    {/* Handles Container - to ensure handles are clickable even if cropArea is small */}
                                    {selectedImage && imageSize.width > 0 && (
                                        <>
                                            {/* Corner Handles */}
                                            <div
                                                style={{
                                                    ...handleStyle,
                                                    left: cropArea.x - 5,
                                                    top: cropArea.y - 5,
                                                    cursor: "nwse-resize",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    ...handleStyle,
                                                    left:
                                                        cropArea.x +
                                                        cropArea.size -
                                                        5,
                                                    top: cropArea.y - 5,
                                                    cursor: "nesw-resize",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    ...handleStyle,
                                                    left: cropArea.x - 5,
                                                    top:
                                                        cropArea.y +
                                                        cropArea.size -
                                                        5,
                                                    cursor: "nesw-resize",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    ...handleStyle,
                                                    left:
                                                        cropArea.x +
                                                        cropArea.size -
                                                        5,
                                                    top:
                                                        cropArea.y +
                                                        cropArea.size -
                                                        5,
                                                    cursor: "nwse-resize",
                                                }}
                                            />

                                            {/* Edge Handles */}
                                            <div
                                                style={{
                                                    ...handleStyle,
                                                    left:
                                                        cropArea.x +
                                                        cropArea.size / 2 -
                                                        5,
                                                    top: cropArea.y - 5,
                                                    cursor: "ns-resize",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    ...handleStyle,
                                                    left:
                                                        cropArea.x +
                                                        cropArea.size / 2 -
                                                        5,
                                                    top:
                                                        cropArea.y +
                                                        cropArea.size -
                                                        5,
                                                    cursor: "ns-resize",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    ...handleStyle,
                                                    left: cropArea.x - 5,
                                                    top:
                                                        cropArea.y +
                                                        cropArea.size / 2 -
                                                        5,
                                                    cursor: "ew-resize",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    ...handleStyle,
                                                    left:
                                                        cropArea.x +
                                                        cropArea.size -
                                                        5,
                                                    top:
                                                        cropArea.y +
                                                        cropArea.size / 2 -
                                                        5,
                                                    cursor: "ew-resize",
                                                }}
                                            />
                                        </>
                                    )}

                                    {/* Center drag area indicator (visual only, logic is in handleMouseDown) */}
                                    {dragHandle !== "center" && ( // Show only when not actively dragging center
                                        <div
                                            className="pointer-events-none absolute flex items-center justify-center opacity-0 transition-opacity hover:opacity-100"
                                            style={{
                                                left:
                                                    cropArea.x +
                                                    handleStyle.width, // Offset by handle size
                                                top:
                                                    cropArea.y +
                                                    handleStyle.height,
                                                width: Math.max(
                                                    0,
                                                    cropArea.size -
                                                        2 *
                                                            parseFloat(
                                                                handleStyle.width,
                                                            ),
                                                ),
                                                height: Math.max(
                                                    0,
                                                    cropArea.size -
                                                        2 *
                                                            parseFloat(
                                                                handleStyle.height,
                                                            ),
                                                ),
                                                cursor: "move",
                                            }}
                                        >
                                            <div className="bg-primary/20 text-primary rounded p-1 text-xs font-medium">
                                                Drag to move
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Preview Panel */}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="text-sm font-medium">
                                        Preview
                                    </div>
                                    <div
                                        className="border-border bg-muted h-24 w-24 overflow-hidden rounded-full border-2"
                                        style={{
                                            backgroundImage: `url(${selectedImage})`,
                                            backgroundPosition:
                                                imageSize.width > 0 &&
                                                imageSize.height > 0 &&
                                                cropArea.size > 0 &&
                                                selectedImage // Added selectedImage check
                                                    ? `-${(cropArea.x / imageSize.width) * ((imageSize.width / cropArea.size) * 96)}px -${(cropArea.y / imageSize.height) * ((imageSize.height / cropArea.size) * 96)}px`
                                                    : "0 0",
                                            backgroundSize:
                                                imageSize.width > 0 &&
                                                imageSize.height > 0 &&
                                                cropArea.size > 0 &&
                                                selectedImage // Added selectedImage check
                                                    ? `${(imageSize.width / cropArea.size) * 96}px ${(imageSize.height / cropArea.size) * 96}px`
                                                    : "cover",
                                        }}
                                    />
                                    <div className="text-center">
                                        <div className="text-muted-foreground text-xs">
                                            Will be resized to 256×256
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-muted-foreground text-sm">
                                Drag the corners to resize the crop area or drag
                                the center to move it. The selected area will be
                                cropped to a perfect square.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
