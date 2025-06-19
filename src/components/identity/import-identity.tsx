import React, { useState, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Camera, FileText, Users } from "lucide-react";
import {
    importUserIdentity,
    importAllIdentities,
    UserIdentity,
} from "@/storage/server-store";
import { toast } from "sonner";
import { logError } from "@/utils/logger";

interface ImportIdentityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onIdentitiesImported?: (identities: UserIdentity[]) => void;
}

export function ImportIdentityDialog({
    open,
    onOpenChange,
    onIdentitiesImported,
}: ImportIdentityDialogProps) {
    const [identityString, setIdentityString] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [importType, setImportType] = useState<"single" | "multiple">(
        "single",
    );
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImport = async () => {
        if (!identityString.trim()) {
            toast.error("Please enter an identity string");
            return;
        }

        setLoading(true);
        try {
            let identities: UserIdentity[];

            if (importType === "single") {
                const identity = await importUserIdentity(
                    identityString.trim(),
                );
                identities = [identity];
                toast.success("Identity imported successfully");
            } else {
                identities = await importAllIdentities(identityString.trim());
                toast.success(
                    `${identities.length} identities imported successfully`,
                );
            }

            onIdentitiesImported?.(identities);
            setIdentityString("");
            onOpenChange(false);
        } catch (error) {
            logError(
                "Failed to import identity",
                "api",
                error instanceof Error ? error.message : String(error),
            );
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to import identity",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setIdentityString(content);
            detectImportType(content);
        };
        reader.readAsText(file);
    };

    const onFileUpload = () => {
        fileInputRef.current?.click();
    };

    const detectImportType = (text: string) => {
        try {
            const decoded = JSON.parse(atob(text.trim()));
            if (Array.isArray(decoded)) {
                setImportType("multiple");
            } else {
                setImportType("single");
            }
        } catch {
            // Default to single if we can't determine
            setImportType("single");
        }
    };

    const handleTextChange = (value: string) => {
        setIdentityString(value);
        if (value.trim()) {
            detectImportType(value);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Identity</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="text" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="text">
                            <FileText className="mr-2 h-4 w-4" />
                            Text
                        </TabsTrigger>
                        <TabsTrigger value="qr">
                            <Camera className="mr-2 h-4 w-4" />
                            QR/File
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="text" className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Identity String
                            </label>
                            <Textarea
                                value={identityString}
                                onChange={(e) =>
                                    handleTextChange(e.target.value)
                                }
                                className="min-h-[120px] resize-none font-mono text-xs break-all"
                                placeholder="Paste your identity string here..."
                            />
                        </div>

                        {identityString && (
                            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                {importType === "single" ? (
                                    <>
                                        <Users className="h-4 w-4" />
                                        Single identity detected
                                    </>
                                ) : (
                                    <>
                                        <Users className="h-4 w-4" />
                                        Multiple identities detected
                                    </>
                                )}
                            </div>
                        )}

                        <Button
                            onClick={handleImport}
                            className="w-full"
                            disabled={loading || !identityString.trim()}
                        >
                            {loading ? (
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            {loading ? "Importing..." : "Import Identity"}
                        </Button>
                    </TabsContent>

                    <TabsContent value="qr" className="space-y-4">
                        <div className="space-y-4 text-center">
                            <p className="text-muted-foreground text-sm">
                                Upload a QR code image or text file containing
                                your identity
                            </p>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,.txt,.json"
                                onChange={handleFileUpload}
                                className="hidden"
                            />

                            <Button
                                onClick={onFileUpload}
                                variant="outline"
                                className="w-full"
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Upload File
                            </Button>

                            {identityString && (
                                <div className="space-y-2">
                                    <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
                                        {importType === "single" ? (
                                            <>
                                                <Users className="h-4 w-4" />
                                                Single identity loaded
                                            </>
                                        ) : (
                                            <>
                                                <Users className="h-4 w-4" />
                                                Multiple identities loaded
                                            </>
                                        )}
                                    </div>

                                    <Button
                                        onClick={handleImport}
                                        className="w-full"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                                        ) : (
                                            <Upload className="mr-2 h-4 w-4" />
                                        )}
                                        {loading
                                            ? "Importing..."
                                            : "Import Identity"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="text-muted-foreground text-xs">
                    <p>
                        You can import a single identity or multiple identities
                        at once. The type will be automatically detected.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
