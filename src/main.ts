import { EventRef, Plugin, TFile } from "obsidian";
import { Logger } from "obskit";
import { DirectoryManager, FileOrganizer, FolderizeSettings } from "./organize";
import { DEFAULT_SETTINGS, FolderizeSettingsTab } from "./settings";

export default class FolderizePlugin extends Plugin {
    settings: FolderizeSettings;

    private directoryManager: DirectoryManager;
    private fileOrganizer: FileOrganizer;
    private autoOrganizeEventRef: EventRef | null = null;

    async onload() {
        await this.loadSettings();
        Logger.setGlobalLogLevel(this.settings.logLevel);

        this.directoryManager = new DirectoryManager(this.app);
        this.fileOrganizer = new FileOrganizer(this.app, this.directoryManager);

        this.addCommand({
            id: "organize-attachments",
            name: "Organize all attachments",
            callback: () => {
                void this.organizeAttachments();
            },
        });

        this.addSettingTab(new FolderizeSettingsTab(this.app, this));

        this.applySettings();
    }

    onunload() {
        this.unregisterAutoOrganize();
    }

    async loadSettings() {
        const loaded = (await this.loadData()) as Partial<FolderizeSettings> | null;
        this.settings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}) };
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.applySettings();
    }

    private applySettings(): void {
        Logger.setGlobalLogLevel(this.settings.logLevel);

        if (this.settings.autoOrganize) {
            this.registerAutoOrganize();
        } else {
            this.unregisterAutoOrganize();
        }
    }

    private registerAutoOrganize(): void {
        if (this.autoOrganizeEventRef) {
            return;
        }

        this.autoOrganizeEventRef = this.app.vault.on("create", (file) => {
            if (file instanceof TFile && this.isAttachment(file)) {
                window.setTimeout(() => {
                    void this.organizeFile(file);
                }, 1000);
            }
        });
        this.registerEvent(this.autoOrganizeEventRef);
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
