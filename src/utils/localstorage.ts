import { Channel, ServerInfo } from "@/api/server";
import { logError } from "@/utils/logger";

export interface LocalStorageItems {
    relay_failed_avatar_uploads: string[];
    "server-channel-data": Channel[];
    "server-panel-sizes": {
        channels: number;
        messages: number;
        members: number;
    };
    "server-status-cache": ServerInfo;
    "starred-images-global": string[];
    [key: `starred-images-${string}`]: string[];
}

export type LocalStorageKey = keyof LocalStorageItems;

export function setLocalStorageItem<K extends LocalStorageKey>(
    key: K,
    value: LocalStorageItems[K],
): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        logError(
            `Error setting localStorage item "${key}"`,
            "cache",
            String(error),
        );
    }
}

export function getLocalStorageItem<K extends LocalStorageKey>(
    key: K,
): LocalStorageItems[K] | null {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        logError(
            `Error getting localStorage item "${key}"`,
            "cache",
            String(error),
        );
        return null;
    }
}

export function removeLocalStorageItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        logError(
            `Error removing localStorage item "${key}"`,
            "cache",
            String(error),
        );
    }
}

export function updateLocalStorageItem<K extends LocalStorageKey>(
    key: K,
    updater: (value: LocalStorageItems[K] | null) => LocalStorageItems[K],
): void {
    try {
        const currentValue = getLocalStorageItem(key);
        const newValue = updater(currentValue);
        setLocalStorageItem(key, newValue);
    } catch (error) {
        logError(
            `Error updating localStorage item "${key}"`,
            "cache",
            String(error),
        );
    }
}
