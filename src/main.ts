import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder } from "obsidian";
import { createHash } from "crypto";
import * as path from "path";

interface HiverSettings {
    attachmentPath: string;
    chunkSize: number;
    pathDepth: number;
    enableAutoOrganize: boolean;
    removeEmptyFolders: boolean;
}

const DEFAULT_SETTINGS: HiverSettings = {
    attachmentPath: "Attachments",
    chunkSize: 4096,
    pathDepth: 4,
    enableAutoOrganize: false,
    removeEmptyFolders: true,
};

export default class HiverPlugin extends Plugin {
    settings: HiverSettings;

    async onload() {
        await this.loadSettings();

        // Add command to organize attachments
        this.addCommand({
            id: "organize-attachments",
            name: "Organize attachments into hive structure",
            callback: () => this.organizeAttachments(),
        });

        // Add settings tab
        this.addSettingTab(new HiverSettingTab(this.app, this));

        // Auto-organize on file creation if enabled
        if (this.settings.enableAutoOrganize) {
            this.registerEvent(
                this.app.vault.on("create", (file) => {
                    if (file instanceof TFile && this.isAttachment(file)) {
                        // Delay to ensure file is fully written
                        setTimeout(() => this.organizeFile(file), 1000);
                    }
                })
            );
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private isAttachment(file: TFile): boolean {
        // Check if file is in the attachments folder
        const attachmentPath = this.settings.attachmentPath;
        return file.path.startsWith(attachmentPath + "/") || file.path === attachmentPath;
    }

    private async calculateChecksum(filePath: string): Promise<Buffer> {
        try {
            const data = await this.app.vault.adapter.readBinary(filePath);

            // Read in chunks like the original script
            const hash = createHash("sha256");
            let offset = 0;

            while (offset < data.byteLength) {
                const chunk = data.slice(offset, offset + this.settings.chunkSize);
                hash.update(new Uint8Array(chunk));
                offset += this.settings.chunkSize;
            }

            return hash.digest();
        } catch (error) {
            console.error("Error calculating checksum:", error);
            throw error;
        }
    }

    private generateHivePath(checksum: Buffer): string {
        const parts = [this.settings.attachmentPath];

        for (let i = 0; i < this.settings.pathDepth && i < checksum.length; i++) {
            parts.push(checksum[i].toString(16).padStart(2, "0"));
        }

        return parts.join("/");
    }

    private async organizeFile(file: TFile): Promise<void> {
        try {
            const checksum = await this.calculateChecksum(file.path);
            const hivePath = this.generateHivePath(checksum);
            const fileName = path.basename(file.path);
            const newPath = `${hivePath}/${fileName}`;

            // Don't move if already in correct location
            if (file.path === newPath) {
                return;
            }

            // Create directory structure if needed
            const dir = path.dirname(newPath);
            if (!(await this.app.vault.adapter.exists(dir))) {
                await this.createDirectoryRecursive(dir);
            }

            // Move the file
            await this.app.vault.rename(file, newPath);

            console.log(`Moved ${file.path} to ${newPath}`);
        } catch (error) {
            console.error(`Error organizing file ${file.path}:`, error);
            new Notice(`Error organizing ${file.name}: ${error.message}`);
        }
    }

    private async createDirectoryRecursive(dirPath: string): Promise<void> {
        const parts = dirPath.split("/");
        let currentPath = "";

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    private async organizeAttachments(): Promise<void> {
        try {
            new Notice("Organizing attachments...");

            const attachmentFolder = this.app.vault.getAbstractFileByPath(
                this.settings.attachmentPath
            );
            if (!attachmentFolder || !(attachmentFolder instanceof TFolder)) {
                new Notice("Attachment folder not found");
                return;
            }

            const files = this.getAllFiles(attachmentFolder);
            let processedCount = 0;

            for (const file of files) {
                await this.organizeFile(file);
                processedCount++;
            }

            new Notice(`Organized ${processedCount} attachments`);

            // Clean up empty directories after organizing if enabled
            if (this.settings.removeEmptyFolders) {
                await this.cleanEmptyDirectories();
            }
        } catch (error) {
            console.error("Error organizing attachments:", error);
            new Notice(`Error organizing attachments: ${error.message}`);
        }
    }

    private getAllFiles(folder: TFolder): TFile[] {
        const files: TFile[] = [];

        for (const child of folder.children) {
            if (child instanceof TFile) {
                files.push(child);
            } else if (child instanceof TFolder) {
                files.push(...this.getAllFiles(child));
            }
        }

        return files;
    }

    private async cleanEmptyDirectories(): Promise<void> {
        try {
            const attachmentFolder = this.app.vault.getAbstractFileByPath(
                this.settings.attachmentPath
            );
            if (!attachmentFolder || !(attachmentFolder instanceof TFolder)) {
                return;
            }

            const emptyFolders = this.findEmptyFolders(attachmentFolder);
            let removedCount = 0;

            // Remove empty folders (deepest first)
            for (const folder of emptyFolders.reverse()) {
                try {
                    await this.app.vault.delete(folder);
                    removedCount++;
                    console.log(`Removed empty directory: ${folder.path}`);
                } catch (error) {
                    console.error(`Error removing directory ${folder.path}:`, error);
                }
            }

            if (removedCount > 0) {
                new Notice(`Removed ${removedCount} empty directories`);
            }
        } catch (error) {
            console.error("Error cleaning empty directories:", error);
        }
    }

    private findEmptyFolders(folder: TFolder): TFolder[] {
        const emptyFolders: TFolder[] = [];

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                // Recursively check subfolders first
                emptyFolders.push(...this.findEmptyFolders(child));

                // Check if this folder is empty (no files, only empty subfolders)
                const hasFiles = child.children.some((c) => c instanceof TFile);
                const hasNonEmptyFolders = child.children.some(
                    (c) => c instanceof TFolder && !emptyFolders.includes(c)
                );

                if (!hasFiles && !hasNonEmptyFolders) {
                    emptyFolders.push(child);
                }
            }
        }

        return emptyFolders;
    }
}

class HiverSettingTab extends PluginSettingTab {
    plugin: HiverPlugin;

    constructor(app: App, plugin: HiverPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Hiver Settings" });

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
            .setDesc("Number of directory levels to create in hive structure")
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
    }
}
