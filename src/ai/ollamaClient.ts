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

    public async analyze(prompt: string, model: string = 'llama3'): Promise<AIResponse> {
        try {
            const response = await axios.post(`${this.baseUrl}/generate`, {
                model: model,
                prompt: prompt,
                stream: false,
                format: 'json'
            }, { timeout: 30000 }); // Longer timeout for generation

            return JSON.parse(response.data.response);
        } catch (error: any) {
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
- Detect SQL Injection, XSS, CSRF, Insecure Auth, IDOR, etc.
- Provide a clear explanation and a MINIMAL SECURE FIX.
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
    "type": "SQL Injection | XSS | etc", 
    "severity": "low|medium|high|critical", 
    "line": number, 
    "title": "short title", 
    "explanation": "why risky", 
    "attack_simulation": "how to abuse (high-level)", 
    "fix": "secure code replacement", 
    "exploitability": "low|medium|high" 
  }],
  "secrets": [],
  "auth_issues": [],
  "repo_analysis": { "attack_surface_summary": "..." }
}
`;
    }
}
