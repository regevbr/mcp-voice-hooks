class VoiceHooksClient {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.utteranceInput = document.getElementById('utteranceInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.utterancesList = document.getElementById('utterancesList');
        this.totalCount = document.getElementById('totalCount');
        this.pendingCount = document.getElementById('pendingCount');
        this.deliveredCount = document.getElementById('deliveredCount');
        
        this.setupEventListeners();
        this.loadData();
        
        // Auto-refresh every 2 seconds
        setInterval(() => this.loadData(), 2000);
    }
    
    setupEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendUtterance());
        this.refreshBtn.addEventListener('click', () => this.loadData());
        
        this.utteranceInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendUtterance();
            }
        });
    }
    
    async sendUtterance() {
        const text = this.utteranceInput.value.trim();
        if (!text) return;
        
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = 'Sending...';
        
        try {
            const response = await fetch(`${this.baseUrl}/api/potential-utterances`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    timestamp: new Date().toISOString()
                }),
            });
            
            if (response.ok) {
                this.utteranceInput.value = '';
                this.loadData(); // Refresh the list
            } else {
                const error = await response.json();
                alert(`Error: ${error.error || 'Failed to send utterance'}`);
            }
        } catch (error) {
            console.error('Failed to send utterance:', error);
            alert('Failed to send utterance. Make sure the server is running.');
        } finally {
            this.sendBtn.disabled = false;
            this.sendBtn.textContent = 'Send';
        }
    }
    
    async loadData() {
        try {
            // Load status
            const statusResponse = await fetch(`${this.baseUrl}/api/utterances/status`);
            if (statusResponse.ok) {
                const status = await statusResponse.json();
                this.updateStatus(status);
            }
            
            // Load utterances
            const utterancesResponse = await fetch(`${this.baseUrl}/api/utterances?limit=20`);
            if (utterancesResponse.ok) {
                const data = await utterancesResponse.json();
                this.updateUtterancesList(data.utterances);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }
    
    updateStatus(status) {
        this.totalCount.textContent = status.total;
        this.pendingCount.textContent = status.pending;
        this.deliveredCount.textContent = status.delivered;
    }
    
    updateUtterancesList(utterances) {
        if (utterances.length === 0) {
            this.utterancesList.innerHTML = '<div class="empty-state">No utterances yet. Type something above to get started!</div>';
            return;
        }
        
        this.utterancesList.innerHTML = utterances.map(utterance => `
            <div class="utterance-item">
                <div class="utterance-text">${this.escapeHtml(utterance.text)}</div>
                <div class="utterance-meta">
                    <div>${this.formatTimestamp(utterance.timestamp)}</div>
                    <div class="utterance-status status-${utterance.status}">
                        ${utterance.status.toUpperCase()}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VoiceHooksClient();
});