import { ServerRecord } from "@/storage/server-store";
import {
    getLocalStorageItem,
    LocalStorageKey,
    updateLocalStorageItem,
} from "../localstorage";

export function starImage(
    imageUrl: string,
    starredImages: string[],
    serverRecord: ServerRecord,
) {
    const isLocal =
        serverRecord?.server_url && imageUrl.includes(serverRecord.server_url);
    const storageKey = isLocal
        ? `starred-images-${serverRecord?.server_url}`
        : "starred-images-global";

    const isCurrentlyStarred = starredImages.includes(imageUrl);

    updateLocalStorageItem(storageKey as LocalStorageKey, (current) => {
        const currentArray = (current as string[] | null) || [];
        if (isCurrentlyStarred) {
            return currentArray.filter((url: string) => url !== imageUrl);
        } else {
            return [...currentArray, imageUrl];
        }
    });

    return isCurrentlyStarred ? false : true;
}

export function getStarredImages(serverRecord: ServerRecord): string[] {
    const stored =
        getLocalStorageItem(`starred-images-${serverRecord?.server_url}`) || [];
    const globalStored = getLocalStorageItem("starred-images-global") || [];
    return [...new Set([...stored, ...globalStored])];
}
