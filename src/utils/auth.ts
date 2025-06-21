import { createAuthClient } from "better-auth/react";

let currentBaseURL: string | null = localStorage.getItem("authBaseURL");
let authClient: ReturnType<typeof createAuthClient> | null = null;

if (currentBaseURL) {
    authClient = createAuthClient({
        baseURL: currentBaseURL,
        fetchOptions: {
            credentials: "include",
        },
    });
}

export function setAuthBaseURL(newBaseURL: string | null) {
    if (newBaseURL !== currentBaseURL) {
        currentBaseURL = newBaseURL;
        if (newBaseURL) {
            localStorage.setItem("authBaseURL", newBaseURL);
            authClient = createAuthClient({
                baseURL: newBaseURL,
                fetchOptions: {
                    credentials: "include",
                },
            });
        } else {
            localStorage.removeItem("authBaseURL");
            authClient = null;
        }
    }
    return authClient;
}

export function getAuthClient(): typeof authClient | null {
    return authClient;
}
