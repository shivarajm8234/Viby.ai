import * as fs from 'fs';
import * as path from 'path';

export interface ScanResult {
    secrets: { type: string, line: number, preview: string, severity: string }[];
    entryPoints: string[];
}

export class Preprocessor {
    private secretRegexes = [
        { type: 'API_KEY', regex: /(?:key|api|token|secret|auth|password)[\s:=]+['"]([a-zA-Z0-9\-_]{20,})['"]/gi },
        { type: 'PASSWORD', regex: /password[\s:=]+['"]([^'"]+)['"]/gi },
        { type: 'PRIVATE_KEY', regex: /-----BEGIN (?:RSA|OPENSSH|PRIVATE) KEY-----/g }
    ];

    private entryPointPatterns = [
        { language: 'typescript', pattern: /app\.(get|post|put|delete|patch|use)\s*\(\s*['"]([^'"]+)['"]/g },
        { language: 'python', pattern: /@(?:app|router)\.(?:route|get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/g }
    ];

    public scanFile(filePath: string, content: string): ScanResult {
        const secrets: ScanResult['secrets'] = [];
        const entryPoints: string[] = [];

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
            }
        });

        // Entry Point Detection
        this.entryPointPatterns.forEach(({ pattern }) => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                entryPoints.push(`${match[1].toUpperCase()} ${match[2]}`);
            }
        });

        return { secrets, entryPoints };
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
