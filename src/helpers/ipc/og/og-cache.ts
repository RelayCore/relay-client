import fs from "fs";
import path from "path";
import { app } from "electron";
import crypto from "crypto";

interface CachedOGData {
    title?: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
    url: string;
    cachedAt: number;
    lastAccessed: number;
}

export class OGCache {
    private cacheDir: string;
    private readonly maxAge = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

    constructor() {
        this.cacheDir = path.join(app.getPath("userData"), "og-cache");
        this.ensureCacheDir();
        this.cleanupExpiredCache();
    }

    private ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    private getUrlHash(url: string): string {
        return crypto.createHash("sha256").update(url).digest("hex");
    }

    private getCacheFilePath(url: string): string {
        const hash = this.getUrlHash(url);
        return path.join(this.cacheDir, `${hash}.json`);
    }

    private isExpired(cachedData: CachedOGData): boolean {
        const now = Date.now();
        return now - cachedData.lastAccessed > this.maxAge;
    }

    public async get(url: string): Promise<CachedOGData | null> {
        try {
            const filePath = this.getCacheFilePath(url);

            if (!fs.existsSync(filePath)) {
                return null;
            }

            const data = await fs.promises.readFile(filePath, "utf8");
            const cachedData: CachedOGData = JSON.parse(data);

            // Check if expired
            if (this.isExpired(cachedData)) {
                await this.delete(url);
                return null;
            }

            // Update last accessed time
            cachedData.lastAccessed = Date.now();
            await this.set(url, cachedData);

            return cachedData;
        } catch (error) {
            console.error("Error reading OG cache:", error);
            return null;
        }
    }

    public async set(
        url: string,
        ogData: Omit<CachedOGData, "cachedAt" | "lastAccessed"> | CachedOGData,
    ): Promise<void> {
        try {
            const filePath = this.getCacheFilePath(url);
            const now = Date.now();

            const cacheData: CachedOGData = {
                ...ogData,
                cachedAt: "cachedAt" in ogData ? ogData.cachedAt : now,
                lastAccessed: now,
            };

            await fs.promises.writeFile(
                filePath,
                JSON.stringify(cacheData, null, 2),
            );
        } catch (error) {
            console.error("Error writing OG cache:", error);
        }
    }

    public async delete(url: string): Promise<void> {
        try {
            const filePath = this.getCacheFilePath(url);
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        } catch (error) {
            console.error("Error deleting OG cache:", error);
        }
    }

    public async cleanupExpiredCache(): Promise<void> {
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            const jsonFiles = files.filter((file) => file.endsWith(".json"));

            for (const file of jsonFiles) {
                const filePath = path.join(this.cacheDir, file);
                try {
                    const data = await fs.promises.readFile(filePath, "utf8");
                    const cachedData: CachedOGData = JSON.parse(data);

                    if (this.isExpired(cachedData)) {
                        await fs.promises.unlink(filePath);
                        console.log(`Cleaned up expired OG cache: ${file}`);
                    }
                } catch (error) {
                    // If we can't read/parse the file, delete it
                    console.error(
                        `Error reading cache file ${file}, deleting:`,
                        error,
                    );
                    await fs.promises.unlink(filePath);
                }
            }
        } catch (error) {
            console.error("Error during OG cache cleanup:", error);
        }
    }

    public async getCacheStats(): Promise<{
        totalFiles: number;
        totalSize: number;
    }> {
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            const jsonFiles = files.filter((file) => file.endsWith(".json"));

            let totalSize = 0;
            for (const file of jsonFiles) {
                const filePath = path.join(this.cacheDir, file);
                const stats = await fs.promises.stat(filePath);
                totalSize += stats.size;
            }

            return {
                totalFiles: jsonFiles.length,
                totalSize,
            };
        } catch (error) {
            console.error("Error getting cache stats:", error);
            return { totalFiles: 0, totalSize: 0 };
        }
    }
}
