import { inDevelopment } from "@/config";

export function assetSrc(path: string) {
    if (inDevelopment) {
        return `/src${path}`;
    } else {
        return `../../../..${path}`;
    }
}
export function isVideoFile(fileExt: string): boolean {
    return [".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(fileExt);
}

export function isImageFile(fileExt: string): boolean {
    return [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(fileExt);
}
