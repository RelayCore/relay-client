import { cn } from "@/utils/tailwind";
import React from "react";

export function UserAvatar({
    displayName,
    profilePictureUrl,
    className = "",
}: {
    displayName: string;
    profilePictureUrl?: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "bg-muted-foreground/20 h-8 w-8 overflow-hidden rounded-full",
                className,
            )}
        >
            {profilePictureUrl ? (
                <img
                    src={profilePictureUrl}
                    alt={displayName || "User Avatar"}
                    className="h-full w-full rounded-full object-cover"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-xs">
                    {displayName.substring(0, 2).toUpperCase()}
                </div>
            )}
        </div>
    );
}
