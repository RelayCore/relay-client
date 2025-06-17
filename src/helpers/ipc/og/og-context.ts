import { FETCH_META_CHANNEL } from "./og-channels";

export function exposeOGContext() {
    const { contextBridge, ipcRenderer } = window.require("electron");
    contextBridge.exposeInMainWorld("ogAPI", {
        fetchMeta: (url: string) => ipcRenderer.invoke(FETCH_META_CHANNEL, url),
    });
}
