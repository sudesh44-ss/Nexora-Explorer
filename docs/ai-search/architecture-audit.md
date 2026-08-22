# Nexora Explorer — Complete Architecture Audit

> **Phase**: Part 1 — Foundation & Isolated AI Search Architecture  
> **Date**: August 2026  
> **Status**: Completed Audit  

---

## 1. Existing Project Structure Overview

```text
H:\MyFileExplorers\
├── electron.cjs                    # Main Electron entry point & IPC handlers
├── electron-features.cjs           # Extended Electron features & file operations
├── preload.cjs                     # Preload bridge exposing window.fileExplorer
├── preload-features.cjs            # Preload bridge exposing window.electronFeatures
├── package.json                    # Project configuration, scripts, & dependencies
├── vite.config.js                  # Vite bundler configuration
│
├── electron/                       # Backend Main Process Services
│   └── services/
│       ├── ai/                     # Legacy/Rudimentary AI services (JSON-based)
│       │   ├── aiCredentials.cjs
│       │   ├── aiManager.cjs
│       │   ├── assistant.cjs
│       │   ├── categorization.cjs
│       │   ├── documentAI.cjs
│       │   ├── embeddings.cjs
│       │   ├── providerManager.cjs
│       │   ├── semanticSearch.cjs
│       │   ├── tagging.cjs
│       │   ├── vision.cjs
│       │   └── providers/
│       ├── archive/                # Zip/Tar/7z compression & extraction
│       ├── cloud/                  # S3, WebDAV, FTP cloud sync & credentials
│       ├── ocr/                    # OCR processing services
│       ├── search/                 # Legacy search parsing & traversal
│       │   └── searchService.cjs
│       ├── security/               # Permissions, ACL, secure wipe, encryption
│       ├── storage/                # Drive detection, capacity, health & SMART
│       ├── detailsService.cjs      # Extended file metadata & details pane
│       ├── developerService.cjs    # Terminal, Git, Hex, Hash, JSON tools
│       ├── externalDragDrop.cjs    # Native drag and drop integration
│       ├── fileAssociation.cjs     # OS file associations & Open With
│       ├── hiddenFiles.cjs         # Windows hidden/system file toggles
│       ├── networkService.cjs      # Subnet discovery, SMB, NAS, FTP/SFTP
│       ├── previewService.cjs      # Document & media preview generation
│       └── thumbnailService.cjs    # Image & video native thumbnailing
│
├── src/                            # Frontend React 19 Application
│   ├── main.jsx                    # React DOM entry point
│   ├── App.jsx                     # Core Explorer Shell, state, sidebar & layouts
│   ├── AIFeatures.jsx              # AI Search UI Container & Search Orchestrator
│   ├── AdvancedSearch.jsx          # Classic Advanced Search Page
│   ├── ArchiveManager.jsx          # Archive & Compression Page
│   ├── CloudIntegration.jsx        # Cloud Providers & Sync Page
│   ├── DeveloperFeatures.jsx       # Developer Tools & Utilities Page
│   ├── NetworkFeatures.jsx         # Network Shares & Discovery Page
│   ├── OCRManager.jsx              # OCR Text Extraction Page
│   ├── SecurityManager.jsx         # Security & Permissions Page
│   ├── StorageAnalytics.jsx        # Storage Analysis & Capacity Page
│   ├── FilePreview.jsx             # Quick Preview Overlay
│   ├── components/
│   │   └── ai-search/              # Dedicated AI Search Frontend
│   │       ├── AISearchSettings.jsx# 9 Configuration Panels
│   │       ├── SearchResultsArea.jsx# Results, Preview, Loading & Empty States
│   │       └── mockData.js         # Frontend interactive preview data
│   └── utils/                      # Helper utilities (format, debounce, path, sort)
│
└── docs/                           # Architectural Documentation
    └── ai-search/                  # AI Search Design & Phase Documentation
```

---

## 2. Electron Main & Preload Architecture

- **Electron Version**: `43.3.0`
- **Main Entry**: `electron.cjs`
- **Preload Scripts**:
  1. `preload.cjs` → exposes `window.fileExplorer` for base explorer routines (drives, readDirectory, openItem, thumbnails, file associations, preview).
  2. `preload-features.cjs` → exposes `window.electronFeatures` for extended tool operations (storage, security, cloud, network, developer, archive, OCR).
- **Process Isolation**:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: false`
  - Custom protocol: `local-media://` registered for secure media streaming.

---

## 3. Existing Search & AI Implementations

1. **Classic Search (`searchService.cjs`)**:
   - Implements synchronous and streaming file system walk.
   - Provides a custom query parser for tokenizing filters (`name:`, `type:`, `size:`, `date:`).
   - Text search within plain-text file extensions.
2. **Legacy AI Service (`electron/services/ai/`)**:
   - Built on top of simple JSON storage (`ai_cache.json`, `ai_index.json` in user home directory).
   - Basic cosine similarity search over static vector arrays.
   - Separate from the new local-first, SQLite-backed, hardware-adaptive AI Search engine architecture.

---

## 4. Dependencies Relevant to AI Search

- Current dependencies:
  - `@aws-sdk/client-s3`, `@aws-sdk/lib-storage` (Cloud storage)
  - `basic-ftp`, `ssh2-sftp-client`, `webdav` (Remote network storage)
  - `pdf-parse` (PDF text extraction)
  - `react`, `react-dom` (React 19 UI)
- **Part 1 Decision**: No additional dependencies are installed in Part 1 to ensure complete dependency safety and isolation.

---

## 5. Safety Constraints & Inviolable Rules

1. **DO NOT MODIFY Core Explorer Shell**: The left navigation bar, drive list, folder grid/list views, breadcrumbs, status bar, and tab management must remain intact.
2. **NO Premature Indexing / File Watchers**: Part 1 establishes contracts and boundaries only. No background file watchers, database creation, or model loading are initiated.
3. **Dedicated Module Location**: All new AI Search backend code will reside inside `electron/ai-search/` using modular CommonJS `.cjs` files.
