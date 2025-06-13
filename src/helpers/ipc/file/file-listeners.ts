import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import fs from "fs/promises";
import fsSync from "fs";
import { app } from "electron";
import {
    FILE_OPEN_DIALOG_CHANNEL,
    FILE_SAVE_DIALOG_CHANNEL,
    FILE_READ_CHANNEL,
    FILE_WRITE_CHANNEL,
    FILE_EXISTS_CHANNEL,
    FILE_DELETE_CHANNEL,
    FILE_COPY_CHANNEL,
    FILE_MOVE_CHANNEL,
    FILE_STATS_CHANNEL,
    FILE_GET_PATH_CHANNEL,
    FILE_WATCH_CHANNEL,
    FILE_UNWATCH_CHANNEL,
    DIR_CREATE_CHANNEL,
    DIR_READ_CHANNEL,
    DIR_READ_RECURSIVE_CHANNEL,
    DIR_EXISTS_CHANNEL,
    DIR_DELETE_CHANNEL,
    DIR_WATCH_CHANNEL,
    DIR_UNWATCH_CHANNEL,
    WATCH_STOP_CHANNEL,
    WATCH_STOP_ALL_CHANNEL,
    SHELL_OPEN_PATH_CHANNEL,
    SHELL_SHOW_ITEM_CHANNEL,
    SHELL_TRASH_ITEM_CHANNEL,
    GET_SYSTEM_PATHS_CHANNEL,
} from "./file-channels";

// File watchers map to keep track of active watchers
const fileWatchers = new Map<string, fsSync.FSWatcher>();

// Helper function to check if a file matches the extension filters
function matchesExtensionFilter(
    filename: string,
    extensions?: string[],
): boolean {
    if (!extensions || extensions.length === 0) {
        return true; // No filter means all files match
    }

    const fileExtension = filename.split(".").pop()?.toLowerCase();
    return fileExtension ? extensions.includes(fileExtension) : false;
}

// Helper function for recursive directory reading
async function readDirectoryRecursively(
    dirPath: string,
    currentDepth = 0,
    maxDepth = 10,
    extensions?: string[],
): Promise<DirectoryEntry[]> {
    if (currentDepth >= maxDepth) {
        return [];
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;

        // Filter files by extension if extensions array is provided
        if (entry.isFile() && !matchesExtensionFilter(entry.name, extensions)) {
            continue; // Skip files that don't match the extension filter
        }

        const entryData: DirectoryEntry = {
            name: entry.name,
            path: fullPath,
            isFile: entry.isFile(),
            isDirectory: entry.isDirectory(),
        };

        if (entry.isFile()) {
            try {
                const stats = await fs.stat(fullPath);
                entryData.size = stats.size;
            } catch {
                // Ignore stat errors for individual files
            }
        } else if (entry.isDirectory()) {
            try {
                entryData.children = await readDirectoryRecursively(
                    fullPath,
                    currentDepth + 1,
                    maxDepth,
                    extensions,
                );
            } catch {
                // Ignore errors for inaccessible directories
                entryData.children = [];
            }
        }

        result.push(entryData);
    }

    return result;
}

export function addFileEventListeners(mainWindow: BrowserWindow) {
    // File Dialog Operations
    ipcMain.handle(FILE_OPEN_DIALOG_CHANNEL, async (_, options) => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ["openFile"],
                filters: [
                    { name: "All Files", extensions: ["*"] },
                    { name: "Text Files", extensions: ["txt", "md", "json"] },
                    {
                        name: "Images",
                        extensions: ["png", "jpg", "jpeg", "gif", "webp"],
                    },
                    {
                        name: "Videos",
                        extensions: ["mp4", "webm", "mov", "avi", "mkv"],
                    },
                ],
                ...options,
            });
            return { success: true, data: result };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle(FILE_SAVE_DIALOG_CHANNEL, async (_, options) => {
        try {
            const result = await dialog.showSaveDialog(mainWindow, {
                filters: [
                    { name: "All Files", extensions: ["*"] },
                    { name: "Text Files", extensions: ["txt", "md", "json"] },
                ],
                ...options,
            });
            return { success: true, data: result };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    // File Operations
    ipcMain.handle(
        FILE_READ_CHANNEL,
        async (_, filePath, encoding = "utf8") => {
            try {
                const data = await fs.readFile(filePath, encoding);
                return { success: true, data };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        },
    );

    ipcMain.handle(
        FILE_WRITE_CHANNEL,
        async (_, filePath, data, encoding = "utf8") => {
            try {
                await fs.writeFile(filePath, data, encoding);
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        },
    );
    ipcMain.handle(FILE_EXISTS_CHANNEL, async (_, filePath) => {
        try {
            await fs.access(filePath);
            return { success: true, data: true };
        } catch {
            return { success: true, data: false };
        }
    });

    ipcMain.handle(FILE_DELETE_CHANNEL, async (_, filePath) => {
        try {
            await fs.unlink(filePath);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle(
        FILE_COPY_CHANNEL,
        async (_, sourcePath, destinationPath) => {
            try {
                await fs.copyFile(sourcePath, destinationPath);
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        },
    );

    ipcMain.handle(
        FILE_MOVE_CHANNEL,
        async (_, sourcePath, destinationPath) => {
            try {
                await fs.rename(sourcePath, destinationPath);
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        },
    );

    ipcMain.handle(FILE_STATS_CHANNEL, async (_, filePath) => {
        try {
            const stats = await fs.stat(filePath);
            return {
                success: true,
                data: {
                    size: stats.size,
                    isFile: stats.isFile(),
                    isDirectory: stats.isDirectory(),
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime,
                    accessedAt: stats.atime,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle(FILE_GET_PATH_CHANNEL, async (_, pathName) => {
        try {
            const pathMap: { [key: string]: string } = {
                home: app.getPath("home"),
                appData: app.getPath("appData"),
                userData: app.getPath("userData"),
                temp: app.getPath("temp"),
                desktop: app.getPath("desktop"),
                documents: app.getPath("documents"),
                downloads: app.getPath("downloads"),
                music: app.getPath("music"),
                pictures: app.getPath("pictures"),
                videos: app.getPath("videos"),
            };

            const resolvedPath = pathMap[pathName];
            if (!resolvedPath) {
                return {
                    success: false,
                    error: `Unknown path name: ${pathName}`,
                };
            }

            return { success: true, data: resolvedPath };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    // File Watching
    ipcMain.handle(FILE_WATCH_CHANNEL, async (_, filePath, watchId) => {
        try {
            if (fileWatchers.has(watchId)) {
                fileWatchers.get(watchId)?.close();
            }

            const watcher = fsSync.watch(
                filePath,
                (eventType: string, filename: string | null) => {
                    mainWindow.webContents.send("file-watcher-event", {
                        watchId,
                        eventType,
                        filename,
                        filePath,
                    });
                },
            );

            fileWatchers.set(watchId, watcher);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle(FILE_UNWATCH_CHANNEL, async (_, watchId) => {
        try {
            const watcher = fileWatchers.get(watchId);
            if (watcher) {
                watcher.close();
                fileWatchers.delete(watchId);
            }
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    // Directory Operations
    ipcMain.handle(DIR_CREATE_CHANNEL, async (_, dirPath, recursive = true) => {
        try {
            await fs.mkdir(dirPath, { recursive });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle(
        DIR_READ_CHANNEL,
        async (_, dirPath, withFileTypes = false, extensions) => {
            try {
                if (withFileTypes) {
                    const entries = await fs.readdir(dirPath, {
                        withFileTypes: true,
                    });
                    let data = entries.map((entry) => ({
                        name: entry.name,
                        isFile: entry.isFile(),
                        isDirectory: entry.isDirectory(),
                        isSymbolicLink: entry.isSymbolicLink(),
                    }));

                    // Filter by extensions if provided
                    if (extensions && extensions.length > 0) {
                        data = data.filter((entry) => {
                            if (!entry.isFile) return true; // Keep directories
                            return matchesExtensionFilter(
                                entry.name,
                                extensions,
                            );
                        });
                    }

                    return { success: true, data };
                } else {
                    let data = await fs.readdir(dirPath);

                    // Filter by extensions if provided
                    if (extensions && extensions.length > 0) {
                        data = data.filter((filename) =>
                            matchesExtensionFilter(filename, extensions),
                        );
                    }

                    return { success: true, data };
                }
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        },
    );

    ipcMain.handle(
        DIR_READ_RECURSIVE_CHANNEL,
        async (_, dirPath, maxDepth = 10, extensions) => {
            try {
                const data = await readDirectoryRecursively(
                    dirPath,
                    0,
                    maxDepth,
                    extensions,
                );
                return { success: true, data };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        },
    );

    ipcMain.handle(DIR_EXISTS_CHANNEL, async (_, dirPath) => {
        try {
            const stats = await fs.stat(dirPath);
            return { success: true, data: stats.isDirectory() };
        } catch {
            return { success: true, data: false };
        }
    });

    ipcMain.handle(
        DIR_DELETE_CHANNEL,
        async (_, dirPath, recursive = false) => {
            try {
                await fs.rmdir(dirPath, { recursive });
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        },
    );

    // Directory Watching
    ipcMain.handle(
        DIR_WATCH_CHANNEL,
        async (_, dirPath, watchId, recursive = false) => {
            try {
                if (fileWatchers.has(watchId)) {
                    fileWatchers.get(watchId)?.close();
                }

                const watcher = fsSync.watch(
                    dirPath,
                    { recursive },
                    (eventType, filename) => {
                        mainWindow.webContents.send("directory-watcher-event", {
                            watchId,
                            eventType,
                            filename,
                            dirPath,
                        });
                    },
                );

                fileWatchers.set(watchId, watcher);
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        },
    );

    ipcMain.handle(DIR_UNWATCH_CHANNEL, async (_, watchId) => {
        try {
            const watcher = fileWatchers.get(watchId);
            if (watcher) {
                watcher.close();
                fileWatchers.delete(watchId);
            }
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    // Shell Operations
    ipcMain.handle(SHELL_OPEN_PATH_CHANNEL, async (_, filePath) => {
        try {
            const error = await shell.openPath(filePath);
            if (error) {
                return { success: false, error };
            }
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle(SHELL_SHOW_ITEM_CHANNEL, async (_, filePath) => {
        try {
            shell.showItemInFolder(filePath);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });
    ipcMain.handle(SHELL_TRASH_ITEM_CHANNEL, async (_, filePath) => {
        try {
            const success = await shell.trashItem(filePath);
            return { success };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    // Watch management operations
    ipcMain.handle(WATCH_STOP_CHANNEL, async (_, watchId) => {
        try {
            const watcher = fileWatchers.get(watchId);
            if (watcher) {
                watcher.close();
                fileWatchers.delete(watchId);
            }
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle(WATCH_STOP_ALL_CHANNEL, async () => {
        try {
            fileWatchers.forEach((watcher) => watcher.close());
            fileWatchers.clear();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    // System paths operation
    ipcMain.handle(GET_SYSTEM_PATHS_CHANNEL, async () => {
        try {
            const paths = {
                home: app.getPath("home"),
                appData: app.getPath("appData"),
                userData: app.getPath("userData"),
                temp: app.getPath("temp"),
                desktop: app.getPath("desktop"),
                documents: app.getPath("documents"),
                downloads: app.getPath("downloads"),
                music: app.getPath("music"),
                pictures: app.getPath("pictures"),
                videos: app.getPath("videos"),
            };
            return { success: true, data: paths };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });
}

export function cleanupFileWatchers() {
    fileWatchers.forEach((watcher) => watcher.close());
    fileWatchers.clear();
}
