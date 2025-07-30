import { ipcMain } from "electron";
// @ts-expect-error - node-fetch CommonJS/ESM compatibility issue
import fetch from "node-fetch";
import { parse } from "node-html-parser";
import { FETCH_META_CHANNEL } from "./og-channels";
import { OGCache } from "./og-cache";

const ogCache = new OGCache();

function extractMetaTags(html: string, url: string): OGData {
    try {
        const root = parse(html);

        // Helper function to get meta content
        const getMeta = (
            property: string,
            attribute: string = "property",
        ): string => {
            const element = root.querySelector(
                `meta[${attribute}="${property}"]`,
            );
            if (element) return element.getAttribute("content") || "";

            const metas = root.querySelectorAll("meta");
            for (const meta of metas) {
                const attrVal = meta.getAttribute(attribute);
                if (
                    attrVal &&
                    attrVal.toLowerCase() === property.toLowerCase()
                ) {
                    return meta.getAttribute("content") || "";
                }
            }
            return "";
        };

        // Get Open Graph data
        const title =
            getMeta("og:title") ||
            getMeta("twitter:title") ||
            root.querySelector("title")?.text ||
            "";

        const description =
            getMeta("og:description") ||
            getMeta("twitter:description") ||
            getMeta("description", "name") ||
            "";

        const imageUrl = getMeta("og:image") || getMeta("twitter:image") || "";

        const siteName =
            getMeta("og:site_name") ||
            getMeta("twitter:site") ||
            new URL(url).hostname;

        const themeColor =
            getMeta("theme-color", "name") ||
            getMeta("theme-color", "property");

        return {
            title: title.trim(),
            description: description.trim(),
            imageUrl: imageUrl.trim(),
            siteName: siteName.trim(),
            themeColor: themeColor.trim(),
            url,
        };
    } catch (error) {
        console.error("Error parsing HTML:", error);
        return { url };
    }
}

async function fetchOGDataFromNetwork(url: string): Promise<OGData> {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
        throw new Error("Invalid protocol");
    }

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            DNT: "1",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        },
        follow: 5,
        size: 1024 * 1024,
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
        throw new Error("Not an HTML page");
    }

    const html = await response.text();
    return extractMetaTags(html, url);
}

export function addOGEventListeners() {
    ipcMain.handle(
        FETCH_META_CHANNEL,
        async (event, url: string): Promise<OGData> => {
            try {
                // First, try to get from cache
                const cachedData = await ogCache.get(url);
                if (cachedData) {
                    console.log(`OG data cache hit for: ${url}`);
                    return {
                        title: cachedData.title,
                        description: cachedData.description,
                        imageUrl: cachedData.imageUrl,
                        siteName: cachedData.siteName,
                        themeColor: cachedData.themeColor,
                        url: cachedData.url,
                    };
                }

                console.log(
                    `OG data cache miss, fetching from network: ${url}`,
                );

                // If not in cache, fetch from network
                const ogData = await fetchOGDataFromNetwork(url);

                // Cache the result
                await ogCache.set(url, ogData);

                return ogData;
            } catch (error) {
                console.error("Error fetching meta data:", error);
                throw error;
            }
        },
    );
}

export { ogCache };
