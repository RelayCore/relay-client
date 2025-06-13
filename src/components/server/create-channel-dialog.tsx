import React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Hash, Volume2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChannelGroup, createChannel } from "@/api/server";
import { useServerRecord } from "@/contexts/server-context";

export type ChannelType = "text" | "voice";

interface CreateChannelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    channelGroups: ChannelGroup[];
    onChannelCreated: () => void;
}

export default function CreateChannelDialog({
    open,
    onOpenChange,
    channelGroups,
    onChannelCreated,
}: CreateChannelDialogProps) {
    const serverRecord = useServerRecord();
    const [channelType, setChannelType] = React.useState<ChannelType>("text");
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>("");
    const [position, setPosition] = React.useState<string>("");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Reset form when dialog opens/closes
    React.useEffect(() => {
        if (!open) {
            setChannelType("text");
            setName("");
            setDescription("");
            setSelectedGroupId("");
            setPosition("");
            setError(null);
        } else if (channelGroups.length > 0 && !selectedGroupId) {
            setSelectedGroupId(channelGroups[0].id.toString());
        }
    }, [open, channelGroups, selectedGroupId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serverRecord || !name.trim() || !selectedGroupId) {
            setError("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const groupId = parseInt(selectedGroupId);
            const channelPosition = position ? parseInt(position) : undefined;

            await createChannel(serverRecord.server_url, serverRecord.user_id, {
                name: name.trim(),
                is_voice: channelType === "voice",
                description: description.trim(),
                group_id: groupId,
                position: channelPosition,
            });

            onChannelCreated();
            onOpenChange(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create channel",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const isValid = name.trim().length > 0 && selectedGroupId;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {channelType === "text" ? (
                            <Hash className="h-5 w-5" />
                        ) : (
                            <Volume2 className="h-5 w-5" />
                        )}
                        Create {channelType === "text" ? "Text" : "Voice"}{" "}
                        Channel
                    </DialogTitle>
                    <DialogDescription>
                        Create a new {channelType} channel in this server.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="channel-type">Channel Type</Label>
                        <Select
                            value={channelType}
                            onValueChange={(value: ChannelType) =>
                                setChannelType(value)
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="text">
                                    <div className="flex items-center gap-2">
                                        <Hash className="h-4 w-4" />
                                        Text Channel
                                    </div>
                                </SelectItem>
                                <SelectItem value="voice">
                                    <div className="flex items-center gap-2">
                                        <Volume2 className="h-4 w-4" />
                                        Voice Channel
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="channel-name">Channel Name *</Label>
                        <Input
                            id="channel-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="channel-name"
                            pattern="[a-z0-9-]+"
                            title="Channel names can only contain lowercase letters, numbers, and hyphens"
                            required
                        />
                        <p className="text-muted-foreground text-xs">
                            Names must be lowercase and can contain letters,
                            numbers, and hyphens
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="channel-description">Description</Label>
                        <Textarea
                            id="channel-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={`What's this ${channelType} channel about?`}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="channel-group">Category *</Label>
                        <Select
                            value={selectedGroupId}
                            onValueChange={setSelectedGroupId}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {channelGroups.map((group) => (
                                    <SelectItem
                                        key={group.id}
                                        value={group.id.toString()}
                                    >
                                        {group.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="channel-position">
                            Position (Optional)
                        </Label>
                        <Input
                            id="channel-position"
                            type="number"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            placeholder="0"
                            min="0"
                        />
                        <p className="text-muted-foreground text-xs">
                            Leave blank to add at the end
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!isValid || isSubmitting}
                        >
                            {isSubmitting ? "Creating..." : "Create Channel"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
