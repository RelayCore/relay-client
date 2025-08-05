import { log } from "@/utils/logger";
import QRCode from "qrcode";

let syncInterval: NodeJS.Timeout | null = null;

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
    identity_id: string;
    server_name?: string;
    server_description?: string;
    server_allow_invite?: boolean;
    server_max_users?: number;
    server_icon?: string;
    last_modified?: string;
}

export interface UserIdentity {
    identity_id: string;
    user_id: string;
    public_key: string;
    private_key: string;
    created_at: string;
    server_url: string;
}

export interface ServerIdentity {
    id: string; // uuid
    identity_id: string;
    account_id: string;
    public_key: string;
    private_key: string;
    server_url: string;
    created_at: string; // ISO timestamp
    updated_at: string; // ISO timestamp
}

/**
 * Convert a ServerIdentity to a UserIdentity.
 */
export function serverIdentityToUserIdentity(
    identity: ServerIdentity,
): UserIdentity {
    return {
        identity_id: identity.identity_id,
        user_id: identity.account_id,
        public_key: identity.public_key,
        private_key: identity.private_key,
        created_at: identity.created_at,
        server_url: identity.server_url,
    };
}

let serverCache: ServerRecord[] | null = null;
export async function initializeServerCache(): Promise<void> {
    if (serverCache === null) {
        serverCache = await loadServersFromDisk();
        // Ensure all servers have identity_id, generate and save if missing
        let updated = false;
        if (serverCache) {
            for (const server of serverCache) {
                if (!server.identity_id) {
                    server.identity_id = crypto.randomUUID();
                    updated = true;
                }
            }
            if (updated) {
                await saveServers(serverCache);
            }
        }
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
    const now = new Date().toISOString();
    for (const server of servers) {
        server.last_modified = now;
    }
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
        server.last_modified = new Date().toISOString();
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
        identity_id: server.identity_id ?? crypto.randomUUID(),
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
        // Ensure identity_id exists
        if (!identity.identity_id) {
            identity.identity_id = crypto.randomUUID();
        }
        return identity;
    } catch {
        throw new Error("Failed to import user identity");
    }
}

export async function exportAllIdentities(): Promise<string> {
    const servers = await loadServers();
    const identities: UserIdentity[] = servers.map((server) => ({
        identity_id: server.identity_id ?? crypto.randomUUID(),
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
            // Ensure identity_id exists
            if (!identity.identity_id) {
                identity.identity_id = crypto.randomUUID();
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
        identity_id: identity.identity_id ?? crypto.randomUUID(),
        server_name: serverMetadata?.name,
        server_description: serverMetadata?.description,
        server_allow_invite: serverMetadata?.allowInvite,
        server_max_users: serverMetadata?.maxUsers,
        server_icon: serverMetadata?.icon,
        last_modified: new Date().toISOString(),
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

function getAuthToken(): string | null {
    return localStorage.getItem("authToken");
}

/**
 * Fetch all identities from the server for the current session.
 */
export async function fetchServerIdentities(
    serverUrl: string,
): Promise<ServerIdentity[] | null> {
    const token = getAuthToken();
    if (!token) {
        return null;
    }

    const response = await fetch(`${serverUrl}/api/identity`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch identities: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Create a new identity on the server for the current session.
 */
export async function createServerIdentity(
    serverUrl: string,
    identity: UserIdentity,
): Promise<ServerIdentity | null> {
    const token = getAuthToken();
    if (!token) {
        return null;
    }

    const response = await fetch(`${serverUrl}/api/identity`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            identity_id: identity.identity_id,
            public_key: identity.public_key,
            private_key: identity.private_key,
            server_url: identity.server_url,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to create identity: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Update an identity on the server for the current session.
 */
export async function updateServerIdentity(
    serverUrl: string,
    identity_id: string,
    updates: UserIdentity,
): Promise<ServerIdentity | null> {
    const token = getAuthToken();
    if (!token) {
        return null;
    }

    const response = await fetch(`${serverUrl}/api/identity/${identity_id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            public_key: updates.public_key,
            private_key: updates.private_key,
            server_url: updates.server_url,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to update identity: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Delete an identity from the server for the current session.
 */
export async function deleteServerIdentity(
    serverUrl: string,
    identity_id: string,
): Promise<void | null> {
    const token = getAuthToken();
    if (!token) {
        return null;
    }

    const response = await fetch(`${serverUrl}/api/identity/${identity_id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to delete identity: ${response.statusText}`);
    }
}

/**
 * Get a specific identity by identity_id from the server for the current session.
 */
export async function fetchServerIdentityById(
    serverUrl: string,
    identity_id: string,
): Promise<ServerIdentity | null> {
    const token = getAuthToken();
    if (!token) {
        return null;
    }

    const response = await fetch(`${serverUrl}/api/identity/${identity_id}`, {
        credentials: "include",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch identity: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Helper to compare ISO date strings.
 * Returns true if a is newer than b.
 */
function isNewer(a?: string, b?: string): boolean {
    if (!a) return false;
    if (!b) return true;
    return new Date(a).getTime() > new Date(b).getTime();
}

/**
 * Pull all identities from the server and update/add to local storage if server is newer.
 */
export async function pullServerIdentitiesToLocal(
    serverUrl: string,
): Promise<void> {
    const serverIdentities = await fetchServerIdentities(serverUrl);
    if (!serverIdentities) {
        log("Failed to fetch server identities", "error", "sync");
        return;
    }
    const localServers = await loadServers();
    const localById = new Map(localServers.map((s) => [s.identity_id, s]));

    log(
        "Found identities on server",
        "info",
        "sync",
        JSON.stringify(serverIdentities, null, 2),
    );

    for (const identity of serverIdentities) {
        const local = localById.get(identity.identity_id);
        const serverUpdatedAt = identity.updated_at || identity.created_at;
        const localLastModified = local?.last_modified;

        if (!local) {
            // Use the conversion helper
            await restoreIdentityToServer(
                serverIdentityToUserIdentity(identity),
                identity.server_url,
            );
        } else if (isNewer(serverUpdatedAt, localLastModified)) {
            await removeServer(identity.server_url, local.user_id);
            await restoreIdentityToServer(
                serverIdentityToUserIdentity(identity),
                identity.server_url,
            );
        }
    }
}

/**
 * Push all local identities to the server, updating or creating as needed.
 */
export async function pushLocalIdentitiesToServer(
    serverUrl: string,
): Promise<void> {
    const localServers = await loadServers();
    const serverIdentities = await fetchServerIdentities(serverUrl);
    if (!serverIdentities) {
        log("Failed to fetch server identities", "error", "sync");
        return;
    }

    const serverById = new Map(serverIdentities.map((i) => [i.identity_id, i]));

    log(
        "Found identities locally",
        "info",
        "sync",
        JSON.stringify(localServers, null, 2),
    );

    for (const local of localServers) {
        const server = serverById.get(local.identity_id);
        const serverUpdatedAt = server?.updated_at || server?.created_at;
        const localLastModified = local.last_modified;

        const localUserIdentity: UserIdentity = {
            identity_id: local.identity_id,
            user_id: local.user_id,
            public_key: local.public_key,
            private_key: local.private_key,
            created_at: local.joined_at,
            server_url: local.server_url,
        };

        if (!server) {
            await createServerIdentity(serverUrl, localUserIdentity);
        } else if (isNewer(localLastModified, serverUpdatedAt)) {
            await updateServerIdentity(
                serverUrl,
                local.identity_id,
                localUserIdentity,
            );
        }
    }
}

/**
 * Two-way sync: ensures both local and server have the latest version of each identity.
 */
export async function syncIdentitiesWithServer(
    serverUrl: string,
): Promise<void> {
    log("Syncing identities with server", "info", "sync");
    await pushLocalIdentitiesToServer(serverUrl);
}

/**
 * Start the identity sync scheduler that runs on startup and every hour.
 */
export function startIdentitySyncScheduler(serverUrl: string): void {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    syncIdentitiesWithServer(serverUrl);

    // Set up hourly sync
    syncInterval = setInterval(
        () => {
            syncIdentitiesWithServer(serverUrl);
        },
        60 * 60 * 1000,
    ); // 1 hour in milliseconds
}

/**
 * Stop the identity sync scheduler.
 */
export function stopIdentitySyncScheduler(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}
