import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Server } from "lucide-react";
import { setAuthBaseURL } from "@/utils/auth";
import { toast } from "sonner";

interface IdentitySyncSignInProps {
    onSignInSuccess?: (serverUrl: string) => void;
    onCancel?: () => void;
}

export function IdentitySyncSignIn({
    onSignInSuccess,
    onCancel,
}: IdentitySyncSignInProps) {
    const [serverUrl, setServerUrl] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSigningIn(true);

        try {
            // Validate inputs
            if (!serverUrl.trim()) {
                throw new Error("Server URL is required");
            }
            if (!email.trim()) {
                throw new Error("Email is required");
            }
            if (!password.trim()) {
                throw new Error("Password is required");
            }

            // Normalize server URL
            let normalizedUrl = serverUrl.trim();
            if (
                !normalizedUrl.startsWith("http://") &&
                !normalizedUrl.startsWith("https://")
            ) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            // Remove trailing slash
            normalizedUrl = normalizedUrl.replace(/\/$/, "");

            // Set up auth client with the server URL
            const authClient = setAuthBaseURL(normalizedUrl);

            if (!authClient) {
                throw new Error("Failed to initialize auth client");
            }

            // Attempt to sign in
            const result = await authClient.signIn.email({
                email: email.trim(),
                password: password.trim(),
            });

            if (result.error) {
                throw new Error(result.error.message || "Sign in failed");
            }

            if (!result.data) {
                throw new Error("Sign in failed - no data returned");
            }

            // Store the successful auth URL
            localStorage.setItem("authBaseURL", normalizedUrl);

            toast.success("Successfully signed in to identity sync server");
            onSignInSuccess?.(normalizedUrl);
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred";
            setError(errorMessage);
            toast.error(`Sign in failed: ${errorMessage}`);
        } finally {
            setIsSigningIn(false);
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    <CardTitle>Identity Sync Sign In</CardTitle>
                </div>
                <CardDescription>
                    Sign in to your identity sync server to manage your
                    identities across devices
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="serverUrl">Server URL</Label>
                        <Input
                            id="serverUrl"
                            type="url"
                            placeholder="https://your-server.com"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            disabled={isSigningIn}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isSigningIn}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isSigningIn}
                            required
                        />
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex gap-2 pt-2">
                        {onCancel && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                disabled={isSigningIn}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                        )}
                        <Button
                            type="submit"
                            disabled={isSigningIn}
                            className="flex-1"
                        >
                            {isSigningIn && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Sign In
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
