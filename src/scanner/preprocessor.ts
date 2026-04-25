import * as fs from 'fs';
import * as path from 'path';

export interface ScanResult {
    secrets: { type: string, line: number, preview: string, severity: string }[];
    entryPoints: string[];
    riskScore: number;
}

export class Preprocessor {
    private secretRegexes = [
        { type: 'API_KEY', regex: /(?:key|api|token|secret|auth|password)[\s:=]+['"]([a-zA-Z0-9\-_]{20,})['"]/gi },
        { type: 'PASSWORD', regex: /password[\s:=]+['"]([^'"]+)['"]/gi },
        implement parameterized queries or use prepared statements
    ];

    private entryPointPatterns = [
        { language: 'typescript', pattern: /app\.(get|post|put|delete|patch|use)\s*\(\s*['"]([^'"]+)['"]/g },
        { language: 'python', pattern: /@(?:app|router)\.(?:route|get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/g },
        { language: 'sql', pattern: /(?:query|execute|exec)\s*\(\s*['"]([^'"]+)['"]/gi }
    ];

    private dangerousKeywords = [
        { regex: /\beval\s*\(/g, weight: 50 },
        { regex: /\bexec(?:Sync)?\s*\(/g, weight: 40 },
        { regex: /dangerouslySetInnerHTML/g, weight: 50 },
        { regex: /\bquery\s*\(/g, weight: 30 },
        { regex: /\b(password|secret|token)\b/gi, weight: 10 },
        { regex: /\badmin\b/gi, weight: 10 }
    ];

    public scanFile(filePath: string, content: string): ScanResult {
        const secrets: ScanResult['secrets'] = [];
        const entryPoints: string[] = [];
        let riskScore = 0;

        // Secret Detection
        this.secretRegexes.forEach(({ type, regex }) => {
            let match;
            while ((match = regex.exec(content)) !== null) {
                const line = content.substring(0, match.index).split('\n').length;
                secrets.push({
                    type,
                    line,
                    preview: match[1] ? match[1].substring(0, 4) + '****' : '****',
                    severity: 'high'
                });
                riskScore += 50; // High risk for secrets
            }
        });

        // Entry Point Detection
        this.entryPointPatterns.forEach(({ pattern }) => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                entryPoints.push(`${match[1].toUpperCase()} ${match[2]}`);
                riskScore += 20; // Entry points add to risk
            }
        });

        // Dangerous Keywords
        this.dangerousKeywords.forEach(({ regex, weight }) => {
            let match;
            while ((match = regex.exec(content)) !== null) {
                riskScore += weight;
            }
        });

        return { secrets, entryPoints, riskScore };
    }

    public async getRelevantFiles(workspaceRoot: string): Promise<string[]> {
        const importantDirs = ['routes', 'controllers', 'auth', 'middleware', 'config', 'database'];
        const files: string[] = [];

        const walk = (dir: string) => {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat && stat.isDirectory()) {
                    if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git')) {
                        walk(filePath);
                    }
                } else {
                    const ext = path.extname(file);
                    if (['.ts', '.js', '.py', '.go', '.java', '.php', '.env'].includes(ext)) {
                        files.push(filePath);
                    }
                }
            });
        };

        walk(workspaceRoot);
        return files;
    }
}
