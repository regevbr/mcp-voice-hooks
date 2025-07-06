class VoiceHooksClient {
    constructor() {
        this.baseUrl = window.location.origin;
        this.debug = localStorage.getItem('voiceHooksDebug') === 'true';
        this.utteranceInput = document.getElementById('utteranceInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
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
        
        // Speech synthesis
        this.initializeSpeechSynthesis();
        
        // Server-Sent Events for TTS
        this.initializeTTSEvents();
        
        // TTS controls
        this.voiceSelect = document.getElementById('voiceSelect');
        this.speechRateSlider = document.getElementById('speechRate');
        this.speechRateValue = document.getElementById('speechRateValue');
        this.speechVolumeSlider = document.getElementById('speechVolume');
        this.speechVolumeValue = document.getElementById('speechVolumeValue');
        this.testTTSBtn = document.getElementById('testTTSBtn');
        this.voiceResponsesToggle = document.getElementById('voiceResponsesToggle');
        this.browserTTSToggle = document.getElementById('browserTTSToggle');
        this.voiceOptions = document.getElementById('voiceOptions');
        
        // Load saved preferences
        this.loadPreferences();
        
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
        this.clearAllBtn.addEventListener('click', () => this.clearAllUtterances());
        this.listenBtn.addEventListener('click', () => this.toggleListening());
        
        this.utteranceInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendUtterance();
            }
        });
        
        // TTS controls
        this.voiceSelect.addEventListener('change', (e) => {
            this.selectedVoiceIndex = e.target.value ? parseInt(e.target.value) : null;
            // Save selected voice to localStorage
            if (this.selectedVoiceIndex !== null && this.voices[this.selectedVoiceIndex]) {
                localStorage.setItem('selectedVoiceName', this.voices[this.selectedVoiceIndex].name);
            } else {
                localStorage.removeItem('selectedVoiceName');
            }
        });
        
        this.speechRateSlider.addEventListener('input', (e) => {
            this.speechRate = parseFloat(e.target.value);
            this.speechRateValue.textContent = this.speechRate.toFixed(1);
            // Save rate to localStorage
            localStorage.setItem('speechRate', this.speechRate.toString());
        });
        
        this.speechVolumeSlider.addEventListener('input', (e) => {
            this.speechVolume = parseFloat(e.target.value);
            this.speechVolumeValue.textContent = this.speechVolume.toFixed(1);
            // Save volume to localStorage
            localStorage.setItem('speechVolume', this.speechVolume.toString());
        });
        
        this.testTTSBtn.addEventListener('click', () => {
            this.speakText('Hello! This is a test of the text-to-speech voice.');
        });
        
        // Voice toggle listeners
        this.voiceResponsesToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('voiceResponsesEnabled', enabled);
            this.updateVoicePreferences();
        });
        
        this.browserTTSToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('browserTTSEnabled', enabled);
            this.updateVoicePreferences();
            this.updateVoiceOptionsVisibility();
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
    
    async clearAllUtterances() {
        
        this.clearAllBtn.disabled = true;
        this.clearAllBtn.textContent = 'Clearing...';
        
        try {
            const response = await fetch(`${this.baseUrl}/api/utterances`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                this.loadData(); // Refresh the list
                this.debugLog('Cleared all utterances:', result);
            } else {
                const error = await response.json();
                alert(`Error: ${error.error || 'Failed to clear utterances'}`);
            }
        } catch (error) {
            console.error('Failed to clear utterances:', error);
            alert('Failed to clear utterances. Make sure the server is running.');
        } finally {
            this.clearAllBtn.disabled = false;
            this.clearAllBtn.textContent = 'Clear All';
        }
    }
    
    debugLog(...args) {
        if (this.debug) {
            console.log(...args);
        }
    }
    
    initializeSpeechSynthesis() {
        // Check for browser support
        if (!window.speechSynthesis) {
            console.warn('Speech synthesis not supported in this browser');
            return;
        }
        
        // Get available voices
        this.voices = [];
        const loadVoices = () => {
            this.voices = window.speechSynthesis.getVoices();
            this.debugLog('Available voices:', this.voices);
            this.populateVoiceList();
        };
        
        // Load voices initially and on change
        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        
        // Set default voice preferences
        this.speechRate = 1.0;
        this.speechPitch = 1.0;
        this.speechVolume = 1.0;
        this.selectedVoiceIndex = null;
    }
    
    initializeTTSEvents() {
        // Connect to Server-Sent Events endpoint
        this.eventSource = new EventSource(`${this.baseUrl}/api/tts-events`);
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.debugLog('TTS Event:', data);
                
                if (data.type === 'speak' && data.text) {
                    this.speakText(data.text);
                }
            } catch (error) {
                console.error('Failed to parse TTS event:', error);
            }
        };
        
        this.eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            // Will automatically reconnect
        };
        
        this.eventSource.onopen = () => {
            this.debugLog('TTS Events connected');
        };
    }
    
    populateVoiceList() {
        if (!this.voiceSelect) return;
        
        // Clear existing options except default
        this.voiceSelect.innerHTML = '<option value="">Default</option>';
        
        let selectedIndex = null;
        
        // Filter and add only en-US voices
        this.voices.forEach((voice, index) => {
            // Only include English US voices
            if (voice.lang.toLowerCase().startsWith('en-us')) {
                const option = document.createElement('option');
                option.value = index.toString();
                option.textContent = voice.name;
                
                // Mark local voices
                if (voice.localService) {
                    option.textContent += ' [Local]';
                }
                
                // Check if this is the saved voice
                if (this.savedVoiceName && voice.name === this.savedVoiceName) {
                    selectedIndex = index;
                }
                
                this.voiceSelect.appendChild(option);
            }
        });
        
        // Restore saved selection
        if (selectedIndex !== null) {
            this.voiceSelect.value = selectedIndex.toString();
            this.selectedVoiceIndex = selectedIndex;
        }
    }
    
    speakText(text) {
        if (!window.speechSynthesis) {
            console.error('Speech synthesis not available');
            return;
        }
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set voice if selected
        if (this.selectedVoiceIndex !== null && this.voices[this.selectedVoiceIndex]) {
            utterance.voice = this.voices[this.selectedVoiceIndex];
        }
        
        // Set speech properties
        utterance.rate = this.speechRate;
        utterance.pitch = this.speechPitch;
        utterance.volume = this.speechVolume;
        
        // Event handlers
        utterance.onstart = () => {
            this.debugLog('Started speaking:', text);
            // Could add visual indicator here
        };
        
        utterance.onend = () => {
            this.debugLog('Finished speaking');
            // Could remove visual indicator here
        };
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
        };
        
        // Speak the text
        window.speechSynthesis.speak(utterance);
    }
    
    loadPreferences() {
        // Simple localStorage with defaults to true
        const storedVoiceResponses = localStorage.getItem('voiceResponsesEnabled');
        const storedBrowserTTS = localStorage.getItem('browserTTSEnabled');
        
        // Default to true if not stored
        const voiceResponsesEnabled = storedVoiceResponses !== null 
            ? storedVoiceResponses === 'true'
            : true;
            
        const browserTTSEnabled = storedBrowserTTS !== null
            ? storedBrowserTTS === 'true'
            : true;
        
        // Set the checkboxes
        this.voiceResponsesToggle.checked = voiceResponsesEnabled;
        this.browserTTSToggle.checked = browserTTSEnabled;
        
        // Save to localStorage if this is first time
        if (storedVoiceResponses === null) {
            localStorage.setItem('voiceResponsesEnabled', 'true');
        }
        if (storedBrowserTTS === null) {
            localStorage.setItem('browserTTSEnabled', 'true');
        }
        
        // Load voice settings
        const storedRate = localStorage.getItem('speechRate');
        if (storedRate !== null) {
            this.speechRate = parseFloat(storedRate);
            this.speechRateSlider.value = storedRate;
            this.speechRateValue.textContent = this.speechRate.toFixed(1);
        }
        
        const storedVolume = localStorage.getItem('speechVolume');
        if (storedVolume !== null) {
            this.speechVolume = parseFloat(storedVolume);
            this.speechVolumeSlider.value = storedVolume;
            this.speechVolumeValue.textContent = this.speechVolume.toFixed(1);
        }
        
        // Load selected voice name (will be applied after voices load)
        this.savedVoiceName = localStorage.getItem('selectedVoiceName');
        
        // Update UI visibility
        this.updateVoiceOptionsVisibility();
        
        // Send preferences to server
        this.updateVoicePreferences();
    }
    
    updateVoiceOptionsVisibility() {
        const browserTTSEnabled = this.browserTTSToggle.checked;
        this.voiceOptions.style.display = browserTTSEnabled ? 'flex' : 'none';
    }
    
    async updateVoicePreferences() {
        const voiceResponsesEnabled = this.voiceResponsesToggle.checked;
        const browserTTSEnabled = this.browserTTSToggle.checked;
        
        try {
            // Send preferences to server
            await fetch(`${this.baseUrl}/api/voice-preferences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    voiceResponsesEnabled,
                    browserTTSEnabled
                }),
            });
            
            this.debugLog('Voice preferences updated:', { voiceResponsesEnabled, browserTTSEnabled });
        } catch (error) {
            console.error('Failed to update voice preferences:', error);
        }
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VoiceHooksClient();
});