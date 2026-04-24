const vscode = acquireVsCodeApi();

console.log('Viby: Sidebar loaded.');

// Signal that the webview is ready
vscode.postMessage({ type: 'ready' });

document.getElementById('scan-btn').addEventListener('click', () => {
    const model = document.getElementById('model-select').value;
    vscode.postMessage({ type: 'scan', model });
    document.getElementById('status').innerText = 'Initializing scan...';
});

document.getElementById('github-btn').addEventListener('click', () => {
    const url = prompt('Enter GitHub Repository URL:');
    if (url) {
        vscode.postMessage({ type: 'github-scan', url });
    }
});

window.addEventListener('message', event => {
    const message = event.data;
    console.log('Viby: Message received:', message.type);
    switch (message.type) {
        case 'models':
            populateModels(message.models);
            break;
        case 'status':
            document.getElementById('status').innerText = message.message;
            break;
        case 'results':
            renderResults(message.data);
            break;
    }
});

function populateModels(models) {
    console.log('Viby: Populating models:', models);
    const select = document.getElementById('model-select');
    if (models.length === 0) {
        select.innerHTML = '<option value="llama3">llama3 (Default)</option>';
        return;
    }
    select.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
}

function renderResults(data) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    const avgScore = data.aiResults.length > 0 
        ? Math.round(data.aiResults.reduce((acc, r) => acc + (r.summary?.risk_score || 0), 0) / data.aiResults.length)
        : 0;

    const scoreCard = document.createElement('div');
    scoreCard.className = 'card';
    scoreCard.innerHTML = `
        <div class="score-circle" style="border-color: ${avgScore > 70 ? 'var(--danger)' : 'var(--accent-primary)'}">
            ${avgScore}
        </div>
        <div style="text-align: center; font-size: 0.8rem; color: #94a3b8;">RISK VIBE SCORE</div>
    `;
    container.appendChild(scoreCard);

    data.aiResults.forEach(res => {
        if (res.vulnerabilities && res.vulnerabilities.length > 0) {
            const resCard = document.createElement('div');
            resCard.className = 'card';
            resCard.innerHTML = `
                <div class="card-title">${res.file} AI INSIGHTS</div>
                ${res.vulnerabilities.map(v => `
                    <div class="vuln-item clickable" style="border-color: ${getSeverityColor(v.severity)}" onclick="navigate('${res.file}', ${v.line})">
                        <h4>${v.title}</h4>
                        <p>${v.explanation}</p>
                        <button class="fix-btn">SECURE FIX</button>
                    </div>
                `).join('')}
            `;
            container.appendChild(resCard);
        }
    });

    // Attack Simulation Report
    const summaryCard = document.createElement('div');
    summaryCard.className = 'card';
    summaryCard.style.border = '1px solid var(--accent-primary)';
    summaryCard.innerHTML = `
        <div class="card-title" style="color: var(--accent-primary)">🛡️ ATTACK SIMULATION REPORT</div>
        <div style="font-size: 0.8rem; margin-bottom: 12px;">
            Overall Vibe Rating: <strong style="color: ${avgScore > 70 ? 'var(--danger)' : 'var(--success)'}">${avgScore}/100</strong>
        </div>
        <div class="vuln-item" style="border-color: var(--accent-secondary); background: rgba(129, 140, 248, 0.05)">
            <h4>Executive Summary</h4>
            <p>${generateSummary(data)}</p>
        </div>
    `;
    container.appendChild(summaryCard);
}

function generateSummary(data) {
    const totalVulns = data.aiResults.reduce((acc, r) => acc + (r.vulnerabilities?.length || 0), 0);
    const criticals = data.aiResults.reduce((acc, r) => acc + (r.vulnerabilities?.filter(v => v.severity === 'critical' || v.severity === 'high').length || 0), 0);
    if (totalVulns === 0) return "No critical vulnerabilities detected.";
    return `Detected ${totalVulns} risks across ${data.aiResults.length} files. ${criticals} are high-impact.`;
}

function getSeverityColor(sev) {
    switch(sev?.toLowerCase()) {
        case 'critical':
        case 'high': return 'var(--danger)';
        case 'medium': return 'var(--warning)';
        default: return 'var(--success)';
    }
}

function navigate(file, line) {
    vscode.postMessage({ type: 'navigate', file, line });
}
