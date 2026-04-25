# Viby.ai: Elite Security Auditor 🛡️

Viby.ai is an advanced, AI-powered security auditing and penetration testing extension for Visual Studio Code. It combines local heuristics with the power of **Groq Cloud API** and **Ollama** to provide real-time, actionable security insights.

## 🚀 Key Features

- **Hybrid Intelligence**: 
    - **Groq Cloud Support**: Lightning-fast inference using Llama 3.1, Mixtral, and Gemma models via Groq.
    - **Local Ollama Support**: Run private, offline audits using local LLMs.
- **Dynamic Scanning Options**:
    - **Deep Workspace Scan**: Full-scale audit of your entire repository.
    - **Scan Active File**: Instant, targeted security check for the file you are currently editing.
- **Attack Simulation**: Visualize how a vulnerability could be exploited with multi-step attack vectors and exploit payloads.
- **One-Click Secure Fixes**: Apply secure code replacements directly from the dashboard. Fixes include necessary commands as comments (e.g., `// npm install ...`).
- **Secret Detection**: Automatically identifies API keys, passwords, and private tokens before they are committed.
- **Futuristic UI**: High-performance dashboard with glassmorphism aesthetics and real-time risk scoring.

## 🛠️ Setup

1. **Groq Cloud (Recommended)**:
   - Create a `.env` file in your workspace root.
   - Add your key: `GROQ_API_KEY=your_key_here`.
2. **Ollama (Optional Local)**:
   - Ensure [Ollama](https://ollama.com/) is running locally if you prefer offline scanning.

## 📖 Usage

1. Open the **Viby Security** tab in the Activity Bar.
2. Select your preferred **AI Brain (Model)** from the dropdown.
3. Use **DEEP SCAN** for the whole project or **SCAN ACTIVE** for the current file.
4. Explore the **Attack Simulation** to understand risks from an offensive perspective.
5. Click **SECURE FIX** or **APPLY RESOLUTION** to patch vulnerabilities instantly.

## 🔐 Security & Privacy

- Your API keys are managed via `.env` files and are never bundled into the extension package.
- Local scanning (via Ollama) ensures your code never leaves your machine.

---
*Built for developers who take security seriously.*
