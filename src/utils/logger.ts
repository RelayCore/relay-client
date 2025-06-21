type Category = "api" | "websocket" | "electron" | "ui" | "cache" | "sync";

interface LogColors {
    [key: string]: string;
}

type CategoryColors = {
    [key in Category]: string;
};

type LogLevel =
    | "emergency"
    | "alert"
    | "critical"
    | "error"
    | "warning"
    | "info"
    | "debug"
    | "notice";

const LOG_COLORS: LogColors = {
    error: "#c50f1f",
    warning: "#c19c00",
};

const CATEGORY_COLORS: CategoryColors = {
    api: "#c19c00", // gold
    websocket: "#007acc", // blue
    electron: "#881798", // purple
    ui: "#13a10e", // green
    cache: "#ff6f00", // orange
    sync: "#e81123", // red
};

const DEFAULT_LOG_COLOR = "#881798";
const DEFAULT_CATEGORY_COLOR = "#13a10e";
const PREFIX = "relay";

function getBaseCSS(): string {
    return "color: white; padding: 2px 6px 2px 4px; font-weight: lighter; border-radius: 3px;";
}

function buildPrefixCSS(baseCSS: string, logColor: string): string {
    const textColor = getTextColorBasedOnBg(logColor);
    return `${baseCSS} background-color: ${logColor}; color: ${textColor};`;
}

function buildCategoryCSS(baseCSS: string, category: Category): string {
    const categoryColor =
        CATEGORY_COLORS[category.toLowerCase() as Category] ||
        DEFAULT_CATEGORY_COLOR;
    const textColor = getTextColorBasedOnBg(categoryColor);

    return `${baseCSS} background-color: ${categoryColor}; color: ${textColor}; border-radius: 0 3px 3px 0; margin-left: -5px;`;
}

function buildLogMessage(
    message: string,
    logLevel: LogLevel,
    category: Category | "",
): string[] {
    const baseCSS = getBaseCSS();
    const logColor = LOG_COLORS[logLevel] || DEFAULT_LOG_COLOR;
    const prefixCSS = buildPrefixCSS(baseCSS, logColor);

    if (category) {
        const categoryCSS = buildCategoryCSS(baseCSS, category);
        return [
            `%c${PREFIX}%c${category}`,
            prefixCSS.replace("6px", "10px"),
            categoryCSS,
            message,
        ];
    }

    return [`%c${PREFIX}`, prefixCSS, message];
}

function getLuminance(hexColor: string): number {
    // Convert hex to RGB
    const rgb = parseInt(hexColor.slice(1), 16); // Remove "#" and convert to integer
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    // Convert RGB to relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance;
}

function getTextColorBasedOnBg(backgroundColor: string): string {
    const luminance = getLuminance(backgroundColor);
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

export function log(
    message: string,
    type: LogLevel,
    category: Category | "" = "",
    detailMessage: string = "",
): void {
    const logLevel = type.toLowerCase() as LogLevel;
    const logArgs = buildLogMessage(message, logLevel, category);

    console.groupCollapsed(...logArgs);

    if (detailMessage.trim() !== "") {
        console.log(detailMessage);
    }

    console.trace();
    console.groupEnd();
}

export function logError(
    message: string,
    category?: Category,
    detailMessage?: string,
): void {
    return log(message, "error", category, detailMessage);
}

export function logWarning(
    message: string,
    category?: Category,
    detailMessage?: string,
): void {
    return log(message, "warning", category, detailMessage);
}

export function logInfo(
    message: string,
    category?: Category,
    detailMessage?: string,
): void {
    return log(message, "info", category, detailMessage);
}

export function logDebug(
    message: string,
    category?: Category,
    detailMessage?: string,
): void {
    return log(message, "debug", category, detailMessage);
}
