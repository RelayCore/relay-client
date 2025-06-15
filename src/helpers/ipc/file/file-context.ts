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
    DIR_CREATE_CHANNEL,
    DIR_READ_CHANNEL,
    DIR_READ_RECURSIVE_CHANNEL,
    DIR_EXISTS_CHANNEL,
    DIR_DELETE_CHANNEL,
    FILE_WATCH_CHANNEL,
    FILE_UNWATCH_CHANNEL,
    DIR_WATCH_CHANNEL,
    DIR_UNWATCH_CHANNEL,
    WATCH_STOP_CHANNEL,
    WATCH_STOP_ALL_CHANNEL,
    SHELL_OPEN_PATH_CHANNEL,
    SHELL_SHOW_ITEM_CHANNEL,
    SHELL_TRASH_ITEM_CHANNEL,
    GET_SYSTEM_PATHS_CHANNEL,
} from "./file-channels";

export function exposeFileContext() {
    const { contextBridge, ipcRenderer } = window.require("electron");
    contextBridge.exposeInMainWorld("fileSystem", {
        // File dialog operations
        openDialog: (options?: DialogOptions) =>
            ipcRenderer.invoke(FILE_OPEN_DIALOG_CHANNEL, options),
        saveDialog: (options?: DialogOptions) =>
            ipcRenderer.invoke(FILE_SAVE_DIALOG_CHANNEL, options),

        // File operations
        readFile: (filePath: string, encoding?: string | null) =>
            ipcRenderer.invoke(FILE_READ_CHANNEL, filePath, encoding),
        writeFile: (
            filePath: string,
            data: string | Buffer,
            encoding?: string,
        ) => ipcRenderer.invoke(FILE_WRITE_CHANNEL, filePath, data, encoding),
        fileExists: (filePath: string) =>
            ipcRenderer.invoke(FILE_EXISTS_CHANNEL, filePath),
        deleteFile: (filePath: string) =>
            ipcRenderer.invoke(FILE_DELETE_CHANNEL, filePath),
        copyFile: (sourcePath: string, destPath: string) =>
            ipcRenderer.invoke(FILE_COPY_CHANNEL, sourcePath, destPath),
        moveFile: (sourcePath: string, destPath: string) =>
            ipcRenderer.invoke(FILE_MOVE_CHANNEL, sourcePath, destPath),
        getFileStats: (filePath: string) =>
            ipcRenderer.invoke(FILE_STATS_CHANNEL, filePath),

        // Directory operations
        createDirectory: (dirPath: string, recursive?: boolean) =>
            ipcRenderer.invoke(DIR_CREATE_CHANNEL, dirPath, recursive),
        readDirectory: (dirPath: string, extensions?: string[]) =>
            ipcRenderer.invoke(DIR_READ_CHANNEL, dirPath, true, extensions),
        readDirectoryRecursive: (
            dirPath: string,
            maxDepth?: number,
            extensions?: string[],
        ) =>
            ipcRenderer.invoke(
                DIR_READ_RECURSIVE_CHANNEL,
                dirPath,
                maxDepth,
                extensions,
            ),
        directoryExists: (dirPath: string) =>
            ipcRenderer.invoke(DIR_EXISTS_CHANNEL, dirPath),
        deleteDirectory: (dirPath: string, recursive?: boolean) =>
            ipcRenderer.invoke(DIR_DELETE_CHANNEL, dirPath, recursive),

        // File/Directory watching
        watchFile: (filePath: string) => {
            const watchId = `file_${Date.now()}_${Math.random()}`;
            return ipcRenderer.invoke(FILE_WATCH_CHANNEL, filePath, watchId);
        },
        unwatchFile: (watchId: string) =>
            ipcRenderer.invoke(FILE_UNWATCH_CHANNEL, watchId),
        watchDirectory: (dirPath: string, recursive?: boolean) => {
            const watchId = `dir_${Date.now()}_${Math.random()}`;
            return ipcRenderer.invoke(
                DIR_WATCH_CHANNEL,
                dirPath,
                watchId,
                recursive,
            );
        },
        unwatchDirectory: (watchId: string) =>
            ipcRenderer.invoke(DIR_UNWATCH_CHANNEL, watchId),
        stopWatching: (watchId: string) =>
            ipcRenderer.invoke(WATCH_STOP_CHANNEL, watchId),
        stopAllWatching: () => ipcRenderer.invoke(WATCH_STOP_ALL_CHANNEL), // File system events
        onFileChange: (callback: (event: FileWatchEvent) => void) => {
            ipcRenderer.on(
                "file-watcher-event",
                (_: unknown, event: FileWatchEvent) => callback(event),
            );
            return () => ipcRenderer.removeAllListeners("file-watcher-event");
        },
        onDirectoryChange: (callback: (event: FileWatchEvent) => void) => {
            ipcRenderer.on(
                "directory-watcher-event",
                (_: unknown, event: FileWatchEvent) => callback(event),
            );
            return () =>
                ipcRenderer.removeAllListeners("directory-watcher-event");
        },

        // Shell operations
        openPath: (path: string) =>
            ipcRenderer.invoke(SHELL_OPEN_PATH_CHANNEL, path),
        showItemInFolder: (path: string) =>
            ipcRenderer.invoke(SHELL_SHOW_ITEM_CHANNEL, path),
        moveToTrash: (path: string) =>
            ipcRenderer.invoke(SHELL_TRASH_ITEM_CHANNEL, path),

        // System paths
        getSystemPaths: () => ipcRenderer.invoke(GET_SYSTEM_PATHS_CHANNEL),
    });
}
