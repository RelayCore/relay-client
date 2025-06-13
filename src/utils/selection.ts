import { ShortcutOptions, useShortcut } from "@/hooks/use-shortcut";
import { useSetting } from "@/utils/settings";
import { Dispatch, SetStateAction } from "react";

export function isInteractive(target: HTMLElement): boolean {
    if (!target) return false;
    return !target.closest(
        'button, [role="button"], a, input, select, p, h1, h2, h3, h4, h5, h6, textarea, [contenteditable="true"]',
    );
}

export function useSelectionShortcuts<T>(
    items: T[],
    selectedItems: T[],
    setSelectedItems: Dispatch<SetStateAction<T[]>>,
    options: ShortcutOptions = { preventDefault: true },
) {
    // Select all items
    useShortcut(
        useSetting("selectAll"),
        () => {
            setSelectedItems([...items]);
        },
        options,
    );

    // Clear selection
    useShortcut(
        useSetting("selectNone"),
        () => {
            setSelectedItems([]);
        },
        options,
    );

    // Invert selection
    useShortcut(
        useSetting("selectInvert"),
        () => {
            const newSelectedItems = items.filter(
                (item) => !selectedItems.includes(item),
            );
            setSelectedItems(newSelectedItems);
        },
        options,
    );
}
