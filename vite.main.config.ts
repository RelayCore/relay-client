import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
    build: {
        rollupOptions: {
            external: [
                "update-electron-app",
                "electron-squirrel-startup",
                "@ghostery/adblocker-electron",
            ],
        },
        chunkSizeWarningLimit: 1600,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
