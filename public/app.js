class TTSClient {
    constructor() {
        this.baseUrl = window.location.origin;
        this.debug = localStorage.getItem('ttsDebug') === 'true';

        // Speech synthesis
        this.initializeSpeechSynthesis();

        // Server-Sent Events for TTS
        this.initializeTTSEvents();

        // TTS controls
        this.languageSelect = document.getElementById('languageSelect');
        this.voiceSelect = document.getElementById('voiceSelect');
        this.speechRateSlider = document.getElementById('speechRate');
        this.speechRateInput = document.getElementById('speechRateInput');
        this.testTTSBtn = document.getElementById('testTTSBtn');
        this.localVoicesGroup = document.getElementById('localVoicesGroup');
        this.cloudVoicesGroup = document.getElementById('cloudVoicesGroup');
        this.rateWarning = document.getElementById('rateWarning');
        this.systemVoiceInfo = document.getElementById('systemVoiceInfo');

        // Load saved preferences
        this.loadPreferences();

        this.setupEventListeners();
    }


    setupEventListeners() {

        // Language filter
        if (this.languageSelect) {
            this.languageSelect.addEventListener('change', () => {
                // Save language preference
                localStorage.setItem('selectedLanguage', this.languageSelect.value);
                // Repopulate voice list with filtered voices
                this.populateVoiceList();
            });
        }

        // TTS controls
        this.voiceSelect.addEventListener('change', (e) => {
            this.selectedVoice = e.target.value;
            // Save selected voice to localStorage
            localStorage.setItem('selectedVoice', this.selectedVoice);
            this.updateVoiceWarnings();
        });

        this.speechRateSlider.addEventListener('input', (e) => {
            this.speechRate = parseFloat(e.target.value);
            this.speechRateInput.value = this.speechRate.toFixed(1);
            // Save rate to localStorage
            localStorage.setItem('speechRate', this.speechRate.toString());
        });

        this.speechRateInput.addEventListener('input', (e) => {
            let value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                value = Math.max(0.5, Math.min(5, value)); // Clamp to valid range
                this.speechRate = value;
                this.speechRateSlider.value = value.toString();
                this.speechRateInput.value = value.toFixed(1);
                // Save rate to localStorage
                localStorage.setItem('speechRate', this.speechRate.toString());
            }
        });

        this.testTTSBtn.addEventListener('click', () => {
            this.speakText('This is Text-to-Speech for Claude Code. How can I help you today?');
        });

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
        this.selectedVoice = 'system';
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
                } else if (data.type === 'waitStatus') {
                    this.handleWaitStatus(data.isWaiting);
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
            // Sync state when connection is established (includes reconnections)
            this.syncStateWithServer();
        };
    }

    populateLanguageFilter() {
        if (!this.languageSelect || !this.voices) return;

        // Get current selection
        const currentSelection = this.languageSelect.value || 'en-US';

        // Clear existing options
        this.languageSelect.innerHTML = '';

        // Add "All Languages" option
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Languages';
        this.languageSelect.appendChild(allOption);

        // Collect unique language codes
        const languageCodes = new Set();
        this.voices.forEach(voice => {
            languageCodes.add(voice.lang);
        });

        // Sort and add language codes
        Array.from(languageCodes).sort().forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang;
            this.languageSelect.appendChild(option);
        });

        // Restore selection
        this.languageSelect.value = currentSelection;
        if (this.languageSelect.value !== currentSelection) {
            // If saved selection not available, default to en-US
            this.languageSelect.value = 'en-US';
        }
    }

    populateVoiceList() {
        if (!this.voiceSelect || !this.localVoicesGroup || !this.cloudVoicesGroup) return;

        // First populate the language filter
        this.populateLanguageFilter();

        // Clear existing browser voice options
        this.localVoicesGroup.innerHTML = '';
        this.cloudVoicesGroup.innerHTML = '';

        // List of voices to exclude (novelty, Eloquence, and non-premium voices)
        const excludedVoices = [
            // Eloquence voices
            'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley',
            // Novelty voices
            'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos',
            'Good News', 'Jester', 'Organ', 'Superstar', 'Trinoids', 'Whisper',
            'Wobble', 'Zarvox',
            // Voices without premium options
            'Fred', 'Junior', 'Kathy', 'Ralph'
        ];

        // Get selected language filter
        const selectedLanguage = this.languageSelect ? this.languageSelect.value : 'en-US';

        // Filter voices based on selected language
        this.voices.forEach((voice, index) => {
            const voiceLang = voice.lang;
            let shouldInclude = false;

            if (selectedLanguage === 'all') {
                // Include all languages
                shouldInclude = true;
            } else {
                // Check if voice matches selected language/locale
                shouldInclude = voiceLang === selectedLanguage;
            }

            if (shouldInclude) {
                // Check if voice should be excluded
                const voiceName = voice.name;
                const isExcluded = excludedVoices.some(excluded =>
                    voiceName.toLowerCase().startsWith(excluded.toLowerCase())
                );

                if (!isExcluded) {
                    const option = document.createElement('option');
                    option.value = `browser:${index}`;
                    // Show voice name and language code
                    option.textContent = `${voice.name} (${voice.lang})`;

                    // Categorize voices
                    if (voice.localService) {
                        this.localVoicesGroup.appendChild(option);
                        this.debugLog(voice.voiceURI);
                    } else {
                        this.cloudVoicesGroup.appendChild(option);
                    }
                }
            }
        });

        // Hide empty groups
        if (this.localVoicesGroup.children.length === 0) {
            this.localVoicesGroup.style.display = 'none';
        } else {
            this.localVoicesGroup.style.display = '';
        }

        if (this.cloudVoicesGroup.children.length === 0) {
            this.cloudVoicesGroup.style.display = 'none';
        } else {
            this.cloudVoicesGroup.style.display = '';
        }

        // Restore saved selection
        const savedVoice = localStorage.getItem('selectedVoice');
        if (savedVoice) {
            this.voiceSelect.value = savedVoice;
            this.selectedVoice = savedVoice;
        } else {
            // Look for Google US English Male voice first
            let googleUSMaleIndex = -1;
            let microsoftAndrewIndex = -1;

            this.voices.forEach((voice, index) => {
                const voiceName = voice.name.toLowerCase();

                // Check for Google US English Male
                if (voiceName.includes('google') &&
                    voiceName.includes('us') &&
                    voiceName.includes('english')) {
                    googleUSMaleIndex = index;
                }

                // Check for Microsoft Andrew Online
                if (voiceName.includes('microsoft') &&
                    voiceName.includes('andrew') &&
                    voiceName.includes('online')) {
                    microsoftAndrewIndex = index;
                }
            });

            if (googleUSMaleIndex !== -1) {
                this.selectedVoice = `browser:${googleUSMaleIndex}`;
                this.voiceSelect.value = this.selectedVoice;
                this.debugLog('Defaulting to Google US English Male voice');
            } else if (microsoftAndrewIndex !== -1) {
                this.selectedVoice = `browser:${microsoftAndrewIndex}`;
                this.voiceSelect.value = this.selectedVoice;
                this.debugLog('Google US English Male not found, defaulting to Microsoft Andrew Online');
            } else {
                this.selectedVoice = 'system';
                this.debugLog('Preferred voices not found, using system default');
            }
        }

        // Update warnings based on selected voice
        this.updateVoiceWarnings();
    }

    async speakText(text) {
        // Check if we should use system voice
        if (this.selectedVoice === 'system') {
            // Use Mac system voice via server
            try {
                const response = await fetch(`${this.baseUrl}/api/speak-system`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: text,
                        rate: Math.round(this.speechRate * 150) // Convert rate to words per minute
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('Failed to speak via system voice:', error);
                }
            } catch (error) {
                console.error('Failed to call speak-system API:', error);
            }
        } else {
            // Use browser voice
            if (!window.speechSynthesis) {
                console.error('Speech synthesis not available');
                return;
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // Create utterance
            const utterance = new SpeechSynthesisUtterance(text);

            // Set voice if using browser voice
            if (this.selectedVoice && this.selectedVoice.startsWith('browser:')) {
                const voiceIndex = parseInt(this.selectedVoice.substring(8));
                if (this.voices[voiceIndex]) {
                    utterance.voice = this.voices[voiceIndex];
                }
            }

            // Set speech properties
            utterance.rate = this.speechRate;
            utterance.pitch = this.speechPitch;

            // Event handlers
            utterance.onstart = () => {
                this.debugLog('Started speaking:', text);
            };

            utterance.onend = () => {
                this.debugLog('Finished speaking');
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
            };

            // Speak the text
            window.speechSynthesis.speak(utterance);
        }
    }

    loadPreferences() {
        // Load voice settings
        const storedRate = localStorage.getItem('speechRate');
        if (storedRate !== null) {
            this.speechRate = parseFloat(storedRate);
            this.speechRateSlider.value = storedRate;
            this.speechRateInput.value = this.speechRate.toFixed(1);
        }

        // Load selected voice (will be applied after voices load)
        this.selectedVoice = localStorage.getItem('selectedVoice') || 'system';

        // Load selected language
        const savedLanguage = localStorage.getItem('selectedLanguage');
        if (savedLanguage && this.languageSelect) {
            this.languageSelect.value = savedLanguage;
        }


        // Update warnings after preferences are loaded
        this.updateVoiceWarnings();
    }



    async syncStateWithServer() {
        this.debugLog('Syncing state with server after reconnection');
    }

    updateVoiceWarnings() {
        // Show/hide warnings based on selected voice
        if (this.selectedVoice === 'system') {
            // Show system voice info for Mac System Voice
            this.systemVoiceInfo.style.display = 'flex';
            this.rateWarning.style.display = 'none';
        } else if (this.selectedVoice && this.selectedVoice.startsWith('browser:')) {
            // Check voice properties
            const voiceIndex = parseInt(this.selectedVoice.substring(8));
            const voice = this.voices[voiceIndex];

            if (voice) {
                const isGoogleVoice = voice.name.toLowerCase().includes('google');
                const isLocalVoice = voice.localService === true;

                // Show appropriate warnings
                if (isGoogleVoice) {
                    // Show rate warning for Google voices
                    this.rateWarning.style.display = 'flex';
                } else {
                    this.rateWarning.style.display = 'none';
                }

                if (isLocalVoice) {
                    // Show system info for local browser voices
                    this.systemVoiceInfo.style.display = 'flex';
                } else {
                    this.systemVoiceInfo.style.display = 'none';
                }
            } else {
                // Hide both warnings if voice not found
                this.rateWarning.style.display = 'none';
                this.systemVoiceInfo.style.display = 'none';
            }
        } else {
            // Hide both warnings if no voice selected
            this.rateWarning.style.display = 'none';
            this.systemVoiceInfo.style.display = 'none';
        }
    }

}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TTSClient();
});
