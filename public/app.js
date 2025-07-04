class VoiceHooksClient {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.debug = localStorage.getItem('voiceHooksDebug') === 'true';
        this.utteranceInput = document.getElementById('utteranceInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.utterancesList = document.getElementById('utterancesList');
        this.totalCount = document.getElementById('totalCount');
        this.pendingCount = document.getElementById('pendingCount');
        this.deliveredCount = document.getElementById('deliveredCount');
        
        // Voice controls
        this.listenBtn = document.getElementById('listenBtn');
        this.listenBtnText = document.getElementById('listenBtnText');
        this.listeningIndicator = document.getElementById('listeningIndicator');
        this.interimText = document.getElementById('interimText');
        
        // Speech recognition
        this.recognition = null;
        this.isListening = false;
        this.initializeSpeechRecognition();
        
        this.setupEventListeners();
        this.loadData();
        
        // Auto-refresh every 2 seconds
        setInterval(() => this.loadData(), 2000);
    }
    
    initializeSpeechRecognition() {
        // Check for browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error('Speech recognition not supported in this browser');
            this.listenBtn.disabled = true;
            this.listenBtnText.textContent = 'Not Supported';
            return;
        }
        
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        // Handle results
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    // User paused - send as complete utterance
                    this.sendVoiceUtterance(transcript);
                    // Clear interim text
                    this.interimText.textContent = '';
                    this.interimText.classList.remove('active');
                } else {
                    // Still speaking - show interim results
                    interimTranscript += transcript;
                }
            }
            
            if (interimTranscript) {
                this.interimText.textContent = interimTranscript;
                this.interimText.classList.add('active');
            }
        };
        
        // Handle errors
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            
            if (event.error === 'no-speech') {
                // Continue listening
                return;
            }
            
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone access to use voice input.');
            } else {
                alert(`Speech recognition error: ${event.error}`);
            }
            
            this.stopListening();
        };
        
        // Handle end
        this.recognition.onend = () => {
            if (this.isListening) {
                // Restart recognition to continue listening
                try {
                    this.recognition.start();
                } catch (e) {
                    console.error('Failed to restart recognition:', e);
                    this.stopListening();
                }
            }
        };
    }
    
    setupEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendUtterance());
        this.refreshBtn.addEventListener('click', () => this.loadData());
        this.listenBtn.addEventListener('click', () => this.toggleListening());
        
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
    
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }
    
    startListening() {
        if (!this.recognition) {
            alert('Speech recognition not supported in this browser');
            return;
        }
        
        try {
            this.recognition.start();
            this.isListening = true;
            this.listenBtn.classList.add('listening');
            this.listenBtnText.textContent = 'Stop Listening';
            this.listeningIndicator.classList.add('active');
            this.debugLog('Started listening');
        } catch (e) {
            console.error('Failed to start recognition:', e);
            alert('Failed to start speech recognition. Please try again.');
        }
    }
    
    stopListening() {
        if (this.recognition) {
            this.isListening = false;
            this.recognition.stop();
            this.listenBtn.classList.remove('listening');
            this.listenBtnText.textContent = 'Start Listening';
            this.listeningIndicator.classList.remove('active');
            this.interimText.textContent = '';
            this.interimText.classList.remove('active');
            this.debugLog('Stopped listening');
        }
    }
    
    async sendVoiceUtterance(text) {
        const trimmedText = text.trim();
        if (!trimmedText) return;
        
        this.debugLog('Sending voice utterance:', trimmedText);
        
        try {
            const response = await fetch(`${this.baseUrl}/api/potential-utterances`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: trimmedText,
                    timestamp: new Date().toISOString()
                }),
            });
            
            if (response.ok) {
                this.loadData(); // Refresh the list
            } else {
                const error = await response.json();
                console.error('Error sending voice utterance:', error);
            }
        } catch (error) {
            console.error('Failed to send voice utterance:', error);
        }
    }
    
    debugLog(...args) {
        if (this.debug) {
            console.log(...args);
        }
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VoiceHooksClient();
});