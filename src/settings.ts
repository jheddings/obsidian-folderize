import { App } from "obsidian";
import {
    LogLevel,
    ToggleSetting,
    TextInputSetting,
    SliderSetting,
    DropdownSetting,
    PluginSettingsTab,
} from "obskit";
import { FolderizeSettings } from "./organize";
import FolderizePlugin from "./main";

export const DEFAULT_SETTINGS: FolderizeSettings = {
    attachmentPath: "Attachments",
    pathDepth: 4,
    autoOrganize: false,
    removeEmptyFolders: true,
    logLevel: LogLevel.WARN,
};

/**
 * Setting for the attachment path.
 */
export class AttachmentPathSetting extends TextInputSetting {
    constructor(private plugin: FolderizePlugin) {
        super({
            name: "Attachment path",
            description: "Path to the attachments folder",
        });
    }

    get value(): string {
        return this.plugin.settings.attachmentPath;
    }

    set value(val: string) {
        this.plugin.settings.attachmentPath = val;
        this.plugin.saveSettings();
    }

    get default(): string {
        return DEFAULT_SETTINGS.attachmentPath;
    }

    get placeholder(): string | null {
        return "attachments";
    }
}

/**
 * Setting for auto-organize toggle.
 */
export class AutoOrganizeSetting extends ToggleSetting {
    constructor(private plugin: FolderizePlugin) {
        super({
            name: "Auto-organize",
            description: "Automatically organize attachments when they are added",
        });
    }

    get value(): boolean {
        return this.plugin.settings.autoOrganize;
    }

    set value(val: boolean) {
        this.plugin.settings.autoOrganize = val;
        this.plugin.saveSettings();
    }

    get default(): boolean {
        return DEFAULT_SETTINGS.autoOrganize;
    }
}

/**
 * Setting for removing empty folders toggle.
 */
export class RemoveEmptyFoldersSetting extends ToggleSetting {
    constructor(private plugin: FolderizePlugin) {
        super({
            name: "Remove empty folders",
            description: "Remove empty directories when organizing attachments",
        });
    }

    get value(): boolean {
        return this.plugin.settings.removeEmptyFolders;
    }

    set value(val: boolean) {
        this.plugin.settings.removeEmptyFolders = val;
        this.plugin.saveSettings();
    }

    get default(): boolean {
        return DEFAULT_SETTINGS.removeEmptyFolders;
    }
}

/**
 * Setting for path depth slider.
 */
export class PathDepthSetting extends SliderSetting {
    constructor(private plugin: FolderizePlugin) {
        super({
            name: "Path depth",
            description: "Number of directory levels to create in folder structure",
        });
    }

    get value(): number {
        return this.plugin.settings.pathDepth;
    }

    set value(val: number) {
        this.plugin.settings.pathDepth = val;
        this.plugin.saveSettings();
    }

    get default(): number {
        return DEFAULT_SETTINGS.pathDepth;
    }

    get minimum(): number {
        return 1;
    }

    get maximum(): number {
        return 8;
    }

    get step(): number {
        return 1;
    }
}

/**
 * Setting for log level dropdown.
 */
class LogLevelSetting extends DropdownSetting<LogLevel> {
    constructor(private plugin: FolderizePlugin) {
        super({
            name: "Log level",
            description: "Set the logging level for console output.",
        });
    }

    get value(): LogLevel {
        return this.plugin.settings.logLevel ?? this.default;
    }

    set value(val: LogLevel) {
        this.plugin.settings.logLevel = val;
        this.plugin.saveSettings();
    }

    get default(): LogLevel {
        return LogLevel.INFO;
    }

    get options(): { key: string; label: string; value: LogLevel }[] {
        return [
            { key: "debug", label: "Debug", value: LogLevel.DEBUG },
            { key: "info", label: "Info", value: LogLevel.INFO },
            { key: "warn", label: "Warn", value: LogLevel.WARN },
            { key: "error", label: "Error", value: LogLevel.ERROR },
            { key: "silent", label: "Silent", value: LogLevel.SILENT },
        ];
    }
}

/**
 * Main settings tab for the Folderize plugin.
 */
export class FolderizeSettingsTab extends PluginSettingsTab {
    private plugin: FolderizePlugin;

    constructor(app: App, plugin: FolderizePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new AttachmentPathSetting(this.plugin).display(containerEl);
        new AutoOrganizeSetting(this.plugin).display(containerEl);
        new RemoveEmptyFoldersSetting(this.plugin).display(containerEl);

        containerEl.createEl("h3", { text: "Advanced Settings" });

        new PathDepthSetting(this.plugin).display(containerEl);
        new LogLevelSetting(this.plugin).display(containerEl);
    }
}
