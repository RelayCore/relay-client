import {
    SET_COOKIE_CHANNEL,
    GET_COOKIE_CHANNEL,
    DELETE_COOKIE_CHANNEL,
} from "./cookie-channels";

export function exposeCookieContext() {
    const { contextBridge, ipcRenderer } = window.require("electron");
    contextBridge.exposeInMainWorld("cookieAPI", {
        set: (cookie: Electron.CookiesSetDetails) =>
            ipcRenderer.invoke(SET_COOKIE_CHANNEL, cookie),
        get: (details: Electron.CookiesGetFilter) =>
            ipcRenderer.invoke(GET_COOKIE_CHANNEL, details),
        delete: (url: string, name: string) =>
            ipcRenderer.invoke(DELETE_COOKIE_CHANNEL, url, name),
    });
}
