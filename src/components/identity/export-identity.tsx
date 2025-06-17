import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, Eye, EyeOff } from "lucide-react";
import {
    exportUserIdentity,
    exportUserIdentityAsQR,
} from "@/storage/server-store";
import { toast } from "sonner";

interface ExportIdentityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    serverUrl: string;
    userId: string;
}

export function ExportIdentityDialog({
    open,
    onOpenChange,
    serverUrl,
    userId,
}: ExportIdentityDialogProps) {
    const [identityString, setIdentityString] = useState<string>("");
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [showQrCode, setShowQrCode] = useState(false);
    const [showText, setShowText] = useState(false);

    useEffect(() => {
        if (open) {
            generateIdentityData();
            // Reset visibility when dialog opens
            setShowQrCode(false);
            setShowText(false);
        }
    }, [open, serverUrl, userId]);

    const generateIdentityData = async () => {
        setLoading(true);
        try {
            const [identity, qrCode] = await Promise.all([
                exportUserIdentity(serverUrl, userId),
                exportUserIdentityAsQR(serverUrl, userId),
            ]);

            setIdentityString(identity);
            setQrCodeDataUrl(qrCode);
        } catch (error) {
            console.error("Failed to generate identity data:", error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(identityString);
            toast.success("Copied to clipboard");
        } catch (error) {
            console.error("Failed to copy to clipboard:", error);
            toast.error("Failed to copy to clipboard");
        }
    };

    const downloadQRCode = () => {
        const link = document.createElement("a");
        link.download = `relay-identity-${userId.substring(0, 8)}.png`;
        link.href = qrCodeDataUrl;
        link.click();
    };

    const downloadTextFile = () => {
        const blob = new Blob([identityString], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `relay-identity-${userId.substring(0, 8)}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Export Identity</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm text-amber-800">
                                ⚠️ Keep this export data secure. Anyone with
                                access can impersonate your identity.
                            </p>
                        </div>

                        <Tabs defaultValue="qr" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="qr">QR Code</TabsTrigger>
                                <TabsTrigger value="text">Text</TabsTrigger>
                            </TabsList>

                            <TabsContent value="qr" className="space-y-4">
                                <div className="flex flex-col items-center space-y-4">
                                    {!showQrCode ? (
                                        <div className="flex flex-col items-center space-y-4 rounded-lg border-2 border-dashed p-8">
                                            <EyeOff className="text-muted-foreground h-12 w-12" />
                                            <p className="text-muted-foreground text-center">
                                                QR code is hidden for security
                                            </p>
                                            <Button
                                                onClick={() =>
                                                    setShowQrCode(true)
                                                }
                                                variant="outline"
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                Show QR Code
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            {qrCodeDataUrl && (
                                                <img
                                                    src={qrCodeDataUrl}
                                                    alt="Identity QR Code"
                                                    className="rounded-lg border"
                                                />
                                            )}
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() =>
                                                        setShowQrCode(false)
                                                    }
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <EyeOff className="mr-2 h-4 w-4" />
                                                    Hide
                                                </Button>
                                                <Button
                                                    onClick={downloadQRCode}
                                                    size="sm"
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Download
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                    <p className="text-center text-sm text-gray-600">
                                        Scan this QR code with another device to
                                        import your identity
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="text" className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        Identity String
                                    </label>
                                    {!showText ? (
                                        <div className="flex min-h-[100px] flex-col items-center justify-center space-y-4 rounded-lg border-2 border-dashed p-8">
                                            <EyeOff className="text-muted-foreground h-8 w-8" />
                                            <p className="text-muted-foreground text-center">
                                                Identity data is hidden for
                                                security
                                            </p>
                                            <Button
                                                onClick={() =>
                                                    setShowText(true)
                                                }
                                                variant="outline"
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                Show Identity Data
                                            </Button>
                                        </div>
                                    ) : (
                                        <Textarea
                                            value={identityString}
                                            readOnly
                                            className="min-h-[100px] resize-none font-mono text-xs break-all"
                                            placeholder="Loading..."
                                        />
                                    )}
                                </div>
                                {showText && (
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => setShowText(false)}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            <EyeOff className="mr-2 h-4 w-4" />
                                            Hide
                                        </Button>
                                        <Button
                                            onClick={copyToClipboard}
                                            className="flex-1"
                                        >
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy
                                        </Button>
                                        <Button
                                            onClick={downloadTextFile}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            <Download className="mr-2 h-4 w-4" />
                                            Download
                                        </Button>
                                    </div>
                                )}
                                <p className="text-sm text-gray-600">
                                    Copy this string and paste it when joining
                                    from another device
                                </p>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
