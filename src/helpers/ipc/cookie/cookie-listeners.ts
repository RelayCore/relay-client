import { ipcMain, session } from "electron";
import {
    SET_COOKIE_CHANNEL,
    GET_COOKIE_CHANNEL,
    DELETE_COOKIE_CHANNEL,
} from "./cookie-channels";

export function addCookieEventListeners() {
    ipcMain.handle(SET_COOKIE_CHANNEL, async (_event, cookie) => {
        await session.defaultSession.cookies.set(cookie);
        return true;
    });

    ipcMain.handle(GET_COOKIE_CHANNEL, async (_event, details) => {
        const cookies = await session.defaultSession.cookies.get(details);
        return cookies;
    });

    ipcMain.handle(DELETE_COOKIE_CHANNEL, async (_event, url, name) => {
        await session.defaultSession.cookies.remove(url, name);
        return true;
    });
}
