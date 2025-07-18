import { App, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { Logger, LogLevel } from "./logger";
import { DirectoryManager, FileOrganizer, FolderizeSettings } from "./organize";

const DEFAULT_SETTINGS: FolderizeSettings = {
    attachmentPath: "Attachments",
    chunkSize: 4096,
    pathDepth: 4,
    enableAutoOrganize: false,
    removeEmptyFolders: true,
    logLevel: LogLevel.WARN,
};

export default class FolderizePlugin extends Plugin {
    settings: FolderizeSettings;
    logger: any;
    private directoryManager: DirectoryManager;
    private fileOrganizer: FileOrganizer;
    private autoOrganizeEventRef: any;

    async onload() {
        await this.loadSettings();
        this.logger = Logger.getLogger("main");
        Logger.setGlobalLogLevel(this.settings.logLevel);

        // Initialize organization components
        this.directoryManager = new DirectoryManager(this.app);
        this.fileOrganizer = new FileOrganizer(this.app, this.directoryManager);

        this.addCommand({
            id: "organize-attachments",
            name: "Organize all attachments",
            callback: () => this.organizeAttachments(),
        });

        this.addSettingTab(new FolderizeSettingTab(this.app, this));

        this.applySettings();
    }

    onunload() {
        this.unregisterAutoOrganize();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.applySettings();
    }

    private applySettings(): void {
        Logger.setGlobalLogLevel(this.settings.logLevel);

        if (this.settings.enableAutoOrganize) {
            this.registerAutoOrganize();
        } else {
            this.unregisterAutoOrganize();
        }
    }

    private registerAutoOrganize(): void {
        if (!this.autoOrganizeEventRef) {
            this.autoOrganizeEventRef = this.registerEvent(
                this.app.vault.on("create", (file) => {
                    if (file instanceof TFile && this.isAttachment(file)) {
                        setTimeout(() => this.organizeFile(file), 1000);
                    }
                })
            );
        }
    }

    private unregisterAutoOrganize(): void {
        if (this.autoOrganizeEventRef) {
            this.app.vault.offref(this.autoOrganizeEventRef);
            this.autoOrganizeEventRef = null;
        }
    }

    private isAttachment(file: TFile): boolean {
        const attachmentPath = this.settings.attachmentPath;
        return file.path.startsWith(attachmentPath + "/") || file.path === attachmentPath;
    }

    private async organizeFile(file: TFile): Promise<void> {
        await this.fileOrganizer.organizeFile(file, this.settings);
    }

    private async organizeAttachments(): Promise<void> {
        await this.fileOrganizer.organizeAttachments(this.settings);
    }
}

class FolderizeSettingTab extends PluginSettingTab {
    plugin: FolderizePlugin;

    constructor(app: App, plugin: FolderizePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Folderize Settings" });

        new Setting(containerEl)
            .setName("Attachment path")
            .setDesc("Path to the attachments folder")
            .addText((text) =>
                text
                    .setPlaceholder("attachments")
                    .setValue(this.plugin.settings.attachmentPath)
                    .onChange(async (value) => {
                        this.plugin.settings.attachmentPath = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Auto-organize")
            .setDesc("Automatically organize attachments when they are added")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.enableAutoOrganize).onChange(async (value) => {
                    this.plugin.settings.enableAutoOrganize = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Remove empty folders")
            .setDesc("Remove empty directories when organizing attachments")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.removeEmptyFolders).onChange(async (value) => {
                    this.plugin.settings.removeEmptyFolders = value;
                    await this.plugin.saveSettings();
                })
            );

        containerEl.createEl("h3", { text: "Advanced Settings" });

        new Setting(containerEl)
            .setName("Chunk size")
            .setDesc("Size of chunks when reading files for checksum (bytes)")
            .addText((text) =>
                text
                    .setPlaceholder("4096")
                    .setValue(this.plugin.settings.chunkSize.toString())
                    .onChange(async (value) => {
                        const num = parseInt(value);
                        if (!isNaN(num) && num > 0) {
                            this.plugin.settings.chunkSize = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Path depth")
            .setDesc("Number of directory levels to create in folder structure")
            .addText((text) =>
                text
                    .setPlaceholder("4")
                    .setValue(this.plugin.settings.pathDepth.toString())
                    .onChange(async (value) => {
                        const num = parseInt(value);
                        if (!isNaN(num) && num > 0 && num <= 8) {
                            this.plugin.settings.pathDepth = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Log level")
            .setDesc("Adjust the log level in the console")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption(LogLevel.ERROR.toString(), "Error")
                    .addOption(LogLevel.WARN.toString(), "Warn")
                    .addOption(LogLevel.INFO.toString(), "Info")
                    .addOption(LogLevel.DEBUG.toString(), "Debug")
                    .setValue(this.plugin.settings.logLevel.toString())
                    .onChange(async (value: string) => {
                        this.plugin.settings.logLevel = parseInt(value) as LogLevel;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
