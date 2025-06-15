import { updateAvatarOnAllServers } from "./api/profile-picture";
import { setTheme } from "./helpers/theme-helpers";
import { Setting } from "./utils/settings";

/**
 * Configuration object for the Electron application.
 * @property {string} name - The display name of the application.
 * @property {string} protocolName - The custom protocol name used for deep linking.
 * @property {boolean} useLoadingWindow - Whether to display a loading window during application startup.
 */
export const APP_CONFIG = {
    name: "Relay",
    protocolName: "relay",
    author: "sn0w12",
    repo: "sn0w12/relay-client",
    useLoadingWindow: true,
};

/**
 * Determines if the application is running in development mode.
 */
export const inDevelopment = process.env.NODE_ENV === "development";

interface AppSettings {
    [key: string]: {
        label: string;
        settings: {
            [key: string]:
                | Setting
                | {
                      customRender: boolean;
                  };
        };
    };
}

/**
 * Application settings configuration with categorized groups
 */
export const APP_SETTINGS: AppSettings = {
    general: {
        label: "General",
        settings: {
            theme: {
                label: "Theme",
                type: "select",
                options: [
                    { label: "Light", value: "light" },
                    { label: "Dark", value: "dark" },
                    { label: "System", value: "system" },
                ],
                default: "system",
                onChange: (value) => {
                    setTheme(value as "light" | "dark" | "system");
                },
                description: "Choose the theme for the application",
                groups: ["Appearance"],
            },
            positiveAccentColor: {
                label: "Positive Accent Color",
                type: "color",
                default: "#74c4c9",
                description:
                    "Choose the positive accent color for the application",
                groups: ["Appearance", "Color"],
            },
            warningAccentColor: {
                label: "Warning Accent Color",
                type: "color",
                default: "#f6b93b",
                description:
                    "Choose the warning accent color for the application",
                groups: ["Appearance", "Color"],
            },
            negativeAccentColor: {
                label: "Negative Accent Color",
                type: "color",
                default: "#f72650",
                description:
                    "Choose the negative accent color for the application",
                groups: ["Appearance", "Color"],
            },
            windowIconsStyle: {
                label: "Window Controls Style",
                type: "select",
                options: [
                    { label: "Custom", value: "custom" },
                    { label: "Traditional", value: "traditional" },
                ],
                default: "custom",
                description:
                    "Choose between custom or traditional window control icons",
                groups: ["Appearance"],
            },
        },
    },
    user: {
        label: "User",
        settings: {
            username: {
                label: "Username",
                type: "text",
                default: "",
                description: "Your display name in the application",
                groups: ["Identity"],
            },
            userAvatar: {
                label: "Profile Picture",
                type: "file-picker",
                default: "",
                dialogOptions: {
                    title: "Select Profile Picture",
                    filters: [
                        {
                            name: "Images",
                            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
                        },
                    ],
                    properties: ["openFile", "showHiddenFiles"],
                },
                description: "Choose an image to use as your profile picture",
                onChange: (value: unknown) => {
                    updateAvatarOnAllServers(value as string);
                },
                groups: ["Identity"],
            },
        },
    },
    shortcuts: {
        label: "Shortcuts",
        settings: {
            toggleSidebar: {
                label: "Toggle Sidebar",
                type: "shortcut",
                default: "Ctrl+B",
                description: "Shortcut to toggle the sidebar.",
                groups: ["Interface"],
            },
            selectAll: {
                label: "Select All",
                type: "shortcut",
                default: "Ctrl+A",
                description: "Shortcut to select all.",
                groups: ["Selection"],
            },
            selectNone: {
                label: "Select None",
                type: "shortcut",
                default: "Ctrl+D",
                description: "Shortcut to deselect all.",
                groups: ["Selection"],
            },
            selectInvert: {
                label: "Select Invert",
                type: "shortcut",
                default: "Ctrl+I",
                description: "Shortcut to invert selection.",
                groups: ["Selection"],
            },
            muteShortcut: {
                label: "Toggle Mute",
                type: "shortcut",
                default: "Ctrl+M",
                description: "Shortcut to toggle microphone mute",
                groups: ["Voice"],
            },
            deafenShortcut: {
                label: "Toggle Deafen",
                type: "shortcut",
                default: "Ctrl+Shift+M",
                description:
                    "Shortcut to toggle deafen (mute input and output)",
                groups: ["Voice"],
            },
            pushToTalkKey: {
                label: "Push to Talk Key",
                type: "shortcut",
                default: "Space",
                description: "Key to hold for push-to-talk",
                groups: ["Voice"],
            },
        },
    },
    audio: {
        label: "Audio & Voice",
        settings: {
            inputDevice: {
                label: "Input Device",
                default: "default",
                description: "Select your microphone input device",
                groups: ["Devices"],
                customRender: true,
            },
            outputDevice: {
                label: "Output Device",
                default: "default",
                description: "Select your audio output device",
                groups: ["Devices"],
                customRender: true,
            },
            inputVolume: {
                label: "Input Volume",
                type: "slider",
                min: 0,
                max: 100,
                step: 1,
                default: "100",
                description: "Adjust your microphone input volume",
                groups: ["Volume"],
            },
            outputVolume: {
                label: "Output Volume",
                type: "slider",
                min: 0,
                max: 100,
                step: 1,
                default: "100",
                description: "Adjust the voice chat output volume",
                groups: ["Volume"],
            },
            voiceActivationThreshold: {
                label: "Voice Activation Threshold",
                type: "slider",
                min: -100,
                max: 0,
                step: 1,
                default: "-50",
                description:
                    "Set the sensitivity for voice activation (in dB). Lower values are more sensitive.",
                groups: ["Voice Detection"],
            },
            pushToTalkMode: {
                label: "Push to Talk Mode",
                type: "checkbox",
                default: false,
                description: "Enable push-to-talk instead of voice activation",
                groups: ["Voice Detection"],
            },
            testMicrophone: {
                label: "Test Microphone",
                type: "button",
                default: "",
                description:
                    "Test your microphone input levels with voice activation threshold visualization",
                customRender: true,
                groups: ["Testing"],
            },
        },
    },
    about: {
        label: "About",
        settings: {
            appInfo: {
                customRender: true,
            },
        },
    },
};
