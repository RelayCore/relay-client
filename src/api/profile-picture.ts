import { uploadProfilePicture } from "../api/server";
import {
    loadServers,
    ServerRecord,
    addServer,
    removeServer,
} from "../storage/server-store";

interface FailedUpload {
    serverUrl: string;
    serverName?: string;
    error: string;
    timestamp: number;
    filePath: string;
}

const FAILED_UPLOADS_KEY = "relay_failed_avatar_uploads";

/**
 * Gets all connected servers from server store
 */
async function getConnectedServers(): Promise<ServerRecord[]> {
    return await loadServers();
}

/**
 * Gets failed uploads from localStorage
 */
function getFailedUploads(): FailedUpload[] {
    const failedJson = localStorage.getItem(FAILED_UPLOADS_KEY);
    return failedJson ? JSON.parse(failedJson) : [];
}

/**
 * Saves failed uploads to localStorage
 */
function saveFailedUploads(failed: FailedUpload[]): void {
    localStorage.setItem(FAILED_UPLOADS_KEY, JSON.stringify(failed));
}

/**
 * Converts file path to File object using Electron file system APIs
 */
async function filePathToFile(filePath: string): Promise<File> {
    try {
        // Check if file exists
        const existsResult = await window.fileSystem.fileExists(filePath);
        if (!existsResult.success || !existsResult.data) {
            throw new Error(`File does not exist: ${filePath}`);
        }

        // Read file as binary data (null encoding means binary)
        const fileResult = await window.fileSystem.readFile(filePath, null);
        if (!fileResult.success) {
            throw new Error(`Failed to read file: ${fileResult.error}`);
        }

        // Get file stats for additional info
        const statsResult = await window.fileSystem.getFileStats(filePath);
        if (!statsResult.success) {
            throw new Error(`Failed to get file stats: ${statsResult.error}`);
        }

        // Extract filename from path
        const fileName = filePath.split(/[\\/]/).pop() || "avatar";

        // Determine MIME type based on file extension
        const extension = fileName.split(".").pop()?.toLowerCase();
        let mimeType = "application/octet-stream";

        switch (extension) {
            case "jpg":
            case "jpeg":
                mimeType = "image/jpeg";
                break;
            case "png":
                mimeType = "image/png";
                break;
            case "gif":
                mimeType = "image/gif";
                break;
            case "webp":
                mimeType = "image/webp";
                break;
        }

        // Convert buffer to File object
        const buffer = fileResult.data;
        if (!buffer) {
            throw new Error("File data is undefined or empty.");
        }
        // If buffer is a Node.js Buffer, convert to Uint8Array
        let uint8Array: Uint8Array;
        if (buffer instanceof ArrayBuffer) {
            uint8Array = new Uint8Array(buffer);
        } else if (buffer instanceof Uint8Array) {
            uint8Array = buffer;
        } else if (
            typeof Buffer !== "undefined" &&
            typeof Buffer.isBuffer === "function" &&
            Buffer.isBuffer(buffer)
        ) {
            uint8Array = new Uint8Array(
                buffer.buffer,
                buffer.byteOffset,
                buffer.byteLength,
            );
        } else if (Array.isArray(buffer)) {
            uint8Array = new Uint8Array(buffer);
        } else {
            throw new Error(
                "Unsupported buffer type returned from fileSystem.readFile",
            );
        }
        const blob = new Blob([uint8Array], { type: mimeType });
        return new File([blob], fileName, { type: mimeType });
    } catch (error) {
        throw new Error(
            `Failed to convert file path to File object: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
}

/**
 * Updates avatar on all connected servers
 */
export async function updateAvatarOnAllServers(
    filePath: string,
): Promise<void> {
    if (!filePath) return;

    const servers = await getConnectedServers();
    const failed: FailedUpload[] = [];
    const successful: string[] = [];

    try {
        const file = await filePathToFile(filePath);

        // Attempt to update avatar on each server
        const updatePromises = servers.map(async (server) => {
            try {
                await uploadProfilePicture(
                    server.server_url,
                    server.user_id,
                    file,
                );
                successful.push(server.server_url);
                console.log(
                    `Avatar updated successfully on ${server.server_name || server.server_url}`,
                );
            } catch (error) {
                const failedUpload: FailedUpload = {
                    serverUrl: server.server_url,
                    serverName: server.server_name,
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                    timestamp: Date.now(),
                    filePath,
                };
                failed.push(failedUpload);
                console.error(
                    `Failed to update avatar on ${server.server_name || server.server_url}:`,
                    error,
                );
            }
        });

        await Promise.allSettled(updatePromises);

        // Update localStorage with failed uploads
        if (failed.length > 0) {
            const existingFailed = getFailedUploads();
            // Remove any previous failures for the same servers
            const filteredExisting = existingFailed.filter(
                (existing) =>
                    !failed.some(
                        (newFail) => newFail.serverUrl === existing.serverUrl,
                    ),
            );
            saveFailedUploads([...filteredExisting, ...failed]);
        }

        // Clean up successful uploads from failed list
        if (successful.length > 0) {
            const existingFailed = getFailedUploads();
            const filteredFailed = existingFailed.filter(
                (existing) => !successful.includes(existing.serverUrl),
            );
            saveFailedUploads(filteredFailed);
        }

        // Show notification about results
        showAvatarUpdateNotification(successful.length, failed.length);
    } catch (error) {
        console.error("Error processing avatar file:", error);
        // You might want to show an error notification here
    }
}

/**
 * Retries failed avatar uploads
 */
export async function retryFailedAvatarUploads(): Promise<void> {
    const failed = getFailedUploads();
    if (failed.length === 0) return;

    const stillFailed: FailedUpload[] = [];
    const successful: string[] = [];

    for (const failedUpload of failed) {
        try {
            // Check if the original file still exists
            const existsResult = await window.fileSystem.fileExists(
                failedUpload.filePath,
            );
            if (!existsResult.success || !existsResult.data) {
                console.warn(
                    `Original file no longer exists: ${failedUpload.filePath}, removing from failed list`,
                );
                continue;
            }

            const file = await filePathToFile(failedUpload.filePath);
            const servers = await getConnectedServers();
            const server = servers.find(
                (s) => s.server_url === failedUpload.serverUrl,
            );

            if (!server) {
                // Server no longer connected, remove from failed list
                continue;
            }

            await uploadProfilePicture(server.server_url, server.user_id, file);
            successful.push(server.server_url);
            console.log(
                `Avatar retry successful on ${failedUpload.serverName || failedUpload.serverUrl}`,
            );
        } catch (error) {
            stillFailed.push({
                ...failedUpload,
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: Date.now(),
            });
            console.error(
                `Avatar retry failed on ${failedUpload.serverName || failedUpload.serverUrl}:`,
                error,
            );
        }
    }

    // Update localStorage with remaining failures
    saveFailedUploads(stillFailed);

    if (successful.length > 0 || stillFailed.length < failed.length) {
        showAvatarUpdateNotification(successful.length, stillFailed.length);
    }
}

/**
 * Gets count of failed uploads
 */
export function getFailedUploadCount(): number {
    return getFailedUploads().length;
}

/**
 * Gets list of failed uploads for display
 */
export function getFailedUploadsList(): FailedUpload[] {
    return getFailedUploads();
}

/**
 * Clears all failed uploads
 */
export function clearFailedUploads(): void {
    localStorage.removeItem(FAILED_UPLOADS_KEY);
}

/**
 * Removes a specific failed upload
 */
export function removeFailedUpload(serverUrl: string): void {
    const failed = getFailedUploads();
    const filtered = failed.filter((upload) => upload.serverUrl !== serverUrl);
    saveFailedUploads(filtered);
}

/**
 * Shows notification about avatar update results
 * You'll need to implement this based on your notification system
 */
function showAvatarUpdateNotification(
    successCount: number,
    failCount: number,
): void {
    if (successCount > 0 && failCount === 0) {
        console.log(`Avatar updated successfully on ${successCount} server(s)`);
    } else if (successCount > 0 && failCount > 0) {
        console.log(
            `Avatar updated on ${successCount} server(s), failed on ${failCount} server(s)`,
        );
    } else if (failCount > 0) {
        console.log(`Avatar update failed on ${failCount} server(s)`);
    }
}

/**
 * Call this when a user successfully connects to a server
 */
export async function addConnectedServer(
    serverRecord: ServerRecord,
): Promise<void> {
    await addServer(serverRecord);
}

/**
 * Call this when a user disconnects from a server
 */
export async function removeConnectedServer(
    serverUrl: string,
    userId: string,
): Promise<void> {
    await removeServer(serverUrl, userId);

    // Also remove any failed uploads for this server
    const failedUploads = getFailedUploads();
    const filteredFailed = failedUploads.filter(
        (upload) => upload.serverUrl !== serverUrl,
    );
    saveFailedUploads(filteredFailed);
}
