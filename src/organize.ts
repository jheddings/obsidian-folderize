import { App, Notice, TFile, TFolder } from "obsidian";
import { createHash } from "crypto";
import * as path from "path";
import { Logger, LogLevel } from "./logger";

export interface FolderizeSettings {
    attachmentPath: string;
    chunkSize: number;
    pathDepth: number;
    enableAutoOrganize: boolean;
    removeEmptyFolders: boolean;
    logLevel: LogLevel;
}

export class DirectoryManager {
    private app: App;
    private logger: any;

    constructor(app: App) {
        this.app = app;
        this.logger = Logger.getLogger("DirectoryManager");
    }

    async createDirectoryRecursive(dirPath: string): Promise<void> {
        const parts = dirPath.split("/");
        let currentPath = "";

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    async cleanEmptyDirectories(settings: FolderizeSettings): Promise<void> {
        try {
            this.logger.debug("Starting empty directory cleanup");
            const attachmentFolder = this.app.vault.getAbstractFileByPath(settings.attachmentPath);
            if (!attachmentFolder || !(attachmentFolder instanceof TFolder)) {
                return;
            }

            const emptyFolders = this.findEmptyFolders(attachmentFolder);
            this.logger.debug(`Found ${emptyFolders.length} empty folders to remove`);
            let removedCount = 0;

            for (const folder of emptyFolders.reverse()) {
                try {
                    await this.app.vault.delete(folder);
                    removedCount++;
                    this.logger.info(`Removed empty directory: ${folder.path}`);
                } catch (error) {
                    this.logger.error(`Error removing directory ${folder.path}:`, error);
                }
            }

            if (removedCount > 0) {
                this.logger.debug(`Cleanup complete. Removed ${removedCount} empty directories`);
                new Notice(`Removed ${removedCount} empty directories`);
            }
        } catch (error) {
            this.logger.error("Error cleaning empty directories:", error);
        }
    }

    private findEmptyFolders(folder: TFolder): TFolder[] {
        const emptyFolders: TFolder[] = [];

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                emptyFolders.push(...this.findEmptyFolders(child));

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

export class FileOrganizer {
    private app: App;
    private directoryManager: DirectoryManager;
    private logger: any;

    constructor(app: App, directoryManager: DirectoryManager) {
        this.app = app;
        this.directoryManager = directoryManager;
        this.logger = Logger.getLogger("FileOrganizer");
    }

    private async calculateChecksum(filePath: string, chunkSize: number): Promise<Buffer> {
        try {
            const data = await this.app.vault.adapter.readBinary(filePath);

            // Read in chunks like the original script
            const hash = createHash("sha256");
            let offset = 0;

            while (offset < data.byteLength) {
                const chunk = data.slice(offset, offset + chunkSize);
                hash.update(new Uint8Array(chunk));
                offset += chunkSize;
            }

            return hash.digest();
        } catch (error) {
            this.logger.error("Error calculating checksum:", error);
            throw error;
        }
    }

    private generatePath(checksum: Buffer, settings: FolderizeSettings): string {
        const parts = [settings.attachmentPath];

        for (let i = 0; i < settings.pathDepth && i < checksum.length; i++) {
            parts.push(checksum[i].toString(16).padStart(2, "0"));
        }

        return parts.join("/");
    }

    async organizeFile(file: TFile, settings: FolderizeSettings): Promise<void> {
        try {
            this.logger.debug(`Starting organization of file: ${file.path}`);
            const checksum = await this.calculateChecksum(file.path, settings.chunkSize);
            const hivePath = this.generatePath(checksum, settings);
            const fileName = path.basename(file.path);
            const newPath = `${hivePath}/${fileName}`;

            if (file.path === newPath) {
                this.logger.debug(`File ${file.path} is already in correct location`);
                return;
            }

            // create directory structure if needed
            const dir = path.dirname(newPath);
            if (!(await this.app.vault.adapter.exists(dir))) {
                this.logger.debug(`Creating directory structure: ${dir}`);
                await this.directoryManager.createDirectoryRecursive(dir);
            }

            await this.app.vault.rename(file, newPath);
            this.logger.info(`Moved ${file.path} to ${newPath}`);
        } catch (error) {
            this.logger.error(`Error organizing file ${file.path}:`, error);
            new Notice(`Error organizing ${file.name}: ${error.message}`);
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

    async organizeAttachments(settings: FolderizeSettings): Promise<void> {
        try {
            this.logger.debug("Starting attachment organization");
            new Notice("Organizing attachments...");

            const attachmentFolder = this.app.vault.getAbstractFileByPath(settings.attachmentPath);

            if (!attachmentFolder || !(attachmentFolder instanceof TFolder)) {
                this.logger.warn(`Attachment folder not found: ${settings.attachmentPath}`);
                new Notice("Attachment folder not found");
                return;
            }

            const files = this.getAllFiles(attachmentFolder);
            this.logger.debug(`Found ${files.length} files to process`);
            let processedCount = 0;

            for (const file of files) {
                await this.organizeFile(file, settings);
                processedCount++;
            }

            this.logger.debug(`Organization complete. Processed ${processedCount} files`);
            new Notice(`Organized ${processedCount} attachments`);

            if (settings.removeEmptyFolders) {
                await this.directoryManager.cleanEmptyDirectories(settings);
            }
        } catch (error) {
            this.logger.error("Error organizing attachments:", error);
            new Notice(`Error organizing attachments: ${error.message}`);
        }
    }
}
