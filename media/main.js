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
        case 'attackResults':
            renderAttackResults(message.data);
            break;
    }
});

document.addEventListener('click', (e) => {
    // Check if the click was on or inside a navigate item
    const navItem = e.target.closest('.action-navigate');
    // But don't navigate if they clicked the fix button
    if (navItem && !e.target.closest('.action-fix-btn')) {
        const file = navItem.getAttribute('data-file');
        const line = parseInt(navItem.getAttribute('data-line'), 10);
        vscode.postMessage({ type: 'navigate', file, line });
        return;
    }

    if (e.target && e.target.classList.contains('action-fix-btn')) {
        e.stopPropagation();
        const btn = e.target;
        const file = btn.getAttribute('data-file');
        const line = parseInt(btn.getAttribute('data-line'), 10);
        const fix = decodeURIComponent(btn.getAttribute('data-fix'));
        vscode.postMessage({ type: 'applyFix', file, line, fix });
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
                    <div class="vuln-item clickable action-navigate" style="border-color: ${getSeverityColor(v.severity)}" data-file="${res.file}" data-line="${v.line}">
                        <h4>${v.title}</h4>
                        <p>${v.explanation}</p>
                        <button class="fix-btn action-fix-btn" data-file="${res.file}" data-line="${v.line}" data-fix="${encodeURIComponent(v.fix || '')}">SECURE FIX</button>
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

    // Add initialize attack button
    const attackBtn = document.createElement('button');
    attackBtn.className = 'primary-btn';
    attackBtn.style.marginTop = '15px';
    attackBtn.style.width = '100%';
    attackBtn.style.background = 'linear-gradient(135deg, var(--danger), var(--warning))';
    attackBtn.innerText = 'INITIALIZE ATTACKS';
    attackBtn.onclick = () => {
        const model = document.getElementById('model-select').value;
        vscode.postMessage({ type: 'simulateAttacks', model });
        document.getElementById('status').innerText = 'Initializing attack simulation...';
    };
    container.appendChild(attackBtn);
}

function renderAttackResults(data) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    const riskScore = data.risk_score || 0;
    const scoreCard = document.createElement('div');
    scoreCard.className = 'card';
    scoreCard.innerHTML = `
        <div class="score-circle" style="border-color: ${riskScore > 70 ? 'var(--danger)' : 'var(--accent-primary)'}">
            ${riskScore}
        </div>
        <div style="text-align: center; font-size: 0.8rem; color: #94a3b8;">OVERALL RISK SCORE</div>
    `;
    container.appendChild(scoreCard);

    const summaryCard = document.createElement('div');
    summaryCard.className = 'card';
    summaryCard.style.border = '1px solid var(--warning)';
    summaryCard.innerHTML = `
        <div class="card-title" style="color: var(--warning)">⚠️ ATTACK SUMMARY</div>
        <p style="font-size: 0.85rem; color: #cbd5e1;">${data.summary || 'No summary provided.'}</p>
    `;
    container.appendChild(summaryCard);

    (data.attacks || []).forEach(attack => {
        const attackCard = document.createElement('div');
        attackCard.className = 'card';
        attackCard.innerHTML = `
            <div class="card-title" style="color: var(--danger)">🎯 Target: ${attack.target_file || 'Unknown'}</div>
            <div class="vuln-item" style="border-color: var(--danger)">
                <h4>${attack.attack_vector || 'Unknown Attack Vector'}</h4>
                <p>${attack.description || 'No description provided.'}</p>
                
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--glass-border)">
                    <strong style="color: var(--danger); font-size: 0.75rem;">ATTACK EXECUTION (HOW & WHAT):</strong>
                    <ol style="margin-top: 4px; padding-left: 20px; font-size: 0.75rem; color: #cbd5e1; margin-bottom: 8px;">
                        ${(attack.attack_simulation_steps || ['Analysis initialized.']).map(step => `<li>${step}</li>`).join('')}
                    </ol>
                    <strong style="color: var(--warning); font-size: 0.75rem;">EXPLOIT PAYLOAD:</strong>
                    <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 0.7rem; color: #f87171; margin-top: 4px; white-space: pre-wrap; word-break: break-all;"><code>${(attack.exploit_payload || 'N/A').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                </div>
                
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--glass-border)">
                    <strong style="color: var(--success); font-size: 0.75rem;">RESOLVE TECHNIQUE:</strong>
                    <p style="color: var(--success); font-size: 0.75rem; margin-top: 4px;">${attack.resolve_technique || 'Manual review required.'}</p>
                </div>
            </div>
        `;
        container.appendChild(attackCard);
    });
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


