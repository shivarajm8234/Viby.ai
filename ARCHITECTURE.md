# Viby.ai Technical Stack & Architecture 🏗️

This document outlines the technical foundation and architectural design of the Viby Security Auditor extension.

## 🛠️ Technology Stack

### Core Extension
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Runtime**: [Node.js](https://nodejs.org/)
- **API**: [VS Code Extension API](https://code.visualstudio.com/api)
- **Package Manager**: NPM

### AI & Reasoning Engine
- **Groq Cloud API**: High-performance inference engine for Llama 3.1, Mixtral, and Gemma models.
- **Ollama**: Local inference engine for private, offline security audits.
- **Axios**: Promised-based HTTP client for API communication.
- **Dotenv**: Environment variable management for secure API key storage.

### Frontend (Webview)
- **Structure**: Semantic HTML5
- **Styling**: Vanilla CSS (Modern glassmorphism UI, custom scrollbars, vibrant color tokens)
- **Logic**: Vanilla JavaScript (ES6+)
- **Communication**: Bidirectional message passing via `vscode.postMessage` and `onDidReceiveMessage`.

---

## 🏛️ Architectural Overview

The extension follows a decoupled architecture separating the UI logic, the pre-processing engine, and the AI reasoning layer.

### 1. Preprocessor (`src/scanner/preprocessor.ts`)
- **Role**: Performs initial risk assessment and code triage.
- **Logic**: Uses optimized regex patterns for:
    - Secret detection (API keys, tokens, passwords).
    - Entry point identification (Routes, controllers).
    - Dangerous keyword matching (e.g., `eval`, `exec`, `dangerousSetInnerHTML`).
- **Output**: Returns a `riskScore` and a filtered list of high-priority files for AI analysis.

### 2. AI Client (`src/ai/ollamaClient.ts`)
- **Role**: Orchestrates communication with LLM providers.
- **Dynamic Discovery**: Fetches available models from Groq/Ollama APIs at runtime.
- **Prompt Engineering**: 
    - Generates strict JSON-formatted prompts.
    - Enforces "Code Only" output for fixes.
    - Handles multi-step attack simulation logic.
- **Hybrid Routing**: Automatically routes requests to Groq Cloud or Local Ollama based on user selection.

### 3. Sidebar Provider (`src/extension.ts`)
- **Role**: Manages the VS Code Webview lifecycle.
- **State Management**: Persists scan results and selected models within the session.
- **File System Interaction**: 
    - Uses `vscode.workspace.findFiles` and `path` utilities for accurate file resolution.
    - Manages relative-to-absolute path mapping for secure fixes.
- **Command Dispatcher**: Registers and handles global commands like `Scan Active File`.

### 4. Secure Fix Engine
- **Identification**: Maps AI-detected line numbers to the active text document.
- **Modification**: Uses `vscode.WorkspaceEdit` for atomic, undoable code replacements.
- **Highlighting**: Automatically reveals and selects the patched code in the editor for user verification.

---

## 🔄 Data Flow

1. **Trigger**: User clicks "DEEP SCAN" or "SCAN ACTIVE".
2. **Collect**: Preprocessor walks the workspace or reads the active editor content.
3. **Analyze (Local)**: Fast regex scan identifies low-hanging fruit and secrets.
4. **Analyze (AI)**: Extension sends code context + vulnerability findings to Groq/Ollama.
5. **Report**: Webview renders the results using a custom reactive UI.
6. **Fix**: User clicks "SECURE FIX"; the extension applies the `WorkspaceEdit` and highlights the change in the editor.

---

## 📂 Project Structure

```text
Viby.ai/
├── src/
│   ├── extension.ts        # Main entry point & Webview Provider
│   ├── ai/
│   │   └── ollamaClient.ts # AI Integration (Groq & Ollama)
│   └── scanner/
│       └── preprocessor.ts # Local heuristic engine
├── media/
│   ├── main.js             # Webview logic & rendering
│   ├── style.css           # Glassmorphism UI styles
│   └── icon.png            # Extension branding
├── .env                    # Secure API Key storage (Git ignored)
├── .vscodeignore           # Packaging exclusions
└── package.json            # Manifest & dependencies
```
