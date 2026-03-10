# CLAUDE.md — obsidian-folderize

## Overview

Obsidian plugin that automatically organizes attachments into a structured
folder hierarchy based on file content checksums.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`

Scope is optional but encouraged (e.g. `fix(hash): ...`, `feat(settings): ...`).

Include the issue number when applicable (e.g. `feat: add custom depth (#3)`).

## Branch Naming

Use the same type prefixes as commits, followed by a short description:

```
<type>/<short-description>
```

Examples: `feat/custom-depth`, `fix/rename-handling`, `chore/update-deps`
