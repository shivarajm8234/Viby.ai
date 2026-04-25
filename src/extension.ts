replace with parameterized queries
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { Preprocessor } from './scanner/preprocessor';
import { OllamaClient } from './ai/ollamaClient';

export function activate(context: vscode.ExtensionContext) {
    const preprocessor = new Preprocessor();
    const aiClient = new OllamaClient();
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('viby-sec');
    const outputChannel = vscode.window.createOutputChannel('Viby Security Scan');

    let sidebarProvider: SecuritySidebarProvider;
    sidebarProvider = new SecuritySidebarProvider(context.extensionUri, preprocessor, aiClient, diagnosticCollection, outputChannel);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('viby-sec-auditor.sidebar', sidebarProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('viby-sec-auditor.scan', async () => {
            await sidebarProvider.scanWorkspace();
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('*', new SecurityCodeActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('viby-sec-auditor.applyFix', (filePath: string, range: vscode.Range, fix: string) => {
            const edit = new vscode.WorkspaceEdit();
            const uri = vscode.Uri.file(filePath);
            edit.replace(uri, range, fix);
            vscode.workspace.applyEdit(edit);
        })
    );
}

class SecurityCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext): vscode.CodeAction[] {
        const diagnostics = context.diagnostics.filter(d => d.source === 'Viby Security');
        return diagnostics.map(d => this.createFixAction(document, d));
    }

    private createFixAction(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = (diagnostic as any).fixContent;
        if (!fix) return new vscode.CodeAction('Analyze with Viby', vscode.CodeActionKind.QuickFix);

        const action = new vscode.CodeAction('🛡️ Fix with Viby AI', vscode.CodeActionKind.QuickFix);
        action.command = {
            command: 'viby-sec-auditor.applyFix',
            title: 'Apply Secure Fix',
            arguments: [document.uri.fsPath, diagnostic.range, fix]
        };
        action.isPreferred = true;
        return action;
    }
}

class SecuritySidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _selectedModel: string = 'llama3';
    private _lastResults: any[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _preprocessor: Preprocessor,
        private readonly _aiClient: OllamaClient,
        private readonly _diagnosticCollection: vscode.DiagnosticCollection,
        private readonly _outputChannel: vscode.OutputChannel
    ) { }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Attach listener BEFORE setting HTML to avoid race conditions
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'ready':
                    this._outputChannel.appendLine('📬 Webview ready signal received.');
                    const models = await this._aiClient.getModels();
                    this._outputChannel.appendLine(`📦 Sending ${models.length} models to webview.`);
                    webviewView.webview.postMessage({ type: 'models', models });
                    break;
                case 'scan':
                    this._selectedModel = data.model;
                    await this.scanWorkspace();
                    break;
                case 'github-scan':
                    await this.scanGitHubRepo(data.url);
                    break;
                case 'navigate':
                    this._openFile(data.file, data.line);
                    break;
                case 'applyFix':
                    this._applyFix(data.file, data.line, data.fix);
                    break;
                case 'simulateAttacks':
                    this._simulateAttacks(data.model);
                    break;
            }
        });

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    private async scanGitHubRepo(url: string) {
        if (!this._view) return;

        try {
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
            if (!session) return;

            this._view.webview.postMessage({ type: 'status', message: 'Connecting to GitHub...' });

            // Basic URL parsing (e.g., https://github.com/owner/repo)
            const parts = url.replace('https://github.com/', '').split('/');
            if (parts.length < 2) throw new Error('Invalid GitHub URL');
            const owner = parts[0];
            const repo = parts[1];

            const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`, {
                headers: { Authorization: `token ${session.accessToken}` }
            });

            this._view.webview.postMessage({ type: 'status', message: `Fetched GitHub repo. Scanning \${response.data.length} files...` });

            // Logic to chunk and scan files from GitHub would go here
            // For now, let's simulate the results
            this._view.webview.postMessage({ type: 'status', message: 'GitHub Scan not fully implemented in this demo, but authentication succeeded!' });
        } catch (e: any) {
            this._view.webview.postMessage({ type: 'status', message: `❌ GitHub Error: ${e.message}` });
        }
    }

    private async _openFile(fileName: string, line: number) {
        const files = await vscode.workspace.findFiles(`**/${fileName}`);
        if (files.length > 0) {
            const doc = await vscode.workspace.openTextDocument(files[0]);
            const editor = await vscode.window.showTextDocument(doc);
            const range = new vscode.Range(line - 1, 0, line - 1, 0);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    }

    private async _applyFix(fileName: string, line: number, fix: string) {
        const files = await vscode.workspace.findFiles(`**/${fileName}`);
        if (files.length > 0) {
            const doc = await vscode.workspace.openTextDocument(files[0]);
            const edit = new vscode.WorkspaceEdit();
            const lineIndex = line - 1;
            if (lineIndex >= 0 && lineIndex < doc.lineCount) {
                const lineRange = doc.lineAt(lineIndex).range;
                edit.replace(files[0], lineRange, fix);
                await vscode.workspace.applyEdit(edit);

                const editor = await vscode.window.showTextDocument(doc);
                const newLines = fix.split('\n').length;
                const endLine = lineIndex + newLines - 1;
                const endChar = fix.split('\n').pop()?.length || 0;

                const newRange = new vscode.Range(lineIndex, 0, endLine, endChar);
                editor.selection = new vscode.Selection(newRange.start, newRange.end);
                editor.revealRange(newRange, vscode.TextEditorRevealType.InCenter);

                vscode.window.showInformationMessage(`Viby AI: Applied secure fix to ${fileName}`);
                await doc.save();
            }
        }
    }

    private async _simulateAttacks(model: string) {
        if (!this._view) return;
        this._view.webview.postMessage({ type: 'status', message: 'Initializing attack simulation...' });

        const prompt = this._aiClient.generateAttackSimulationPrompt(
            { files: this._lastResults.map(r => r.file) },
            { vulnerabilities: this._lastResults.flatMap(r => r.vulnerabilities || []) }
        );

        try {
            const aiResult = await this._aiClient.analyze(prompt, model);
            this._view.webview.postMessage({ type: 'attackResults', data: aiResult });
            this._view.webview.postMessage({ type: 'status', message: 'Attack simulation complete.' });
        } catch (e: any) {
            this._view.webview.postMessage({ type: 'status', message: `❌ Attack Sim Error: ${e.message}` });
        }
    }

    public async scanWorkspace() {
        if (!this._view) return;

        try {
            this._outputChannel.clear();
            this._outputChannel.show(true);
            this._outputChannel.appendLine('🚀 Starting Viby Security Scan...');
            this._outputChannel.appendLine(`🧠 Using AI Model: ${this._selectedModel}`);

            this._diagnosticCollection.clear();
            this._view.webview.postMessage({ type: 'status', message: 'Detecting files...' });

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;

            const rootPath = workspaceFolders[0].uri.fsPath;
            const files = await this._preprocessor.getRelevantFiles(rootPath);

            this._outputChannel.appendLine(`🔍 Found ${files.length} relevant files in workspace. Running local heuristics...`);

            let allSecrets: any[] = [];
            let results: any[] = [];
            let scoredFiles: { file: string, result: any, score: number }[] = [];

            // Phase 1: Local Pre-Scan for Risk Triage
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf8');
                const localResult = this._preprocessor.scanFile(file, content);

                // Keep all detected secrets
                const fileName = path.basename(file);
                allSecrets.push(...localResult.secrets.map(s => ({ ...s, file: fileName })));

                scoredFiles.push({ file, result: localResult, score: localResult.riskScore });
            }

            // Phase 2: Prioritize High-Risk Files but SCAN ALL
            scoredFiles.sort((a, b) => b.score - a.score);

            this._outputChannel.appendLine(`⚠️ Identified ${scoredFiles.length} files for AI analysis.`);
            this._outputChannel.appendLine(`🧠 Deep scanning ALL files, prioritizing highest risk first...`);

            for (const item of scoredFiles) {
                const fileName = path.basename(item.file);
                this._outputChannel.appendLine(`\n----------------------------------------`);
                this._outputChannel.appendLine(`📝 Deep Analyzing: ${fileName} (Risk Score: ${item.score})`);

                const content = fs.readFileSync(item.file, 'utf8');

                // Truncate massive files to save LLM context
                const scanContent = content.length > 8000 ? content.substring(0, 8000) + '\n...[TRUNCATED]' : content;

                const prompt = this._aiClient.generatePrompt(
                    { language: path.extname(item.file), filename: fileName, entry_points: item.result.entryPoints },
                    { code: scanContent }
                );

                try {
                    const aiResult = await this._aiClient.analyze(prompt, this._selectedModel);
                    this._outputChannel.appendLine(`   - AI analysis: Detected ${aiResult.vulnerabilities?.length || 0} vulnerabilities.`);

                    aiResult.vulnerabilities?.forEach(v => {
                        this._outputChannel.appendLine(`     [!] ${v.severity.toUpperCase()}: ${v.title}`);
                    });

                    results.push({ file: fileName, ...aiResult });
                } catch (aiErr: any) {
                    this._outputChannel.appendLine(`   - AI Error: ${aiErr.message}`);
                }
            }

            this._outputChannel.appendLine(`\n----------------------------------------`);
            this._outputChannel.appendLine(`✅ Scan Complete. Sending results to dashboard.`);
            this._lastResults = results;
            this._view.webview.postMessage({ type: 'results', data: { secrets: allSecrets, aiResults: results } });
        } catch (e: any) {
            this._outputChannel.appendLine(`❌ Fatal Error: ${e.message}`);
            this._view.webview.postMessage({ type: 'status', message: `❌ Error: ${e.message}` });
        }
    }

    private _getSeverity(sev: string): vscode.DiagnosticSeverity {
        switch (sev?.toLowerCase()) {
            case 'critical':
            case 'high': return vscode.DiagnosticSeverity.Error;
            case 'medium': return vscode.DiagnosticSeverity.Warning;
            default: return vscode.DiagnosticSeverity.Information;
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Viby Security</title>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h1>VIBY.AI <span class="badge">ELITE</span></h1>
                        <p class="subtitle">Advanced AI Sec-Auditor</p>
                    </header>

                    <div class="card">
                        <label>AI BRAIN (MODEL)</label>
                        <select id="model-select">
                            <option value="">Searching for models...</option>
                        </select>
                    </div>

                    <div id="status" class="status-box">Ready for mission...</div>

                    <div class="actions-grid">
                        <button id="scan-btn" class="primary-btn">DEEP SCAN</button>
                        <button id="github-btn" class="secondary-btn">GH SCAN</button>
                    </div>

                    <div id="results-container" class="results-container"></div>
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
