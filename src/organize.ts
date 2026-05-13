import { App, Notice, TFile, TFolder } from "obsidian";
import { Logger, LogLevel } from "obskit";

export interface FolderizeSettings {
    attachmentPath: string;
    pathDepth: number;
    autoOrganize: boolean;
    removeEmptyFolders: boolean;
    logLevel: LogLevel;
}

function basename(p: string): string {
    const idx = p.lastIndexOf("/");
    return idx >= 0 ? p.slice(idx + 1) : p;
}

function dirname(p: string): string {
    const idx = p.lastIndexOf("/");
    return idx >= 0 ? p.slice(0, idx) : "";
}

export class DirectoryManager {
    private app: App;
    private logger = Logger.getLogger("DirectoryManager");

    constructor(app: App) {
        this.app = app;
    }

    async mkdirs(dir: string): Promise<void> {
        const parts = dir.split("/");
        let currentPath = "";

        this.logger.debug(`Creating directory structure: ${dir}`);

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    async cleanEmptyDirectories(attachmentPath: string): Promise<void> {
        this.logger.debug(`Removing empty directories from ${attachmentPath}`);
        const attachmentFolder = this.app.vault.getAbstractFileByPath(attachmentPath);
        if (!attachmentFolder || !(attachmentFolder instanceof TFolder)) {
            return;
        }

        const removedCount = await this.removeEmptyFolders(attachmentFolder);

        if (removedCount > 0) {
            this.logger.info(`Removed ${removedCount} empty directories`);
            new Notice(`Removed ${removedCount} empty directories`);
        }
    }

    private async removeEmptyFolders(folder: TFolder): Promise<number> {
        let removedCount = 0;

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                // process folders recursively (depth first)
                removedCount += await this.removeEmptyFolders(child);

                if (child.children.length === 0) {
                    this.logger.debug(`Removing empty folder: ${child.path}`);
                    await this.app.fileManager.trashFile(child);
                    this.logger.info(`Removed empty folder: ${child.path}`);
                    removedCount++;
                }
            }
        }

        return removedCount;
    }
}

export class FileOrganizer {
    private app: App;
    private directoryManager: DirectoryManager;
    private logger: Logger;

    constructor(app: App, directoryManager: DirectoryManager) {
        this.app = app;
        this.directoryManager = directoryManager;
        this.logger = Logger.getLogger("FileOrganizer");
    }

    private async cksum(filePath: string): Promise<Uint8Array> {
        const data = await this.app.vault.adapter.readBinary(filePath);
        const digest = await crypto.subtle.digest("SHA-256", data);
        return new Uint8Array(digest);
    }

    private generatePath(checksum: Uint8Array, settings: FolderizeSettings): string {
        const parts = [settings.attachmentPath];

        for (let i = 0; i < settings.pathDepth && i < checksum.length; i++) {
            parts.push(checksum[i].toString(16).padStart(2, "0"));
        }

        return parts.join("/");
    }

    async organizeFile(file: TFile, settings: FolderizeSettings): Promise<void> {
        this.logger.debug(`Organizing file: ${file.path}`);
        const checksum = await this.cksum(file.path);
        const hivePath = this.generatePath(checksum, settings);
        const filename = basename(file.path);
        const newPath = `${hivePath}/${filename}`;

        if (file.path === newPath) {
            this.logger.debug(`File '${file.path}' is already in correct location`);
            return;
        }

        const dir = dirname(newPath);
        await this.directoryManager.mkdirs(dir);

        await this.app.vault.rename(file, newPath);
        this.logger.info(`Moved '${file.path}' to '${newPath}'`);
    }

    private getFilesInFolder(folder: TFolder): TFile[] {
        const files: TFile[] = [];

        for (const child of folder.children) {
            if (child instanceof TFile) {
                files.push(child);
            } else if (child instanceof TFolder) {
                files.push(...this.getFilesInFolder(child));
            }
        }

        return files;
    }

    async organizeAttachments(settings: FolderizeSettings): Promise<void> {
        this.logger.debug("Organizing attachments");
        new Notice("Organizing attachments...");

        const attachmentFolder = this.app.vault.getAbstractFileByPath(settings.attachmentPath);

        if (!attachmentFolder || !(attachmentFolder instanceof TFolder)) {
            this.logger.warn(`Attachment folder not found: ${settings.attachmentPath}`);
            new Notice("Attachment folder not found");
            return;
        }

        const files = this.getFilesInFolder(attachmentFolder);
        this.logger.debug(`Processing ${files.length} file(s) from '${attachmentFolder.path}'`);
        let processedCount = 0;

        for (const file of files) {
            await this.organizeFile(file, settings);
            processedCount++;
        }

        this.logger.debug(`Organization complete. Processed ${processedCount} files`);
        new Notice(`Organized ${processedCount} attachments`);

        if (settings.removeEmptyFolders) {
            await this.directoryManager.cleanEmptyDirectories(settings.attachmentPath);
        }
    }
}
