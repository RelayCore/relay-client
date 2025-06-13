import React from "react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/use-settings";
import { createAllSettingsMaps, renderInput, Setting } from "@/utils/settings";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import pkg from "../../package.json";
import { assetSrc } from "@/utils/assets";
import { APP_CONFIG } from "@/config";

import { MicrophoneTest } from "@/components/settings/microphone-test";

interface HierarchicalGroup {
    settings: Record<string, Setting>;
    subgroups: Record<string, Record<string, Setting>>;
}

export default function SettingsPage() {
    const { settings, setSettings } = useSettings();
    const settingsMaps = createAllSettingsMaps(settings, setSettings);
    const appVersion = pkg.version;
    const description = pkg.description;

    // State for audio devices
    const [audioDevices, setAudioDevices] = React.useState<{
        input: MediaDeviceInfo[];
        output: MediaDeviceInfo[];
    }>({ input: [], output: [] });

    // Load audio devices on component mount
    React.useEffect(() => {
        const loadAudioDevices = async () => {
            try {
                // Request permissions first
                await navigator.mediaDevices.getUserMedia({ audio: true });

                const devices = await navigator.mediaDevices.enumerateDevices();
                const inputDevices = devices.filter(
                    (device) => device.kind === "audioinput",
                );
                const outputDevices = devices.filter(
                    (device) => device.kind === "audiooutput",
                );

                setAudioDevices({
                    input: inputDevices,
                    output: outputDevices,
                });
            } catch (error) {
                console.error("Failed to enumerate audio devices:", error);
            }
        };

        loadAudioDevices();

        // Listen for device changes
        const handleDeviceChange = () => {
            loadAudioDevices();
        };

        navigator.mediaDevices.addEventListener(
            "devicechange",
            handleDeviceChange,
        );
        return () => {
            navigator.mediaDevices.removeEventListener(
                "devicechange",
                handleDeviceChange,
            );
        };
    }, []);

    // Custom renderers for special settings
    const customRenderers = {
        inputDevice: (
            <Select
                value={settings.inputDevice as string}
                onValueChange={(value) => {
                    setSettings({
                        ...settings,
                        inputDevice: value as never,
                    });
                }}
            >
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select input device" />
                </SelectTrigger>
                <SelectContent>
                    {audioDevices.input.map((device) => (
                        <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                        >
                            {device.label ||
                                `Microphone ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        ),
        outputDevice: (
            <Select
                value={settings.outputDevice as string}
                onValueChange={(value) => {
                    setSettings({
                        ...settings,
                        outputDevice: value as never,
                    });
                }}
            >
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select output device" />
                </SelectTrigger>
                <SelectContent>
                    {audioDevices.output.map((device) => (
                        <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                        >
                            {device.label ||
                                `Speaker ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        ),
        testMicrophone: <MicrophoneTest />,
        appInfo: (
            <div className="space-y-8">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <img
                            src={assetSrc("/assets/icons/Icon.png")}
                            className="h-12 w-12"
                        />
                        <div>
                            <h3 className="text-2xl font-bold">
                                {APP_CONFIG.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                    Version {appVersion}
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className="text-muted-foreground">{description}</p>
                </div>

                <div className="space-y-3">
                    <h4 className="font-medium">Links</h4>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                        <a
                            href={`https://github.com/${APP_CONFIG.repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="lucide lucide-github h-4 w-4"
                                    aria-hidden="true"
                                >
                                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                                    <path d="M9 18c-4.51 2-5-2-7-2"></path>
                                </svg>
                                GitHub Repository
                            </Button>
                        </a>
                        <a
                            href={`https://github.com/${APP_CONFIG.repo}/issues`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" x2="12" y1="8" y2="12" />
                                    <line x1="12" x2="12.01" y1="16" y2="16" />
                                </svg>
                                Report Issues
                            </Button>
                        </a>
                        <a
                            href={`https://github.com/${APP_CONFIG.repo}/releases`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" x2="12" y1="15" y2="3" />
                                </svg>
                                Latest Releases
                            </Button>
                        </a>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="font-medium">Acknowledgments</h4>
                    <Separator />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <a
                            href="https://www.electronjs.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:bg-accent/50 flex items-center justify-center rounded-md border p-3"
                        >
                            <div className="text-center">
                                <h5 className="font-medium">Electron</h5>
                                <p className="text-muted-foreground text-xs">
                                    Desktop apps
                                </p>
                            </div>
                        </a>
                        <a
                            href="https://ui.shadcn.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:bg-accent/50 flex items-center justify-center rounded-md border p-3"
                        >
                            <div className="text-center">
                                <h5 className="font-medium">shadcn/ui</h5>
                                <p className="text-muted-foreground text-xs">
                                    UI components
                                </p>
                            </div>
                        </a>
                        <a
                            href="https://github.com/sn0w12/electron-sidebar-template"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:bg-accent/50 flex items-center justify-center rounded-md border p-3"
                        >
                            <div className="text-center">
                                <h5 className="font-medium">Template</h5>
                                <p className="text-muted-foreground text-xs">
                                    Electron Template
                                </p>
                            </div>
                        </a>
                    </div>
                </div>

                <div className="flex items-center justify-center pt-2">
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs">
                            © {new Date().getFullYear()} Clip Editor. Licensed
                            under the MIT License.
                        </p>
                    </div>
                </div>
            </div>
        ),
    };

    return (
        <div className="flex flex-col gap-3 p-4 px-6">
            <h1 className="text-3xl font-bold">Settings</h1>

            <Tabs defaultValue="General" className="w-full">
                <TabsList className="mb-4">
                    {Object.keys(settingsMaps).map((groupName) => (
                        <TabsTrigger key={groupName} value={groupName}>
                            {groupName}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Render all settings tabs from settings maps */}
                {Object.entries(settingsMaps).map(
                    ([groupName, settingsMap]) => (
                        <TabsContent key={groupName} value={groupName}>
                            <Card className={`gap-0`}>
                                {groupName.toLowerCase() !== "about" ? (
                                    <CardHeader className="pb-3">
                                        <CardTitle>
                                            <h2 className="border-b pb-2 text-2xl font-medium">
                                                {groupName} Settings
                                            </h2>
                                        </CardTitle>
                                    </CardHeader>
                                ) : null}
                                <CardContent>
                                    {(() => {
                                        // First, collect all settings that have groups
                                        const settingsWithGroups: Record<
                                            string,
                                            Setting
                                        > = {};
                                        const settingsWithoutGroups: Record<
                                            string,
                                            Setting
                                        > = {};

                                        // Separate settings with and without groups
                                        Object.entries(settingsMap).forEach(
                                            ([key, setting]) => {
                                                if (key === "label") return;

                                                if (
                                                    setting.groups &&
                                                    setting.groups.length > 0
                                                ) {
                                                    settingsWithGroups[key] =
                                                        setting as Setting;
                                                } else {
                                                    settingsWithoutGroups[key] =
                                                        setting as Setting;
                                                }
                                            },
                                        );

                                        // Create hierarchical structure
                                        const hierarchicalGroups: Record<
                                            string,
                                            HierarchicalGroup
                                        > = {};

                                        // Process settings with groups
                                        Object.entries(
                                            settingsWithGroups,
                                        ).forEach(([key, setting]) => {
                                            const groups =
                                                setting.groups as string[];

                                            // Assume the first group is always the parent
                                            const parentGroup = groups[0];

                                            // Initialize parent group if it doesn't exist
                                            if (
                                                !hierarchicalGroups[parentGroup]
                                            ) {
                                                hierarchicalGroups[
                                                    parentGroup
                                                ] = {
                                                    settings: {},
                                                    subgroups: {},
                                                };
                                            }

                                            if (groups.length === 1) {
                                                // This setting belongs directly to the parent group
                                                hierarchicalGroups[
                                                    parentGroup
                                                ].settings[key] = setting;
                                            } else {
                                                // This setting belongs to a subgroup
                                                for (
                                                    let i = 1;
                                                    i < groups.length;
                                                    i++
                                                ) {
                                                    const subgroup = groups[i];

                                                    // Initialize subgroup if it doesn't exist
                                                    if (
                                                        !hierarchicalGroups[
                                                            parentGroup
                                                        ].subgroups[subgroup]
                                                    ) {
                                                        hierarchicalGroups[
                                                            parentGroup
                                                        ].subgroups[subgroup] =
                                                            {};
                                                    }

                                                    // Add setting to subgroup
                                                    hierarchicalGroups[
                                                        parentGroup
                                                    ].subgroups[subgroup][key] =
                                                        setting;
                                                }
                                            }
                                        });

                                        // Function to render a group of settings
                                        const renderSettingsGroup = (
                                            groupSettings: Record<
                                                string,
                                                Setting
                                            >,
                                        ) => {
                                            return (
                                                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:!grid-cols-2 lg:!grid-cols-3 xl:!grid-cols-4">
                                                    {Object.entries(
                                                        groupSettings,
                                                    ).map(([key, setting]) => {
                                                        // For certain settings that should span the full width
                                                        const isFullWidth =
                                                            setting.customRender ||
                                                            setting.type ===
                                                                "textarea" ||
                                                            groupName.toLowerCase() ===
                                                                "about";

                                                        return (
                                                            <div
                                                                key={key}
                                                                className={`space-y-2 ${isFullWidth ? "col-span-full" : ""}`}
                                                            >
                                                                <div className="flex flex-col space-y-1">
                                                                    <Label
                                                                        htmlFor={
                                                                            key
                                                                        }
                                                                        className="font-medium"
                                                                    >
                                                                        {
                                                                            setting.label
                                                                        }
                                                                    </Label>
                                                                    {setting.description && (
                                                                        <p className="text-muted-foreground text-xs">
                                                                            {
                                                                                setting.description
                                                                            }
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="mt-1">
                                                                    {customRenderers[
                                                                        key as keyof typeof customRenderers
                                                                    ] ||
                                                                        renderInput(
                                                                            key,
                                                                            setting as Setting,
                                                                            settingsMap,
                                                                        )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        };

                                        return (
                                            <div className="space-y-8">
                                                {/* Render ungrouped settings first if they exist */}
                                                {Object.keys(
                                                    settingsWithoutGroups,
                                                ).length > 0 && (
                                                    <div className="space-y-4">
                                                        {renderSettingsGroup(
                                                            settingsWithoutGroups,
                                                        )}
                                                    </div>
                                                )}

                                                {/* Render hierarchical groups */}
                                                {Object.entries(
                                                    hierarchicalGroups,
                                                ).map(
                                                    ([
                                                        groupName,
                                                        groupData,
                                                    ]) => (
                                                        <div
                                                            key={groupName}
                                                            className="space-y-4"
                                                        >
                                                            {/* Main group header */}
                                                            <h3 className="border-b pb-2 text-lg font-medium">
                                                                {groupName}
                                                            </h3>

                                                            {/* Main group settings */}
                                                            {Object.keys(
                                                                groupData.settings,
                                                            ).length > 0 &&
                                                                renderSettingsGroup(
                                                                    groupData.settings,
                                                                )}

                                                            {/* Subgroups */}
                                                            {Object.entries(
                                                                groupData.subgroups,
                                                            ).map(
                                                                ([
                                                                    subgroupName,
                                                                    subgroupSettings,
                                                                ]) => (
                                                                    <div
                                                                        key={
                                                                            subgroupName
                                                                        }
                                                                        className="border-muted mt-6 space-y-4 border-l-2 pt-1 pl-4"
                                                                    >
                                                                        {/* Subgroup header */}
                                                                        <h4 className="text-md flex items-center font-medium">
                                                                            {
                                                                                subgroupName
                                                                            }
                                                                        </h4>

                                                                        {/* Subgroup settings */}
                                                                        {renderSettingsGroup(
                                                                            subgroupSettings,
                                                                        )}
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ),
                )}
            </Tabs>
        </div>
    );
}
