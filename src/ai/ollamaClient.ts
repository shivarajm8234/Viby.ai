import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

function loadEnv() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const envPath = path.join(workspaceFolders[0].uri.fsPath, '.env');
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
            return;
        }
    }
    // Fallback to extension root for dev
    dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
}

loadEnv();

export interface AIResponse {
    summary: {
        risk_score: number;
        risk_level: string;
        confidence: string;
    };
    vulnerabilities: any[];
    secrets: any[];
    auth_issues: any[];
    dependency_issues: any[];
    repo_analysis: any;
}

export class OllamaClient {
    private baseUrl = 'http://127.0.0.1:11434/api';
    private groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    private groqKey = process.env.GROQ_API_KEY || '';

    public async getModels(): Promise<string[]> {
        const localModels: string[] = [];
        const groqModels: string[] = [];

        // Fetch Local Models
        try {
            const response = await axios.get(`${this.baseUrl}/tags`, { timeout: 2000 });
            if (response.data && response.data.models) {
                localModels.push(...response.data.models.map((m: any) => m.name));
            }
        } catch (error: any) {
            console.error('Failed to fetch local models:', error.message);
        }

        // Fetch Groq Models
        if (this.groqKey) {
            try {
                const response = await axios.get('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${this.groqKey}` }
                });
                if (response.data && response.data.data) {
                    groqModels.push(...response.data.data.map((m: any) => m.id));
                }
            } catch (error: any) {
                console.error('Failed to fetch Groq models:', error.message);
                // Fallback to basic Groq models if fetch fails
                groqModels.push('llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768');
            }
        } else {
            groqModels.push('llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768');
        }

        const allModels = [...groqModels, ...localModels];
        return allModels.length > 0 ? allModels : ['llama3'];
    }

    public async analyze(prompt: string, model: string = 'llama3-70b-8192'): Promise<AIResponse> {
        // Broaden detection for Groq models (including newer versions)
        const isGroqModel = model.includes('llama') || 
                            model.includes('mixtral') || 
                            model.includes('gemma') || 
                            model.includes('whisper') ||
                            model.includes('distil-whisper');

        if (isGroqModel && this.groqKey) {
            return this.analyzeGroq(prompt, model);
        }

        try {
            const response = await axios.post(`${this.baseUrl}/generate`, {
                model: model,
                prompt: prompt,
                stream: false,
                format: 'json'
            }, { timeout: 0 });

            return JSON.parse(response.data.response);
        } catch (error: any) {
            console.error('Ollama analysis failed:', error.message);
            // Fallback to Groq if local fails? Or just throw
            throw new Error(`Ollama Error: ${error.message}`);
        }
    }

    private async analyzeGroq(prompt: string, model: string): Promise<AIResponse> {
        try {
            const response = await axios.post(this.groqUrl, {
                model: model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.groqKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return JSON.parse(response.data.choices[0].message.content);
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error(`Groq Error: Unauthorized (401). Please check your GROQ_API_KEY in .env`);
            }
            console.error('Groq analysis failed:', error.response?.data || error.message);
            throw new Error(`Groq Error: ${error.message}`);
        }
    }

    public generatePrompt(context: any, input: any): string {
    return `
You are an elite application security auditor and defensive penetration tester.
Perform a deep security audit of the provided code. 

STRICT RULES:
- Output STRICT JSON only.
- Detect ALL vulnerabilities (Command Injection, Path Traversal, SSRF, SQLi, XSS, etc.).
- Provide a clear explanation of the risk.
- **CRITICAL: The 'fix' field MUST contain ONLY the raw, pure, executable code for the fix.**
- **NO CONVERSATIONAL TEXT** inside the 'fix' field.
- If terminal commands are needed (e.g., install a package), include them ONLY as COMMENTS at the top of the 'fix' code.
- Example 'fix': "// npm install DOMPurify\\nimport DOMPurify from 'dompurify';\\n..."
- Do NOT wrap the 'fix' field in markdown (\`\`\`).

CONTEXT:
- Language: ${context.language}
- Framework: ${context.framework}
- File Name: ${context.filename}
- Entry Points: ${JSON.stringify(context.entry_points)}

INPUT CODE:
${input.code}

OUTPUT FORMAT (JSON):
{
  "summary": { "risk_score": 0-100 (MUST BE A NUMBER), "risk_level": "low|medium|high|critical", "confidence": "high" },
  "vulnerabilities": [{ 
    "type": "...", 
    "severity": "...", 
    "line": number, 
    "title": "...", 
    "explanation": "...", 
    "attack_simulation": "...", 
    "fix": "RAW CODE ONLY (with commands as comments)", 
    "exploitability": "..." 
  }],
  "secrets": [],
  "auth_issues": [],
  "repo_analysis": { "attack_surface_summary": "..." }
}
`;
}

    public generateAttackSimulationPrompt(context: any, input: any): string {
    return `
You are an elite offensive security AI.
Simulate a multi-vector attack against the provided application context.

STRICT RULES:
- Output STRICT JSON only.
- For each attack, provide a 'target_line' if possible.
- **The 'resolve_technique' field MUST be RAW EXECUTABLE CODE for the fix.**
- Any instructions or commands MUST be COMMENTS in the 'resolve_technique' code.
- **NO EXPLANATORY TEXT** in the 'resolve_technique' field.

CONTEXT:
- Files: ${context.files.join(', ')}

VULNERABILITIES FOUND:
${JSON.stringify(input.vulnerabilities)}

OUTPUT FORMAT (JSON):
{
  "risk_score": 0-100 (MUST BE A NUMBER),
  "attacks": [{
    "target_file": "...",
    "target_line": number,
    "attack_vector": "...",
    "description": "...",
    "attack_simulation_steps": ["step 1...", "step 2..."],
    "exploit_payload": "...",
    "resolve_technique": "RAW FIX CODE ONLY (with commands as comments)"
  }],
  "summary": "..."
}
`;
    }
}
