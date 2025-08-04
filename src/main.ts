import { app, BrowserWindow, protocol, ipcMain, session } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
import path from "path";
import fs from "fs";
import {
    installExtension,
    REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import { shell } from "electron";
import { APP_CONFIG, inDevelopment } from "./config";
import { updateElectronApp } from "update-electron-app";
import dotenv from "dotenv";
import { isImageFile, isVideoFile } from "./utils/assets";
import { handleImageRequest, handleVideoRequest } from "./files";
import { cleanupFileWatchers } from "./helpers/ipc/file/file-listeners";
import { webSocketManager } from "./websocket/websocket-manager";
import { ogCache } from "./helpers/ipc/og/og-listeners";
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import fetch from "cross-fetch";

dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require("electron-squirrel-startup")) app.quit();
updateElectronApp({
    repo: APP_CONFIG.repo,
    updateInterval: "1 hour",
    notifyUser: true,
});

const protocolName = APP_CONFIG.protocolName;
const imageProtocolName = `${protocolName}-image`;
const videoProtocolName = `${protocolName}-video`;

protocol.registerSchemesAsPrivileged([
    { scheme: imageProtocolName, privileges: { bypassCSP: true } },
    {
        scheme: videoProtocolName,
        privileges: {
            bypassCSP: true,
            supportFetchAPI: true,
            corsEnabled: true,
        },
    },
]);

ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
    blocker.enableBlockingInSession(session.defaultSession);
});

// Global reference to windows to avoid garbage collection
let mainWindow: BrowserWindow | null = null;
let loadingWindow: BrowserWindow | null = null;
let mainWindowReady = false;
let manuallyCompleted = false;

function createLoadingWindow() {
    // Skip creating loading window if it's disabled in config
    if (!APP_CONFIG.useLoadingWindow) return null;

    loadingWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: false,
        resizable: false,
        show: false,
        backgroundColor: "#0a0a0a",
        webPreferences: {
            devTools: true,
        },
    });

    let splashPath;
    if (app.isPackaged) {
        splashPath = path.join(process.resourcesPath, "splash.html");
    } else {
        splashPath = path.join(process.cwd(), "splash.html");
    }

    loadingWindow.loadFile(splashPath, { query: { appName: APP_CONFIG.name } });

    loadingWindow.once("ready-to-show", () => {
        loadingWindow?.show();
    });

    return loadingWindow;
}

function createMainWindow() {
    const preload = path.join(__dirname, "preload.js");
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 400,
        minHeight: 300,
        show: false,
        backgroundColor: "#0a0a0a",
        webPreferences: {
            devTools: inDevelopment,
            contextIsolation: true,
            nodeIntegration: true,
            nodeIntegrationInSubFrames: false,
            preload: preload,
        },
        titleBarStyle: "hidden",
    });

    mainWindow.on("maximize", () => {
        mainWindow?.webContents.send("window-state-change", true);
    });

    mainWindow.on("unmaximize", () => {
        mainWindow?.webContents.send("window-state-change", false);
    });

    registerListeners(mainWindow);

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(
            path.join(
                __dirname,
                `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
            ),
        );
    }

    // Set up ready-to-show handler
    mainWindow.once("ready-to-show", () => {
        mainWindowReady = true;
        tryShowMainWindow();
    });

    return mainWindow;
}

// Check if conditions are met to show the main window
function tryShowMainWindow() {
    // Show main window if it's ready AND either:
    // 1. The app has received the manual "complete" signal, or
    // 2. We're using the automatic transition (no manual control requested)
    // 3. The loading window is disabled in config
    const shouldShow =
        mainWindowReady &&
        (manuallyCompleted ||
            !app.isPackaged ||
            inDevelopment ||
            !APP_CONFIG.useLoadingWindow);

    if (shouldShow && mainWindow) {
        // Give a slight delay to prevent flashing
        setTimeout(() => {
            mainWindow?.maximize();
            mainWindow?.show();
            if (loadingWindow) {
                loadingWindow?.close();
                loadingWindow = null;
            }
        }, 500);
    }
}

async function installExtensions() {
    try {
        const result = await installExtension(REACT_DEVELOPER_TOOLS);
        console.log(`Extensions installed successfully: ${result.name}`);
    } catch {
        console.error("Failed to install extensions");
    }
}

app.commandLine.appendSwitch("enable-experimental-web-platform-features");
app.whenReady().then(async () => {
    // Register IPC handler for loading completion
    ipcMain.on("app-loading-complete", () => {
        manuallyCompleted = true;
        tryShowMainWindow();
    });

    session.defaultSession.webRequest.onBeforeSendHeaders(
        (details, callback) => {
            details.requestHeaders["Origin"] = "https://relay-client/";
            details.requestHeaders["Referer"] = "https://relay-client/";
            callback({ requestHeaders: details.requestHeaders });
        },
    );

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};

        // Modify Set-Cookie headers to set SameSite=None for cross-site compatibility
        if (responseHeaders["set-cookie"]) {
            responseHeaders["set-cookie"] = responseHeaders["set-cookie"].map(
                (cookie) => {
                    let modifiedCookie = cookie.replace(
                        /;\s*SameSite=(Lax|Strict|None)/gi,
                        "",
                    );

                    modifiedCookie += "; SameSite=None";
                    if (!modifiedCookie.includes("Secure")) {
                        modifiedCookie += "; Secure";
                    }

                    return modifiedCookie;
                },
            );
        }

        callback({ responseHeaders });
    });

    protocol.handle(imageProtocolName, async (request) => {
        try {
            const url = new URL(request.url);
            const encodedPath = url.pathname.substring(1); // Remove leading slash
            const filePath = decodeURIComponent(encodedPath); // Decode URL-encoded characters

            // Verify file exists before reading
            if (!fs.existsSync(filePath)) {
                console.error(`File not found: ${filePath}`);
                return new Response("File not found", {
                    status: 404,
                    headers: { "content-type": "text/plain" },
                });
            }

            const stats = fs.statSync(filePath);
            const fileExt = path.extname(filePath).toLowerCase();

            // Special handling to ensure the file is actually accessible
            try {
                // Test file access before attempting to serve it
                await fs.promises.access(filePath, fs.constants.R_OK);
            } catch (accessError) {
                console.error(`File access error: ${accessError}`);
                return new Response("File access denied", {
                    status: 403,
                    headers: { "content-type": "text/plain" },
                });
            }

            if (isVideoFile(fileExt)) {
                return await handleVideoRequest(filePath, request, stats);
            } else if (isImageFile(fileExt)) {
                return await handleImageRequest(filePath, url, stats);
            } else {
                return new Response("Unsupported file type", {
                    status: 400,
                    headers: { "content-type": "text/plain" },
                });
            }
        } catch (error) {
            const errorPath =
                error && typeof error === "object" && "path" in error
                    ? error.path
                    : "unknown path";
            console.error("Failed to process file:", error, {
                path: errorPath,
            });
            return new Response("File processing failed", {
                status: 500,
                headers: { "content-type": "text/plain" },
            });
        }
    });

    // Register a dedicated video protocol handler optimized for video streaming
    protocol.handle(videoProtocolName, async (request) => {
        try {
            const url = new URL(request.url);
            const encodedPath = url.pathname.substring(1); // Remove leading slash
            const filePath = decodeURIComponent(encodedPath); // Decode URL-encoded characters

            // Verify file exists before reading
            if (!fs.existsSync(filePath)) {
                console.error(`Video not found: ${filePath}`);
                return new Response("Video file not found", {
                    status: 404,
                    headers: { "content-type": "text/plain" },
                });
            }

            const stats = fs.statSync(filePath);
            const fileExt = path.extname(filePath).toLowerCase();

            // Verify this is actually a video file
            if (!isVideoFile(fileExt)) {
                console.error(`Not a video file: ${filePath} (${fileExt})`);
                return new Response("Not a video file", {
                    status: 400,
                    headers: { "content-type": "text/plain" },
                });
            }

            // Use our dedicated video handler
            return await handleVideoRequest(filePath, request, stats);
        } catch (error) {
            console.error("Video protocol handler error:", error);
            return new Response("Video processing failed", {
                status: 500,
                headers: { "content-type": "text/plain" },
            });
        }
    });

    // First show loading window (if enabled), then create main window
    if (APP_CONFIG.useLoadingWindow) {
        createLoadingWindow();
    }
    createMainWindow();
    installExtensions();

    console.log("Running OG cache cleanup...");
    await ogCache.cleanupExpiredCache();
    const stats = await ogCache.getCacheStats();
    console.log(
        `OG cache stats: ${stats.totalFiles} files, ${(stats.totalSize / 1024).toFixed(2)} KB`,
    );

    // If loading window is disabled, show main window immediately when it's ready
    if (!APP_CONFIG.useLoadingWindow) {
        mainWindow?.once("ready-to-show", () => {
            mainWindow?.maximize();
            mainWindow?.show();
        });
    }
});

//osX only
app.on("window-all-closed", () => {
    cleanupFileWatchers();
    webSocketManager.disconnectAll();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", () => {
    cleanupFileWatchers();
    webSocketManager.disconnectAll();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createLoadingWindow();
        createMainWindow();
    }
});
//osX only ends
