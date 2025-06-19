import QRCode from "qrcode";

const getFilePath = async (): Promise<string> => {
    const systemPaths = await window.fileSystem.getSystemPaths();
    return `${systemPaths.data?.userData}/servers.json`;
};

export interface ServerRecord {
    server_url: string;
    username: string;
    nickname: string;
    user_id: string;
    public_key: string;
    private_key: string;
    joined_at: string;
    server_name?: string;
    server_description?: string;
    server_allow_invite?: boolean;
    server_max_users?: number;
    server_icon?: string;
}

export interface UserIdentity {
    user_id: string;
    public_key: string;
    private_key: string;
    created_at: string;
    server_url: string;
}

let serverCache: ServerRecord[] | null = null;
export async function initializeServerCache(): Promise<void> {
    if (serverCache === null) {
        serverCache = await loadServersFromDisk();
    }
}

async function loadServersFromDisk(): Promise<ServerRecord[]> {
    const filePath = await getFilePath();
    const exists = await window.fileSystem.fileExists(filePath);
    if (!exists) return [];
    const result = await window.fileSystem.readFile(filePath, "utf8");
    if (!result.success || !result.data) return [];
    return JSON.parse(result.data as string);
}

export async function loadServers(): Promise<ServerRecord[]> {
    await initializeServerCache();
    return [...(serverCache || [])]; // Return a copy to prevent external mutations
}

export async function saveServers(servers: ServerRecord[]) {
    const filePath = await getFilePath();
    await window.fileSystem.writeFile(
        filePath,
        JSON.stringify(servers, null, 2),
        "utf8",
    );
    serverCache = [...servers];
}

export async function addServer(server: ServerRecord) {
    await initializeServerCache();
    const existing = serverCache?.find(
        (s) =>
            s.server_url === server.server_url && s.user_id === server.user_id,
    );
    if (!existing && serverCache) {
        serverCache.push(server);
        await saveServers(serverCache);
        // Trigger a custom event to notify components that servers have changed
        window.dispatchEvent(new CustomEvent("servers-updated"));
    }
}

export async function getServerById(userId: string): Promise<ServerRecord> {
    await initializeServerCache();
    const server = serverCache?.find((s) => s.user_id === userId);
    if (!server) {
        throw new Error(`Server with user ID ${userId} not found`);
    }
    return server;
}

export async function removeServer(serverUrl: string, userId: string) {
    await initializeServerCache();
    if (serverCache) {
        serverCache = serverCache.filter(
            (s) => !(s.server_url === serverUrl && s.user_id === userId),
        );
        await saveServers(serverCache);
        // Trigger a custom event to notify components that servers have changed
        window.dispatchEvent(new CustomEvent("servers-updated"));
    }
}

export async function exportUserIdentity(
    serverUrl: string,
    userId: string,
): Promise<string> {
    const server = await getServerById(userId);
    const identity: UserIdentity = {
        user_id: server.user_id,
        public_key: server.public_key,
        private_key: server.private_key,
        created_at: server.joined_at,
        server_url: server.server_url,
    };

    // Return as base64 encoded string that user can copy
    return btoa(JSON.stringify(identity));
}

export async function exportUserIdentityAsQR(
    serverUrl: string,
    userId: string,
): Promise<string> {
    const identityString = await exportUserIdentity(serverUrl, userId);
    const qrCodeDataUrl = await QRCode.toDataURL(identityString, {
        errorCorrectionLevel: "M",
        type: "image/png",
        margin: 1,
        color: {
            dark: "#000000",
            light: "#FFFFFF",
        },
    });

    return qrCodeDataUrl;
}

export async function importUserIdentity(
    identityString: string,
): Promise<UserIdentity> {
    try {
        const identity = JSON.parse(atob(identityString)) as UserIdentity;
        // Validate the identity structure
        if (
            !identity.user_id ||
            !identity.public_key ||
            !identity.private_key ||
            !identity.server_url
        ) {
            throw new Error("Invalid identity format");
        }
        return identity;
    } catch {
        throw new Error("Failed to import user identity");
    }
}

export async function exportAllIdentities(): Promise<string> {
    const servers = await loadServers();
    const identities: UserIdentity[] = servers.map((server) => ({
        user_id: server.user_id,
        public_key: server.public_key,
        private_key: server.private_key,
        created_at: server.joined_at,
        server_url: server.server_url,
    }));

    // Return as base64 encoded string that user can copy
    return btoa(JSON.stringify(identities));
}

export async function exportAllIdentitiesAsQR(): Promise<string> {
    const identityString = await exportAllIdentities();
    const qrCodeDataUrl = await QRCode.toDataURL(identityString, {
        errorCorrectionLevel: "M",
        type: "image/png",
        margin: 1,
        color: {
            dark: "#000000",
            light: "#FFFFFF",
        },
    });

    return qrCodeDataUrl;
}

export async function exportAllIdentitiesAsQRSVG(): Promise<string> {
    const identityString = await exportAllIdentities();
    const qrCodeSVG = await QRCode.toString(identityString, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        color: {
            dark: "#000000",
            light: "#FFFFFF",
        },
        width: 256,
    });

    return qrCodeSVG;
}

export async function importAllIdentities(
    identityString: string,
): Promise<UserIdentity[]> {
    try {
        const identities = JSON.parse(atob(identityString)) as UserIdentity[];
        // Validate each identity structure
        for (const identity of identities) {
            if (
                !identity.user_id ||
                !identity.public_key ||
                !identity.private_key ||
                !identity.server_url
            ) {
                throw new Error("Invalid identity format");
            }
        }
        return identities;
    } catch {
        throw new Error("Failed to import identities");
    }
}

export async function restoreIdentityToServer(
    identity: UserIdentity,
    serverUrl?: string,
    serverMetadata?: {
        name?: string;
        description?: string;
        icon?: string;
        allowInvite?: boolean;
        maxUsers?: number;
    },
): Promise<ServerRecord> {
    // Use the provided serverUrl or fall back to the one in the identity
    const targetServerUrl = serverUrl || identity.server_url;

    // Create a server record from the identity
    const serverRecord: ServerRecord = {
        server_url: targetServerUrl,
        username: `user-${identity.user_id.substring(0, 8)}`, // Default username
        nickname: `User ${identity.user_id.substring(0, 8)}`, // Default nickname
        user_id: identity.user_id,
        public_key: identity.public_key,
        private_key: identity.private_key,
        joined_at: identity.created_at,
        server_name: serverMetadata?.name,
        server_description: serverMetadata?.description,
        server_allow_invite: serverMetadata?.allowInvite,
        server_max_users: serverMetadata?.maxUsers,
        server_icon: serverMetadata?.icon,
    };

    await addServer(serverRecord);
    return serverRecord;
}

export async function findExistingServersForIdentities(
    identities: UserIdentity[],
): Promise<Map<string, ServerRecord[]>> {
    const servers = await loadServers();
    const identityToServers = new Map<string, ServerRecord[]>();

    for (const identity of identities) {
        const matchingServers = servers.filter(
            (s) => s.user_id === identity.user_id,
        );
        if (matchingServers.length > 0) {
            identityToServers.set(identity.user_id, matchingServers);
        }
    }

    return identityToServers;
}

export async function getNewIdentities(
    identities: UserIdentity[],
): Promise<UserIdentity[]> {
    const servers = await loadServers();
    const existingUserIds = new Set(servers.map((s) => s.user_id));

    return identities.filter(
        (identity) => !existingUserIds.has(identity.user_id),
    );
}
