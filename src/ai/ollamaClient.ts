import axios from 'axios';

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

    public async getModels(): Promise<string[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/tags`, { timeout: 2000 });
            if (response.data && response.data.models) {
                return response.data.models.map((m: any) => m.name);
            }
            return ['llama3'];
        } catch (error: any) {
            console.error('Failed to fetch models:', error.message);
            return ['llama3 (Offline)'];
        }
    }

    public async analyze(prompt: string, model: string = 'llama3'): Promise < AIResponse > {
    try {
        const response = await axios.post(`${this.baseUrl}/generate`, {
            model: model,
            prompt: prompt,
            stream: false,
            format: 'json'
        }, { timeout: 0 }); // No timeout to support slower local inference

        return JSON.parse(response.data.response);
    } catch(error: any) {
        console.error('Ollama analysis failed:', error.message);
        throw new Error(`Ollama Error: ${error.message}`);
    }
}

    public generatePrompt(context: any, input: any): string {
    return `
You are an elite application security auditor and defensive penetration tester.
Perform a deep security audit of the provided code. 

STRICT RULES:
- Output STRICT JSON only.
- Detect ALL vulnerabilities including Command Injection, Path Traversal, SSRF, Deserialization, Broken Access Control, XXE, SQL Injection, XSS, CSRF, Insecure Auth, IDOR, etc.
- Provide a clear explanation of the risk.
- For the 'fix' field, provide ONLY the raw, pure drop-in replacement code. Do NOT wrap it in markdown code blocks (e.g., no \`\`\` language blocks) and do NOT include any conversational explanations of what changes should be done inside the 'fix' field.
- Performance: Focus on logical flaws, not just syntax.

CONTEXT:
- Language: ${context.language}
- Framework: ${context.framework}
- File Name: ${context.filename}
- Entry Points: ${JSON.stringify(context.entry_points)}

INPUT CODE:
${input.code}

OUTPUT FORMAT (JSON):
{
  "summary": { "risk_score": number, "risk_level": "low|medium|high|critical", "confidence": "high" },
  "vulnerabilities": [{ 
    "type": "Command Injection | Path Traversal | SSRF | SQL Injection | XSS | XXE | etc", 
    "severity": "low|medium|high|critical", 
    "line": number, 
    "title": "short title", 
    "explanation": "why risky", 
    "attack_simulation": "how to abuse (high-level)", 
    "fix": "RAW SECURE CODE ONLY (no markdown, no explanation)", 
    "exploitability": "low|medium|high" 
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
- Determine what attacks are happening, risk score, resolve techniques, and summary.

CONTEXT:
- Files: ${context.files.join(', ')}

VULNERABILITIES FOUND:
${JSON.stringify(input.vulnerabilities)}

OUTPUT FORMAT (JSON):
{
  "risk_score": number,
  "attacks": [{
    "target_file": "...",
    "attack_vector": "...",
    "description": "...",
    "attack_simulation_steps": ["step 1...", "step 2..."],
    "exploit_payload": "...",
    "resolve_technique": "..."
  }],
  "summary": "..."
}
`;
    }
}
