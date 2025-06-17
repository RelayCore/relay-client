import { inDevelopment } from "@/config";

export function assetSrc(path: string) {
    if (!path.startsWith("/")) {
        path = `/${path}`;
    }
    if (!path.startsWith("/assets")) {
        path = `/assets${path}`;
    }

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

export async function downloadFile(fileUrl: string, fileName: string) {
    try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        window.URL.revokeObjectURL(url);
    } catch (fetchError) {
        console.error("Download failed:", fetchError);
        // Fallback: open in new tab
        window.open(fileUrl, "_blank");
    }
}
