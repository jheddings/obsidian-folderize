# Folderize

An Obsidian plugin that automatically organizes your attachments into a structured folder hierarchy based on file content checksums.

## Purpose

Managing attachments in Obsidian can become unwieldy as your vault grows. The Folderize plugin solves this by organizing your attachments into a predictable, content-based folder structure. Instead of having all attachments in a single folder or manually organizing them, Folderize creates a hierarchical directory structure based on each file's SHA-256 checksum.

This approach ensures:

- **Consistent organization**: Files are always placed in the same location based on their content
- **Deduplication**: Identical files will be placed in the same folder path
- **Scalability**: The folder structure distributes files evenly, preventing any single directory from becoming too large
- **Automation**: Set it and forget it - new attachments can be organized automatically

## How It Works

Folderize calculates a SHA-256 checksum for each attachment and uses the first few bytes of the hash to create a nested folder structure. For example, with the default depth of 4, a file might be organized into:

```
Attachments/
├── a1/
│   ├── b2/
│   │   ├── c3/
│   │   │   ├── d4/
│   │   │   │   └── my-image.png
```

## Configuration

The plugin provides several configuration options in Settings > Plugin Options > Folderize:

### Basic Settings

- **Attachment path**: The root folder where attachments are stored (default: "Attachments")
- **Auto-organize**: Automatically organize new attachments as they're added to your vault
- **Remove empty folders**: Clean up empty directories after reorganizing files

### Advanced Settings

- **Path depth**: Number of directory levels to create (1-8, default: 4)
- **Log level**: Adjust console logging verbosity for debugging

## Usage

### Manual Organization

Use the command palette (`Cmd/Ctrl + P`) and search for "Organize all attachments" to manually organize all files in your attachment folder.

### Automatic Organization

Enable "Auto-organize" in the settings to have new attachments automatically organized when added to your vault.

## Installation

Installation is supported using BRAT.
