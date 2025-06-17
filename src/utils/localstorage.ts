import { Channel, ServerInfo } from "@/api/server";

export interface LocalStorageItems {
    relay_failed_avatar_uploads: string[];
    "server-channel-data": Channel[];
    "server-panel-sizes": {
        channels: number;
        messages: number;
        members: number;
    };
    "server-status-cache": ServerInfo;
    "starred-images": string[];
}

export type LocalStorageKey = keyof LocalStorageItems;

export function setLocalStorageItem<K extends LocalStorageKey>(
    key: K,
    value: LocalStorageItems[K],
): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Error setting localStorage item "${key}":`, error);
    }
}

export function getLocalStorageItem<K extends LocalStorageKey>(
    key: K,
): LocalStorageItems[K] | null {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error(`Error getting localStorage item "${key}":`, error);
        return null;
    }
}

export function removeLocalStorageItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`Error removing localStorage item "${key}":`, error);
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
        console.error(`Error updating localStorage item "${key}":`, error);
    }
}
