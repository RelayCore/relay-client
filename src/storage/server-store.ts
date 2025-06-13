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

export async function loadServers(): Promise<ServerRecord[]> {
    const filePath = await getFilePath();
    const exists = await window.fileSystem.fileExists(filePath);
    if (!exists) return [];
    const result = await window.fileSystem.readFile(filePath, "utf8");
    if (!result.success || !result.data) return [];
    return JSON.parse(result.data as string);
}

export async function saveServers(servers: ServerRecord[]) {
    const filePath = await getFilePath();
    await window.fileSystem.writeFile(
        filePath,
        JSON.stringify(servers, null, 2),
        "utf8",
    );
}

export async function addServer(server: ServerRecord) {
    const servers = await loadServers();
    const existing = servers.find(
        (s) =>
            s.server_url === server.server_url && s.user_id === server.user_id,
    );
    if (!existing) {
        servers.push(server);
        await saveServers(servers);
        // Trigger a custom event to notify components that servers have changed
        window.dispatchEvent(new CustomEvent("servers-updated"));
    }
}

export async function getServerById(userId: string): Promise<ServerRecord> {
    const servers = await loadServers();
    const server = servers.find((s) => s.user_id === userId);
    if (!server) {
        throw new Error(`Server with user ID ${userId} not found`);
    }
    return server;
}

export async function removeServer(serverUrl: string, userId: string) {
    const servers = await loadServers();
    const filteredServers = servers.filter(
        (s) => !(s.server_url === serverUrl && s.user_id === userId),
    );
    await saveServers(filteredServers);
    // Trigger a custom event to notify components that servers have changed
    window.dispatchEvent(new CustomEvent("servers-updated"));
}
