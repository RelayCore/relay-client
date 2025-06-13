import path from "path";
import fs from "fs";
import { nativeImage } from "electron";

function getMimeType(fileExt: string): string {
    // Video formats
    if (fileExt === ".mp4") return "video/mp4";
    else if (fileExt === ".webm") return "video/webm";
    else if (fileExt === ".mov") return "video/quicktime";
    else if (fileExt === ".avi") return "video/x-msvideo";
    else if (fileExt === ".mkv") return "video/x-matroska";
    // Image formats
    else if (fileExt === ".png") return "image/png";
    else if (fileExt === ".jpg" || fileExt === ".jpeg") return "image/jpeg";
    else if (fileExt === ".gif") return "image/gif";
    else if (fileExt === ".webp") return "image/webp";
    // Default
    return "application/octet-stream";
}

export async function handleVideoRequest(
    filePath: string,
    request: Request,
    stats: fs.Stats,
): Promise<Response> {
    const fileExt = path.extname(filePath).toLowerCase();
    const contentType = getMimeType(fileExt);

    try {
        // Verify the file can be accessed
        await fs.promises.access(filePath, fs.constants.R_OK);

        // Handle range requests for video streaming
        const rangeHeader = request.headers.get("Range");

        if (rangeHeader) {
            try {
                // Parse the range header
                const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);

                if (match) {
                    const start = parseInt(match[1], 10);
                    const end = match[2]
                        ? parseInt(match[2], 10)
                        : stats.size - 1;
                    const chunkSize = end - start + 1;

                    // Check if range is valid
                    if (start >= stats.size || end >= stats.size) {
                        console.error(
                            `Invalid range request: start=${start}, end=${end}, size=${stats.size}`,
                        );
                        return new Response("Invalid range", {
                            status: 416,
                            headers: {
                                "Content-Range": `bytes */${stats.size}`,
                                "Accept-Ranges": "bytes",
                                "Content-Type": "text/plain",
                            },
                        });
                    }

                    // Use file stream instead of synchronous operations
                    const stream = fs.createReadStream(filePath, {
                        start,
                        end,
                    });

                    return new Response(stream as unknown as ReadableStream, {
                        status: 206,
                        headers: {
                            "Content-Type": contentType,
                            "Content-Length": String(chunkSize),
                            "Content-Range": `bytes ${start}-${end}/${stats.size}`,
                            "Accept-Ranges": "bytes",
                            "Cache-Control": "no-cache",
                        },
                    });
                }
            } catch (error) {
                console.error("Error processing video range request:", error);
                // Continue to serve the whole file if range request fails
            }
        }

        // Send initial part of the file
        const initialChunkSize = Math.min(1024 * 1024, stats.size); // 1MB or file size
        const stream = fs.createReadStream(filePath, {
            start: 0,
            end: initialChunkSize - 1,
        });

        return new Response(stream as unknown as ReadableStream, {
            status: 206,
            headers: {
                "Content-Type": contentType,
                "Accept-Ranges": "bytes",
                "Content-Length": String(initialChunkSize),
                "Content-Range": `bytes 0-${initialChunkSize - 1}/${stats.size}`,
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        console.error(`Error accessing video stream: ${error}`);
        throw error;
    }
}

export async function handleImageRequest(
    filePath: string,
    url: URL,
    stats: fs.Stats,
): Promise<Response> {
    const fileExt = path.extname(filePath).toLowerCase();
    const contentType = getMimeType(fileExt);
    const fullImage = url.searchParams.get("full") === "true";

    if (fullImage) {
        // Return the full image
        const stream = fs.createReadStream(filePath);
        return new Response(stream as unknown as ReadableStream, {
            headers: {
                "Content-Type": contentType,
                "Content-Length": String(stats.size),
                "Cache-Control": "max-age=3600",
            },
        });
    } else {
        // Generate a thumbnail
        let width = parseInt(url.searchParams.get("w") || "0", 10);
        let height = parseInt(url.searchParams.get("h") || "0", 10);
        const size = parseInt(url.searchParams.get("s") || "200", 10);

        if (width === 0 && height === 0) {
            width = size;
            height = size;
        } else if (width === 0) {
            width = Math.round((height / size) * size);
        } else if (height === 0) {
            height = Math.round((width / size) * size);
        }

        const image = await nativeImage.createThumbnailFromPath(filePath, {
            width,
            height,
        });

        return new Response(image.toJPEG(70), {
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "max-age=3600",
            },
        });
    }
}
