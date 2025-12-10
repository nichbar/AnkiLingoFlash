// content.js

/**
 * AnkiLingoFlash Content Script
 * 
 * This script runs in the context of web pages and handles the core functionality
 * of the AnkiLingoFlash extension, including flashcard generation, UI interactions,
 * and communication with the background script.
 */

// Check if the content script has already been loaded to avoid multiple executions
if (window.hasRun === true) {
    console.log("Content script already loaded. Skipping main execution.");
} else {
    window.hasRun = true;

    const AI_PROVIDERS = {
        OPENAI: 'openai',
        GOOGLE: 'google'
    };

    // Define the list of supported i18n language keys for UI elements like dropdowns.
    // These keys correspond to entries in your _locales/*/messages.json files.
    const SUPPORTED_I18N_LANGUAGE_KEYS = [
        'mandarin_simplified', 'spanish_es', 'english_us', 'russian', 'arabic_standard',
        'bengali', 'hindi', 'portuguese_pt', 'indonesian', 'japanese', 'french_fr',
        'german_de', 'javanese', 'korean', 'telugu', 'vietnamese', 'marathi',
        'italian_it', 'tamil', 'turkish', 'urdu', 'gujarati', 'polish', 'ukrainian',
        'kannada', 'maithili', 'malayalam', 'burmese', 'punjabi', 'romanian',
        'dutch_nl', 'croatian', 'thai', 'swahili', 'amharic', 'oromo', 'uzbek',
        'azerbaijani', 'georgian', 'czech', 'hungarian', 'greek', 'swedish',
        'hebrew', 'malay', 'danish', 'finnish', 'norwegian', 'slovak', 'persian'
        // Add any other i18n keys for languages you want to list in dropdowns.
        // Ensure these keys exist in your messages.json files (e.g., "english_us": { "message": "English (US)" }).
    ];

    // Variables for toast notifications
    let toastShadowRoot;
    let toastContainer;
    let currentToast = null;

    // Add timeout tracking for toast removal
    let toastRemovalTimeout = null;

    /**
     * Constants for conversation types.
     * These are used to differentiate between different API call purposes.
     */
    const CONVERSATION_TYPES = {
        FLASHCARD: 'flashcard',
        DEFINITION: 'definition',
        MNEMONIC: 'mnemonic',
        TRANSLATION: 'translation',
        EXAMPLES: 'examples',
        TRANSLATION_POPUP: 'translation_popup'
    };

    /**
     * Maps API error responses to user-friendly messages based on HTTP status codes and error details.
     * 
     * @param {Object} error - The error object containing status code and error data
     * @param {string} provider - The AI provider ('openai' or 'google')
     * @returns {string} The localized error message key
     */
    function getApiErrorMessage(error, provider = 'openai') {
        const status = error.status;
        const errorData = error.errorData || {};
        const errorMessage = (errorData.error?.message || error.message || '').toLowerCase();
        
        // Network errors
        if (error.message && (error.message.includes('Failed to fetch') || 
                             error.message.includes('Network request failed') ||
                             error.message.includes('network') ||
                             error.message.includes('connection'))) {
            return chrome.i18n.getMessage("networkError");
        }

        // JSON parsing errors
        if (error.message && error.message.includes('JSON')) {
            return chrome.i18n.getMessage("jsonParseError");
        }

        // Handle specific HTTP status codes
        switch (status) {
            case 400:
                // OpenAI: Invalid request format or unsupported features
                // Google: Malformed request or failed precondition
                if (provider === 'google' && errorMessage.includes('free tier is not available')) {
                    return chrome.i18n.getMessage("apiError400FailedPrecondition");
                }
                return chrome.i18n.getMessage("apiError400InvalidRequest");

            case 401:
                // Authentication errors
                if (errorMessage.includes('incorrect') || errorMessage.includes('invalid')) {
                    return chrome.i18n.getMessage("apiError401IncorrectKey");
                }
                if (errorMessage.includes('organization')) {
                    return chrome.i18n.getMessage("apiError401NotMember");
                }
                return chrome.i18n.getMessage("apiError401InvalidAuth");

            case 403:
                // Permission errors
                if (errorMessage.includes('country') || errorMessage.includes('region') || 
                    errorMessage.includes('territory') || errorMessage.includes('not supported')) {
                    return chrome.i18n.getMessage("apiError403CountryNotSupported");
                }
                return chrome.i18n.getMessage("apiError403PermissionDenied");

            case 404:
                // Resource not found (usually invalid model)
                return chrome.i18n.getMessage("apiError404NotFound");

            case 429:
                // Rate limiting or quota issues
                if (errorMessage.includes('quota') || errorMessage.includes('credits') || 
                    errorMessage.includes('billing') || errorMessage.includes('exceeded')) {
                    return chrome.i18n.getMessage("apiError429QuotaExceeded");
                }
                if (errorMessage.includes('slow down')) {
                    return chrome.i18n.getMessage("apiError503SlowDown");
                }
                return chrome.i18n.getMessage("apiError429RateLimit");

            case 500:
                // Server errors
                return chrome.i18n.getMessage("apiError500ServerError");

            case 503:
                // Service unavailable
                if (errorMessage.includes('overloaded') || errorMessage.includes('capacity')) {
                    return chrome.i18n.getMessage("apiError503ServiceUnavailable");
                }
                if (errorMessage.includes('slow down')) {
                    return chrome.i18n.getMessage("apiError503SlowDown");
                }
                return chrome.i18n.getMessage("apiError503ServiceUnavailable");

            case 504:
                // Timeout
                return chrome.i18n.getMessage("apiError504Timeout");

            default:
                // Generic error for unknown status codes
                return chrome.i18n.getMessage("apiErrorGeneric");
        }
    }

    /**
     * Calculates the appropriate toast display duration based on message length.
     * Uses a reading speed of approximately 200 words per minute with minimum and maximum bounds.
     * 
     * @param {string} message - The message to be displayed
     * @returns {number} Duration in milliseconds
     */
    function calculateToastDuration(message) {
        const wordsPerMinute = 200;
        const millisecondsPerWord = (60 * 1000) / wordsPerMinute; // ~300ms per word
        const wordCount = message.split(/\s+/).length;
        
        // Base calculation with minimum 4 seconds and maximum 15 seconds
        const calculatedDuration = Math.max(4000, Math.min(15000, wordCount * millisecondsPerWord));
        
        return calculatedDuration;
    }

    /**
     * Escapes HTML characters to prevent XSS attacks.
     * 
     * @param {string} unsafeText - The text to be escaped.
     * @returns {string} The escaped text.
     */
    function escapeHTML(unsafeText) {
        return unsafeText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Initializes the toast notification system using Shadow DOM.
     * This ensures that the toast styles don't interfere with the page's styles.
     */
    function initializeToastShadowDOM() {
        // Check if the toast host element already exists, otherwise create it
        let toastHost = document.getElementById('anki-lingo-flash-toast-host');
        if (!toastHost) {
            toastHost = document.createElement('div');
            toastHost.id = 'anki-lingo-flash-toast-host';
            document.body.appendChild(toastHost);
        }

        // Attach or get the shadow root of the toast host
        toastShadowRoot = toastHost.shadowRoot || toastHost.attachShadow({ mode: 'open' });

        // Create and append the style element for toast notifications
        const style = document.createElement('style');
        style.textContent = `
            .toast-container {
                position: fixed;
                z-index: 10000;
                top: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                font-family: Arial, sans-serif;
            }
            .toast {
                display: inline-block;
                background-color: rgba(245, 245, 245, 0.95);
                color: #333;
                text-align: center;
                border-radius: 8px;
                padding: 16px;
                margin-top: 10px;
                font-size: 16px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                border: 1px solid rgba(0, 0, 0, 0.1);
                backdrop-filter: blur(4px);
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity 0.3s, transform 0.3s;
            }
            .toast.show {
                opacity: 1;
                transform: translateY(0);
            }
            .toast .ellipsis::after {
                content: "...";
                animation: ellipsis 1s steps(3, end) infinite;
                display: inline-block;
                width: 1em;
                text-align: left;
            }
            @keyframes ellipsis {
                0% { content: ""; }
                33% { content: "."; }
                66% { content: ".."; }
                100% { content: "..."; }
            }
        `;
        toastShadowRoot.appendChild(style);

        // Create and append the toast container element
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastShadowRoot.appendChild(toastContainer);
    }

    // Retrieve the default remote model from storage
    chrome.storage.sync.get(['model'], function (result) {
        DEFAULT_REMOTE_MODEL = result.model;
    });

    console.log("content.js is loaded");

    /**
     * Creates a Shadow DOM for the extension.
     * This isolates the extension's DOM and styles from the host page.
     * 
     * @returns {ShadowRoot} The created shadow root.
     */
    function createShadowDOM() {
        const container = document.createElement('div');
        container.id = 'anki-lingo-flash-container';
        container.className = 'anki-lingo-flash-container';
        globalShadowRoot = container.attachShadow({ mode: 'closed' });
        document.body.appendChild(container);

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('style.css');
        globalShadowRoot.appendChild(link);

        return globalShadowRoot;
    }

    // Initialize the global shadow root
    globalShadowRoot = createShadowDOM();

    /**
     * Gets a localized sort function based on the given language.
     * This is used for sorting language options in the UI.
     * 
     * @param {string} language - The i18n language key (e.g., 'english_us').
     * @returns {function} A comparison function for sorting.
     */
    function getLocalizedSort(language) {
        const languageCodes = { // Keys are i18n language keys
            'english_us': 'en-US',
            'english_uk': 'en-GB',
            'english_au': 'en-AU',
            'english_ca': 'en-CA',
            'spanish_es': 'es-ES',
            'spanish_latam': 'es-419',
            'french_fr': 'fr-FR',
            'french_ca': 'fr-CA',
            'german_de': 'de-DE',
            'german_ch': 'de-CH',
            'italian_it': 'it-IT',
            'italian_ch': 'it-CH',
            'dutch_nl': 'nl-NL',
            'dutch_be': 'nl-BE',
            'portuguese_pt': 'pt-PT',
            'portuguese_br': 'pt-BR',
            'russian': 'ru-RU',
            'mandarin_simplified': 'zh-Hans',
            'mandarin_traditional': 'zh-Hant',
            'cantonese': 'yue-Hant-HK',
            'japanese': 'ja-JP',
            'arabic_standard': 'ar-SA',
            'arabic_eg': 'ar-EG',
            'korean': 'ko-KR',
            'hindi': 'hi-IN',
            'persian': 'fa-IR'
            // Add other mappings if needed for Intl.Collator
        };

        const localeCode = languageCodes[language] || 'en-US'; // Fallback to English if not found

        try {
            return new Intl.Collator(localeCode).compare;
        } catch (error) {
            console.warn(`Failed to create Collator for language ${language} (i18n key). Falling back to default sort.`, error);
            return (a, b) => a.localeCompare(b);
        }
    }

    /**
     * Generates language options for the UI dropdown.
     * 
     * @param {string} currentLanguageKey - The currently selected i18n language key (e.g., 'english_us').
     * @returns {Promise<string>} A promise that resolves to an HTML string of language options.
     */
    async function generateLanguageOptions(currentLanguageKey) {
        return new Promise((resolve) => {
            // getAcceptLanguages might not be needed here if we use our defined list
            // but it's kept for now if it influences sort or other logic.
            chrome.i18n.getAcceptLanguages((acceptedLanguages) => {
                const sortFunction = getLocalizedSort(currentLanguageKey);

                const languageOptions = SUPPORTED_I18N_LANGUAGE_KEYS
                    .map(i18nKey => ({
                        key: i18nKey, // This will be the value of the option
                        name: chrome.i18n.getMessage(i18nKey) || i18nKey // This is the display name
                    }))
                    .sort((a, b) => sortFunction(a.name, b.name))
                    .map(({ key, name }) =>
                        `<option value="${key}" ${currentLanguageKey === key ? 'selected' : ''}>${name}</option>`
                    )
                    .join('');

                resolve(languageOptions);
            });
        });
    }

    /**
     * Regenerates content for a specific part of a flashcard.
     * 
     * @param {string} part - The part of the flashcard to regenerate ('definition', 'mnemonic', 'translation', 'examples').
     * @param {string} flashcardId - The ID of the flashcard to update.
     */
    function regenerateContent(part, flashcardId) {
        checkAuth((isAuthenticated) => {
            if (!isAuthenticated) {
                // Auth check already shows the appropriate error message via showToast
                console.log("Authentication failed for content regeneration");
                return;
            }
    
            chrome.storage.sync.get(['choice', 'model', 'isOwnCredits', 'flashcards', 'language', 'regenerationLimit', 'userId'], function (settings) {
                if (settings.choice === 'remote') {
                    const flashcard = settings.flashcards[flashcardId];
                    if (!flashcard) {
                        console.log('Flashcard not found');
                        return;
                    }
    
                    if (!settings.isOwnCredits && flashcard.regenerationCount[part] >= settings.regenerationLimit) {
                        showToast(chrome.i18n.getMessage(`${part}RegenerationLimitReached`, [settings.regenerationLimit]));
                        return;
                    }
    
                    flashcard.regenerationCount[part]++;
                    settings.flashcards[flashcardId] = flashcard;
                    chrome.storage.sync.set({ flashcards: settings.flashcards });

                    showToast(chrome.i18n.getMessage(`regenerating${part.charAt(0).toUpperCase() + part.slice(1)}`), true, true);

                    const reviewModal = globalShadowRoot.querySelector('#anki-lingo-flash-review-modal');
                    if (reviewModal) reviewModal.style.display = 'none';

                    let userPrompt;
                    // settings.language is an i18n key like "english_us"
                    const naturalLanguageName = chrome.i18n.getMessage(settings.language) || settings.language;

                    if (part === 'definition') {
                        userPrompt = chrome.i18n.getMessage("generateDefinition", [naturalLanguageName, flashcard.verso]);
                    } else if (part === 'mnemonic') {
                        userPrompt = chrome.i18n.getMessage("generateMnemonic", [naturalLanguageName, flashcard.verso]);
                    } else if (part === 'translation') {
                        userPrompt = chrome.i18n.getMessage("generateTranslation", [naturalLanguageName, flashcard.verso]);
                    } else if (part === 'examples') {
                        // generateExamples prompt does not take language as a parameter in messages.json
                        userPrompt = chrome.i18n.getMessage("generateExamples", [flashcard.verso]);
                    }

                    console.log(`[regenerateContent] part: ${part}, language (i18n key): ${settings.language}, naturalLanguageName: ${naturalLanguageName}`);
                    console.log(`[regenerateContent] Prompt utilisé:`, userPrompt);

                    chrome.runtime.sendMessage({
                        action: "callChatGPTAPI",
                        userId: settings.userId,
                        type: CONVERSATION_TYPES[part.toUpperCase()],
                        message: userPrompt,
                        language: settings.language // Send the i18n key
                    }, response => {
                        if (response.success) {
                            let newContent = response.data;

                            if (part === 'definition' && newContent.definition) {
                                flashcard.recto = newContent.definition;
                            } else if (part === 'mnemonic' && newContent.mnemonic) {
                                flashcard.mnemonic = newContent.mnemonic;
                                flashcard.mnemonicGenerated = true;
                            } else if (part === 'translation' && newContent.translation) {
                                flashcard.translation = newContent.translation;
                                // Cache the regenerated translation
                                setCachedTranslation(flashcard.verso, settings.language, newContent.translation);
                                console.log('Cached regenerated translation');
                            } else if (part === 'examples') {
                                flashcard.example_1 = newContent.example_1 || '';
                                flashcard.example_2 = newContent.example_2 || '';
                                flashcard.example_3 = newContent.example_3 || '';
                            } else {
                                console.log(`Invalid content for ${part}:`, newContent);
                                showToast(chrome.i18n.getMessage(`errorRegenerating${part.charAt(0).toUpperCase() + part.slice(1)}`));
                                if (reviewModal) reviewModal.style.display = 'flex';
                                return;
                            }

                            settings.flashcards[flashcardId] = flashcard;
                            chrome.storage.sync.set({ flashcards: settings.flashcards }, function () {
                                updateModalContent(flashcard);
                                removeCurrentToast();
                                if (reviewModal) reviewModal.style.display = 'flex';
                            });
                        } else {
                            console.log(`Error regenerating ${part}:`, response.error);
                            removeCurrentToast(); // Remove the "regenerating..." toast
                            
                            // Use the provider information from the response
                            const provider = response.provider || 'openai';
                            
                            // Check if this is an unsupported model error
                            if (response.isUnsupportedModel) {
                                showToast(chrome.i18n.getMessage("unsupportedModelError"));
                            } else if (response.status) {
                                // Use the detailed error information from the background script
                                const errorObj = {
                                    status: response.status,
                                    message: response.error,
                                    errorData: response.errorData || { error: { message: response.error } }
                                };
                                
                                const errorMessage = getApiErrorMessage(errorObj, provider);
                                showToast(errorMessage);
                            } else {
                                // Fallback to the generic regeneration error
                                showToast(chrome.i18n.getMessage(`errorRegenerating${part.charAt(0).toUpperCase() + part.slice(1)}`));
                            }
                            
                            if (reviewModal) reviewModal.style.display = 'flex';
                        }
                    });
                } else {
                    console.log('Local model regeneration not implemented');
                }
            });
        });
    }

    /**
     * Updates the content of the review modal with the given flashcard data.
     * 
     * @param {Object} flashcard - The flashcard object containing updated data.
     */
    function updateModalContent(flashcard) {
        const modal = globalShadowRoot.querySelector('#anki-lingo-flash-review-modal');
        if (modal) {
            modal.querySelector('.definition').value = flashcard.recto;
            modal.querySelector('.back').value = flashcard.verso;
            modal.querySelector('.translation').value = flashcard.translation || '';
            
            // Mise à jour des exemples dans un seul champ
            const examplesTextarea = modal.querySelector('.examples');
            if (examplesTextarea) {
                const examples = [
                    flashcard.example_1 || '',
                    flashcard.example_2 || '',
                    flashcard.example_3 || ''
                ].filter(example => example.trim() !== '');
                examplesTextarea.value = examples.join('\n');
            }
            
            modal.querySelector('.mnemonic').value = flashcard.mnemonic || '';
        }
    }
    
    /**
     * Displays a toast notification.
     * 
     * @param {string} message - The message to display in the toast.
     * @param {boolean} keepOpen - Whether to keep the toast open indefinitely.
     * @param {boolean} ellipsis - Whether to show an ellipsis animation in the toast.
     */
    function showToast(message, keepOpen = false, ellipsis = false) {
        console.log(`[${new Date().toISOString()}] showToast called with:`, { message, keepOpen, ellipsis });
        
        if (!toastShadowRoot) {
            initializeToastShadowDOM();
        }
    
        // Clear any pending removal timeout to prevent race conditions
        if (toastRemovalTimeout) {
            console.log(`[${new Date().toISOString()}] Clearing pending toast removal timeout`);
            clearTimeout(toastRemovalTimeout);
            toastRemovalTimeout = null;
        }
    
        if (currentToast) {
            console.log(`[${new Date().toISOString()}] Removing existing toast before showing new one`);
            toastContainer.removeChild(currentToast);
        }
    
        currentToast = document.createElement('div');
        currentToast.className = 'toast';
        currentToast.textContent = message;

        if (ellipsis) {
            const ellipsisSpan = document.createElement('span');
            ellipsisSpan.className = 'ellipsis';
            currentToast.appendChild(ellipsisSpan);
        }

        toastContainer.appendChild(currentToast);

        // Force a reflow
        currentToast.offsetHeight;

        currentToast.classList.add('show');

        if (!keepOpen) {
            // Calculate appropriate duration based on message length
            const duration = calculateToastDuration(message);
            console.log(`[${new Date().toISOString()}] Setting timeout to remove toast in ${duration}ms`);
            
            setTimeout(() => {
                removeCurrentToast();
            }, duration);
        } else {
            console.log(`[${new Date().toISOString()}] Toast will remain open (keepOpen=true)`);
        }
    }
    
    /**
     * Removes the current toast notification from the DOM.
     */
    function removeCurrentToast() {
        console.log('removeCurrentToast called');
        console.trace('removeCurrentToast call stack'); // Add stack trace to see what's calling this
        if (currentToast) {
            console.log('Removing toast:', currentToast.textContent);
            currentToast.classList.remove('show');
            
            // Clear any existing timeout to prevent conflicts
            if (toastRemovalTimeout) {
                clearTimeout(toastRemovalTimeout);
            }
            
            toastRemovalTimeout = setTimeout(() => {
                if (currentToast && toastContainer.contains(currentToast)) {
                    toastContainer.removeChild(currentToast);
                    currentToast = null;
                    toastRemovalTimeout = null;
                    if (toastContainer.children.length === 0) {
                        // Reset the container's position when all toasts are removed
                        toastContainer.style.transform = 'translateY(0)';
                    }
                }
            }, 300);
        } else {
            console.log('removeCurrentToast called but no current toast exists');
        }
    }
    
    /**
     * Invokes an AnkiConnect action.
     * 
     * @param {string} action - The AnkiConnect action to invoke.
     * @param {number} version - The version of the AnkiConnect API to use.
     * @param {Object} params - The parameters for the action.
     * @returns {Promise} A promise that resolves with the result of the action.
     */
    function invoke(action, version, params = {}) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: "invokeAnkiConnect",
                params: { action, version, params }
            }, response => {
                if (response.success) {
                    console.log("API call succeeded:", response.data);
                    resolve(response.data.result);
                } else {
                    console.log("API call failed:" + response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }
    
    /**
     * Fetches the list of decks from Anki.
     * 
     * @returns {Promise<string[]>} A promise that resolves with an array of deck names.
     */
    function fetchDecks() {
        return invoke('deckNames', 6)
            .then(result => result)
            .catch(error => {
                console.log('Error fetching decks:', error);
                return [];
            });
    }
    
    /**
     * Checks if the user is authenticated to perform an action.
     * This involves checking if they are logged in for free trial,
     * or if their API key is validated for "own credits" mode.
     * 
     * @param {function} callback - A callback function that receives a boolean indicating authentication status.
     */
    function checkAuth(callback) {
        chrome.storage.sync.get(['choice', 'user', 'isOwnCredits', 'apiKeyValidated', 'googleApiKeyValidated', 'selectedProvider'], function (result) {
            if (result.choice === 'remote') {
                if (result.isOwnCredits) {
                    const provider = result.selectedProvider || AI_PROVIDERS.OPENAI; // Default to OpenAI if not set
                    let isValid = false;
                    if (provider === AI_PROVIDERS.GOOGLE) {
                        isValid = result.googleApiKeyValidated === true;
                    } else { // OpenAI
                        isValid = result.apiKeyValidated === true;
                    }

                    if (isValid) {
                        callback(true);
                    } else {
                        console.log(`API key for ${provider} not validated.`);
                        const errorMessage = provider === AI_PROVIDERS.GOOGLE 
                            ? chrome.i18n.getMessage("apiError401IncorrectKey")
                            : chrome.i18n.getMessage("apiError401IncorrectKey");
                        showToast(errorMessage);
                        callback(false);
                    }
                } else if (!result.user) {
                    console.log("User not authenticated in Free trial mode");
                    showToast(chrome.i18n.getMessage("pleaseLogInForFreeTrial"));
                    callback(false);
                } else {
                    callback(true); // Free trial user is logged in
                }
            } else {
                // Assuming local mode doesn't require this type of auth check or is handled elsewhere
                callback(true); 
            }
        });
    }
    
    /**
     * Checks if the API key for the currently selected provider is valid.
     * @returns {Promise<boolean>} A promise that resolves with true if the key is valid, false otherwise.
     */
    async function isApiKeyValid() {
        return new Promise(resolve => {
            chrome.storage.sync.get(['isOwnCredits', 'apiKeyValidated', 'googleApiKeyValidated', 'selectedProvider'], function (settings) {
                if (!settings.isOwnCredits) {
                    resolve(true); // Not in "own credits" mode, so API key validity isn't the primary concern here.
                    return;
                }
                const provider = settings.selectedProvider || AI_PROVIDERS.OPENAI;
                let isValid = false;
                if (provider === AI_PROVIDERS.GOOGLE) {
                    isValid = settings.googleApiKeyValidated === true;
                } else { // OpenAI
                    isValid = settings.apiKeyValidated === true;
                }
                resolve(isValid);
            });
        });
    }
    
    /**
     * Checks if the given text contains natural language characters from supported languages.
     *
     * @param {string} text - The text to check.
     * @returns {boolean} True if the text contains natural language characters, false otherwise.
     */
    function containsNaturalLanguage(text) {
        // Regex to match characters from all supported languages
        const regex = /[\p{L}\p{M}]/u;
        return regex.test(text);
    }

    /**
     * Translation popup functionality
     */

    let translationIcon = null;
    let currentSelection = null;
    let selectionTimeout = null;
    let translationRequestInProgress = false; // Prevent duplicate requests
    let translationPopupShowing = false; // Track when popup is visible

    /**
     * Creates a simple hash for text to use in cache keys
     * @param {string} text - The text to hash
     * @returns {string} A simple hash of the text
     */
    function createTextHash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Creates a cache key for translation storage
     * @param {string} text - The source text
     * @param {string} language - The target language (i18n key)
     * @returns {string} The cache key
     */
    function createTranslationCacheKey(text, language) {
        const textHash = createTextHash(text);
        return `translation_cache_${textHash}_${language}`;
    }

    /**
     * Checks if a translation cache entry has expired (24 hours)
     * @param {number} timestamp - The timestamp from the cache entry
     * @returns {boolean} True if expired, false otherwise
     */
    function isTranslationExpired(timestamp) {
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 86400000 ms
        return (Date.now() - timestamp) > TWENTY_FOUR_HOURS;
    }

    /**
     * Gets a cached translation if it exists and is not expired
     * @param {string} text - The source text
     * @param {string} language - The target language (i18n key)
     * @returns {Promise<string|null>} The cached translation or null
     */
    function getCachedTranslation(text, language) {
        return new Promise((resolve) => {
            const cacheKey = createTranslationCacheKey(text, language);
            chrome.storage.sync.get([cacheKey], function (result) {
                const cacheEntry = result[cacheKey];
                if (cacheEntry && !isTranslationExpired(cacheEntry.timestamp)) {
                    resolve(cacheEntry.translation);
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Sets a cached translation with timestamp
     * @param {string} text - The source text
     * @param {string} language - The target language (i18n key)
     * @param {string} translation - The translation result
     */
    function setCachedTranslation(text, language, translation) {
        const cacheKey = createTranslationCacheKey(text, language);
        const cacheEntry = {
            translation: translation,
            timestamp: Date.now(),
            sourceText: text,
            targetLanguage: language
        };
        chrome.storage.sync.set({ [cacheKey]: cacheEntry });
    }

    /**
     * Shows the translation icon near the text selection
     * @param {Selection} selection - The current text selection
     */
    function showTranslationIcon(selection) {
        if (!selection || selection.rangeCount === 0 || selection.toString().trim().length < 3) {
            return;
        }

        const selectedText = selection.toString().trim();

        // Check if selection contains natural language
        if (!containsNaturalLanguage(selectedText)) {
            return;
        }

        // Remove existing icon
        hideTranslationIcon();

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Create translation icon
        translationIcon = document.createElement('div');
        translationIcon.className = 'translation-icon';
        translationIcon.innerHTML = '🌐';
        translationIcon.title = chrome.i18n.getMessage("translateText") || "Translate";

        // Position icon near the selection
        const iconSize = 24;
        let left = rect.right + window.scrollX + 5;
        let top = rect.top + window.scrollY - (iconSize - rect.height) / 2;

        // Adjust position if icon would be outside viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left + iconSize > viewportWidth) {
            left = rect.left + window.scrollX - iconSize - 5;
        }

        if (left < 0) {
            left = 5;
        }

        if (top < 0) {
            top = 5;
        }

        if (top + iconSize > viewportHeight) {
            top = rect.bottom + window.scrollY - iconSize - 5;
        }

        translationIcon.style.position = 'absolute';
        translationIcon.style.left = left + 'px';
        translationIcon.style.top = top + 'px';
        translationIcon.style.width = iconSize + 'px';
        translationIcon.style.height = iconSize + 'px';
        translationIcon.style.zIndex = '10000';

        // Add click event listener
        translationIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();

            // Store icon position for popup placement
            const iconRect = translationIcon.getBoundingClientRect();
            const iconPosition = {
                left: iconRect.left + window.scrollX,
                top: iconRect.bottom + window.scrollY + 5
            };

            hideTranslationIcon();
            currentSelection = selection;
            processTranslationRequest(selectedText, iconPosition);
        });

        // Add to shadow root
        globalShadowRoot.appendChild(translationIcon);
    }

    /**
     * Hides the translation icon
     */
    function hideTranslationIcon() {
        if (translationIcon) {
            translationIcon.remove();
            translationIcon = null;
        }
    }

    /**
     * Requests a translation from the API
     * @param {string} text - The text to translate
     * @param {string} language - The target language (i18n key)
     * @param {function} callback - The callback function
     */
    function requestTranslation(text, language, callback) {
        checkAuth((isAuthenticated) => {
            if (!isAuthenticated) {
                callback(null, chrome.i18n.getMessage("pleaseLogInForFreeTrial") || "Please log in for free trial");
                return;
            }

            chrome.storage.sync.get(['choice', 'model', 'isOwnCredits', 'language', 'userId'], function (settings) {
                if (settings.choice === 'remote') {
                    // Get natural language name for the prompt
                    const naturalLanguageName = chrome.i18n.getMessage(settings.language) || settings.language;
                    const userPrompt = chrome.i18n.getMessage("generateTranslation", [naturalLanguageName, text]);

                    chrome.runtime.sendMessage({
                        action: "callChatGPTAPI",
                        userId: settings.userId,
                        type: CONVERSATION_TYPES.TRANSLATION_POPUP,
                        message: userPrompt,
                        language: settings.language
                    }, response => {
                        if (response.success && response.data && response.data.translation) {
                            callback(response.data.translation, null);
                        } else {
                            const errorMessage = response.error || chrome.i18n.getMessage("errorGeneratingTranslation") || "Error generating translation";
                            callback(null, errorMessage);
                        }
                    });
                } else {
                    callback(null, chrome.i18n.getMessage("translationNotSupportedLocal") || "Translation not supported in local mode");
                }
            });
        });
    }

    /**
     * Shows the translation popup with loading state
     * @param {string} text - The text to translate
     */
    async function showTranslationPopup(text) {
        const modalHtml = `
            <div id="anki-lingo-flash-translate-modal" class="anki-lingo-flash-container">
                <div id="translateModal">
                    <div id="translationResult">
                        <div class="translation-loading">
                            <span class="spinner"></span>
                            ${chrome.i18n.getMessage("translating") || "Translating..."}
                        </div>
                    </div>
                    <div class="button-container">
                        <button id="generateFlashcardButton" class="modal-button">${chrome.i18n.getMessage("generateFlashcard") || "Generate Flashcard"}</button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        globalShadowRoot.appendChild(modalContainer);

        // Position the popup near the translation icon
        const modal = globalShadowRoot.querySelector('#anki-lingo-flash-translate-modal');
        const iconRect = translationIcon ? translationIcon.getBoundingClientRect() : null;

        if (iconRect) {
            const modalWidth = 300; // Approximate width
            const modalHeight = 100; // Approximate height

            let left = iconRect.left + window.scrollX;
            let top = iconRect.bottom + window.scrollY + 5;

            // Adjust if popup would go off screen
            if (left + modalWidth > window.innerWidth + window.scrollX) {
                left = window.innerWidth + window.scrollX - modalWidth - 10;
            }

            if (left < window.scrollX) {
                left = window.scrollX + 10;
            }

            if (top + modalHeight > window.innerHeight + window.scrollY) {
                top = iconRect.top + window.scrollY - modalHeight - 5;
            }

            modal.style.left = left + 'px';
            modal.style.top = top + 'px';
        } else {
            // Fallback to center positioning if no icon
            modal.style.left = '50%';
            modal.style.top = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
        }

        // Get current language setting
        chrome.storage.sync.get(['language'], function (settings) {
            const targetLanguage = settings.language || 'english_us';

            // Check cache first
            getCachedTranslation(text, targetLanguage).then(cachedTranslation => {
                if (cachedTranslation) {
                    displayTranslationResult(cachedTranslation);
                } else {
                    // Request translation from API
                    requestTranslation(text, targetLanguage, function(translation, error) {
                        if (translation) {
                            setCachedTranslation(text, targetLanguage, translation);
                            displayTranslationResult(translation);
                        } else {
                            displayTranslationError(error);
                        }
                    });
                }
            });
        });

        // Setup event listeners
        setupTranslationModalListeners(text);
    }

    /**
     * Shows the translation popup with a pre-existing translation result
     * @param {string} text - The original text that was translated
     * @param {string} translation - The translation result
     * @param {Object} iconPosition - Position where the popup should appear
     */
    async function showTranslationPopupWithResult(text, translation, iconPosition) {
        const modalHtml = `
            <div id="anki-lingo-flash-translate-modal" class="anki-lingo-flash-container">
                <div id="translateModal">
                    <div id="translationResult">
                        <p class="translation-text">${escapeHTML(translation)}</p>
                    </div>
                    <div class="button-container">
                        <button id="generateFlashcardButton" class="modal-button">${chrome.i18n.getMessage("generateFlashcard") || "Generate Flashcard"}</button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        globalShadowRoot.appendChild(modalContainer);

        // Set flag that popup is showing
        translationPopupShowing = true;

        // Position the popup at the specified position or fallback to icon positioning
        const modal = globalShadowRoot.querySelector('#anki-lingo-flash-translate-modal');

        if (iconPosition) {
            const modalWidth = 300; // Approximate width
            const modalHeight = 100; // Approximate height

            let left = iconPosition.left;
            let top = iconPosition.top;

            // Adjust if popup would go off screen
            if (left + modalWidth > window.innerWidth + window.scrollX) {
                left = window.innerWidth + window.scrollX - modalWidth - 10;
            }

            if (left < window.scrollX) {
                left = window.scrollX + 10;
            }

            if (top + modalHeight > window.innerHeight + window.scrollY) {
                top = iconPosition.top - modalHeight - 10;
            }

            modal.style.left = left + 'px';
            modal.style.top = top + 'px';
        } else {
            // Fallback to center positioning
            modal.style.left = '50%';
            modal.style.top = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
        }

        // Setup event listeners
        setupTranslationModalListeners(text);
    }

    /**
     * Shows an error toast notification for translation failures
     * @param {string} errorMessage - The error message to display
     */
    function showErrorToast(errorMessage) {
        // Format the error message
        const formattedError = chrome.i18n.getMessage("translationError") || "Translation Error";
        const fullMessage = `${formattedError}: ${errorMessage}`;

        // Show error toast with longer duration for readability
        showToast(fullMessage, false, false);
    }

    /**
     * Displays the translation result in the popup
     * @param {string} translation - The translation result
     */
    function displayTranslationResult(translation) {
        const resultDiv = globalShadowRoot.querySelector('#translationResult');
        if (resultDiv) {
            resultDiv.innerHTML = `<p class="translation-text">${escapeHTML(translation)}</p>`;
        }
    }

    /**
     * Displays an error message in the translation popup
     * @param {string} error - The error message
     */
    function displayTranslationError(error) {
        const resultDiv = globalShadowRoot.querySelector('#translationResult');
        if (resultDiv) {
            resultDiv.innerHTML = `<p class="translation-error">${escapeHTML(error)}</p>`;
        }
    }

    /**
     * Sets up event listeners for the translation modal
     * @param {string} originalText - The original text that was translated
     */
    function setupTranslationModalListeners(originalText) {
        const modal = globalShadowRoot.querySelector('#anki-lingo-flash-translate-modal');

        modal.addEventListener('click', function(event) {
            if (event.target.id === 'generateFlashcardButton') {
                hideTranslationPopup();
                // Use cached translation if available
                chrome.storage.sync.get(['language'], function (settings) {
                    const targetLanguage = settings.language || 'english_us';
                    getCachedTranslation(originalText, targetLanguage).then(cachedTranslation => {
                        if (cachedTranslation) {
                            // Check if we have a cached translation to pre-populate the flashcard
                            generateFlashcardWithCachedTranslation(originalText, cachedTranslation);
                        } else {
                            generateFlashcard(originalText);
                        }
                    });
                });
            }
        });

        // Add document-level click listener to close popup when clicking outside
        document.addEventListener('click', function clickOutsideHandler(event) {
            if (modal && !modal.contains(event.target)) {
                hideTranslationPopup();
                document.removeEventListener('click', clickOutsideHandler);
            }
        });
    }

    /**
     * Hides the translation popup
     */
    function hideTranslationPopup() {
        const modal = globalShadowRoot.querySelector('#anki-lingo-flash-translate-modal');
        if (modal) {
            modal.remove();
        }
        // Reset flag that popup is showing
        translationPopupShowing = false;
    }

    /**
     * Processes a translation request silently, showing popup only on success
     * @param {string} text - The text to translate
     * @param {Object} iconPosition - Position of the translation icon for popup placement
     */
    async function processTranslationRequest(text, iconPosition) {
        // Prevent duplicate requests
        if (translationRequestInProgress) {
            return;
        }

        translationRequestInProgress = true;

        try {
            // Get language setting
            const settings = await new Promise(resolve => {
                chrome.storage.sync.get(['language'], resolve);
            });
            const targetLanguage = settings.language || 'english_us';

            // Check cache first
            const cachedTranslation = await getCachedTranslation(text, targetLanguage);

            if (cachedTranslation) {
                // Success from cache - show popup immediately
                showTranslationPopupWithResult(text, cachedTranslation, iconPosition);
            } else {
                // Request from API
                requestTranslation(text, targetLanguage, function(translation, error) {
                    if (translation) {
                        // Cache the successful translation
                        setCachedTranslation(text, targetLanguage, translation);
                        showTranslationPopupWithResult(text, translation, iconPosition);
                    } else {
                        showErrorToast(error || chrome.i18n.getMessage("errorGeneratingTranslation") || "Translation failed");
                    }
                });
            }
        } catch (error) {
            console.log('Error in processTranslationRequest:', error);
            showErrorToast(chrome.i18n.getMessage("errorGeneratingTranslation") || "Translation failed");
        } finally {
            translationRequestInProgress = false;
        }
    }

    /**
     * Generates a flashcard with pre-populated translation
     * @param {string} text - The selected text
     * @param {string} translation - The cached translation
     */
    async function generateFlashcardWithCachedTranslation(text, translation) {
        // Show loading toast immediately
        showToast(chrome.i18n.getMessage("generatingFlashcard"), true, true);

        try {
            const settings = await new Promise(resolve =>
                chrome.storage.sync.get(['choice', 'user', 'isOwnCredits', 'apiKeyValidated', 'googleApiKeyValidated', 'selectedProvider', 'freeGenerationLimit', 'userId', 'language', 'learningGoal'], resolve)
            );

            if (settings.choice === 'remote') {
                if (settings.isOwnCredits) {
                    const isValid = await isApiKeyValid();
                    if (isValid) {
                        await proceedWithFlashcardGenerationWithTranslation(text, translation, settings);
                    } else {
                        removeCurrentToast();
                        console.log("API key validation failed");
                    }
                } else {
                    if (!settings.user) {
                        removeCurrentToast();
                        showToast(chrome.i18n.getMessage("pleaseLogInForFreeTrial"));
                        return;
                    }
                    const canGenerate = await checkCanGenerateFlashcard(settings.user.id, settings.isOwnCredits);
                    if (canGenerate) {
                        await proceedWithFlashcardGenerationWithTranslation(text, translation, settings);
                    } else {
                        removeCurrentToast();
                        showToast(chrome.i18n.getMessage("flashcardLimitReached", [settings.freeGenerationLimit]));
                    }
                }
            }
        } catch (error) {
            removeCurrentToast();
            console.log('Error generating flashcard:', error);
            showToast(chrome.i18n.getMessage("errorGeneratingFlashcard") + (error.message ? `: ${error.message}` : ''));
        }
    }

    /**
     * Creates a flashcard with pre-populated translation
     * @param {string} selectedText - The text selected by the user
     * @param {string} cachedTranslation - The cached translation
     * @param {Object} settings - User settings and preferences
     */
    async function proceedWithFlashcardGenerationWithTranslation(selectedText, cachedTranslation, settings) {
        const language = settings.language;
        const naturalLanguageName = chrome.i18n.getMessage(language);

        // Create flashcard with cached translation immediately, no API call needed
        const flashcardId = Date.now().toString();
        const newFlashcard = {
            id: flashcardId,
            recto: "Definition will be generated...", // We'll generate this separately
            verso: selectedText,
            translation: cachedTranslation,
            regenerationCount: { definition: 0, mnemonic: 0, translation: 0, examples: 0 }
        };

        // We need to generate the definition separately since we only have the translation
        const mnemonicToggleState = await loadMnemonicToggleState();
        const definitionPrompt = mnemonicToggleState
            ? chrome.i18n.getMessage("generateDefinitionWithMnemonicPrompt", [naturalLanguageName, selectedText])
            : chrome.i18n.getMessage("generateDefinitionPrompt", [naturalLanguageName, selectedText]);

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: "callChatGPTAPI",
                    userId: settings.userId,
                    type: CONVERSATION_TYPES.DEFINITION,
                    message: definitionPrompt,
                    language: language
                }, response => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });

            if (response.success && response.data && response.data.definition) {
                newFlashcard.recto = response.data.definition;
                newFlashcard.mnemonic = mnemonicToggleState ? (response.data.mnemonic || "") : "";
                newFlashcard.mnemonicGenerated = mnemonicToggleState && !!response.data.mnemonic;
            }

            const flashcards = settings.flashcards || {};
            flashcards[flashcardId] = newFlashcard;

            await new Promise(resolve => chrome.storage.sync.set({ flashcards: flashcards }, resolve));
            showReviewModal(newFlashcard, language);

            if (!settings.isOwnCredits) {
                const incrementResponse = await new Promise(resolve =>
                    chrome.runtime.sendMessage({ action: "incrementFlashcardCount" }, resolve)
                );
                if (incrementResponse && incrementResponse.success) {
                    updateFlashcardCounter(incrementResponse.newCount, incrementResponse.remainingCards);
                }
            }
        } catch (error) {
            console.log("Error generating definition:", error);
            // Still show the modal with cached translation even if definition generation fails
            showReviewModal(newFlashcard, language);
        }
    }

    /**
     * Sets up text selection detection for translation popup
     */
    function setupTextSelectionDetection() {
        // Debounce rapid selections
        document.addEventListener('mouseup', function(event) {
            // Clear existing timeout
            if (selectionTimeout) {
                clearTimeout(selectionTimeout);
            }

            // Set a small delay to avoid triggering on single clicks
            selectionTimeout = setTimeout(() => {
                const selection = window.getSelection();
                if (selection && selection.toString().trim().length >= 3 && !translationPopupShowing) {
                    showTranslationIcon(selection);
                } else {
                    hideTranslationIcon();
                }
            }, 250);
        });

        document.addEventListener('touchend', function(event) {
            // Same logic for touch devices
            if (selectionTimeout) {
                clearTimeout(selectionTimeout);
            }

            selectionTimeout = setTimeout(() => {
                const selection = window.getSelection();
                if (selection && selection.toString().trim().length >= 3 && !translationPopupShowing) {
                    showTranslationIcon(selection);
                } else {
                    hideTranslationIcon();
                }
            }, 250);
        });

        // Hide icon when clicking elsewhere or scrolling
        document.addEventListener('click', function(event) {
            if (translationIcon && !translationIcon.contains(event.target)) {
                hideTranslationIcon();
            }
        });

        document.addEventListener('scroll', function() {
            hideTranslationIcon();
        });

        // Hide icon when selection changes
        document.addEventListener('selectionchange', function() {
            const selection = window.getSelection();
            if (!selection || selection.toString().trim().length < 3) {
                hideTranslationIcon();
            }
        });
    }
    
    /**
     * Checks if a flashcard can be generated for the given user.
     * 
     * @param {string} userId - The ID of the user.
     * @param {boolean} isOwnCredits - Whether the user is using their own credits.
     * @returns {Promise<boolean>} A promise that resolves with whether a flashcard can be generated.
     */
    function checkCanGenerateFlashcard(userId, isOwnCredits) {
        return fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/generate-flashcard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, isOwnCredits }),
        })
            .then(response => response.json())
            .then(data => data.canGenerate);
    }
    
    /**
     * Generates a flashcard from the selected text.
     * 
     * @param {string} selectedText - The text selected by the user.
     * @param {string} [requestedLanguageKey] - Optional: The i18n language key requested for generation (e.g., from context menu).
     */
    async function  generateFlashcard(selectedText, requestedLanguageKey) {
        // Show loading toast immediately
        showToast(chrome.i18n.getMessage("generatingFlashcard"), true, true);
        try {
            const settings = await new Promise(resolve =>
                chrome.storage.sync.get(['choice', 'user', 'isOwnCredits', 'apiKeyValidated', 'googleApiKeyValidated', 'selectedProvider', 'freeGenerationLimit', 'userId', 'language', 'learningGoal'], resolve)
            );
    
            // Use requestedLanguageKey if provided, otherwise default to settings.language
            const naturalLanguageName = chrome.i18n.getMessage(settings.language)
            console.log("settings.language:",settings.language);
            console.log('naturalLanguageName:', naturalLanguageName);

            if (settings.choice === 'remote') {
                if (settings.isOwnCredits) {
                    const isValid = await isApiKeyValid();
                    if (isValid) {
                        await proceedWithFlashcardGeneration(selectedText, naturalLanguageName, settings);
                    } else {
                        removeCurrentToast(); 
                        // Error message will be shown by the API key validation
                        console.log("API key validation failed");
                    }
                } else {
                    if (!settings.user) {
                        removeCurrentToast();
                        showToast(chrome.i18n.getMessage("pleaseLogInForFreeTrial"));
                        return;
                    }
                    const canGenerate = await checkCanGenerateFlashcard(settings.user.id, settings.isOwnCredits);
                    if (canGenerate) {
                        await proceedWithFlashcardGeneration(selectedText, naturalLanguageName, settings);
                    } else {
                        removeCurrentToast();
                        showToast(chrome.i18n.getMessage("flashcardLimitReached", [settings.freeGenerationLimit]));
                    }
                }
            } else {
                // Local model logic
                removeCurrentToast(); // Remove "generating..." toast
                // ... (existing local model logic)
                // For local, ensure naturalLanguageName is derived if needed for prompts
                // const naturalLanguageName = chrome.i18n.getMessage(languageKeyToUse) || languageKeyToUse;
                // ...
                console.log('Local model flashcard generation not fully implemented here.');
                showToast("Local model generation not yet fully supported via this flow.");
            }
        } catch (error) {
            removeCurrentToast();
            console.log('Error generating flashcard:', error);
            showToast(chrome.i18n.getMessage("errorGeneratingFlashcard") + (error.message ? `: ${error.message}` : ''));
        }
    }
    
    /**
     * Updates the flashcard counter in storage and UI.
     * 
     * @param {number} count - The new flashcard count.
     * @param {number} remainingCards - The number of remaining cards.
     */
    function updateFlashcardCounter(count, remainingCards) {
        chrome.storage.sync.set({
            flashcardCount: count,
            remainingCards: remainingCards
        }, () => {
            console.log('Flashcard count updated:', count);
            console.log('Remaining cards:', remainingCards);
        });
    }
    
    /**
     * Increments the flashcard count and updates the UI.
     */
    function incrementFlashcardCount() {
        chrome.runtime.sendMessage({ action: "incrementFlashcardCount" }, function (response) {
            if (response && response.success) {
                updateFlashcardCounter(response.newCount, response.remainingCards);
            } else {
                console.log('Error incrementing flashcard count:', response ? response.error : 'Unknown error');
            }
        });
    }
    
    /**
     * Displays a review modal for a given flashcard, allowing users to review and edit its content.
     * The modal includes fields for the front (definition), back (selected text), direct translation, and mnemonic.
     * Users can regenerate content, validate their changes, or cancel the review.
     * 
     * @param {Object} flashcard - The flashcard object containing its content and metadata.
     * @param {string} selectedLanguage - The language selected by the user for the flashcard.
     */
    async function showReviewModal(flashcard, selectedLanguage) {
        if (currentToast) {
            removeCurrentToast();
        }
        
        const oldModal = globalShadowRoot.querySelector('#anki-lingo-flash-review-modal');
        if (oldModal) {
            oldModal.remove();
        }
        
        let selectedText = flashcard.verso;
        let contextText = '';
    
        // Tentative de récupération du texte sélectionné et du contexte
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // Récupération du texte sélectionné
            selectedText = range.toString().trim();
            
            // Tentative de récupération du contexte
            let container = range.commonAncestorContainer;
            while (container && container.nodeType !== Node.ELEMENT_NODE) {
                container = container.parentNode;
            }
            
            if (container) {
                // Récupération d'un contexte plus large
                contextText = container.textContent || container.innerText || '';
            }
        }
    
        // Si nous n'avons pas pu obtenir de contexte, utilisons le texte sélectionné comme contexte
        if (!contextText) {
            contextText = selectedText;
        }
    
        console.log("Selected text:", selectedText);
        console.log("Context text:", contextText);
    
        const detectedLanguage = detectLanguage(selectedText, contextText);
        console.log("Detected language:", detectedLanguage);
    
        flashcard.detectedLanguage = detectedLanguage;
        
        const modalHtml = `
        <div id="anki-lingo-flash-review-modal" class="anki-lingo-flash-container">
            <div id="reviewModal" data-flashcard-id="${escapeHTML(flashcard.id)}">
                <div class="modal-content">
                    <h2>${chrome.i18n.getMessage("reviewFlashcard")}</h2>
                    <div class="section">
                        <h3>${chrome.i18n.getMessage("front")}</h3>
                        <div class="sub-section">
                            <h4>${chrome.i18n.getMessage("directTranslation")}</h4>
                            <div class="sub-section-content">
                                <div class="input-with-button">
                                    <textarea class="translation editable ${isArabic(selectedLanguage) ? 'rtl-language' : ''}" rows="3">${escapeHTML(flashcard.translation || '')}</textarea>
                                    <button id="regenerateTranslation" class="regenerate-button"></button>
                                </div>
                            </div>
                        </div>
                        <div class="sub-section">
                            <h4>${chrome.i18n.getMessage("Definition")}</h4>
                            <div class="sub-section-content">
                                <div class="input-with-button">
                                    <textarea class="definition editable ${isArabic(selectedLanguage) ? 'rtl-language' : ''}" rows="3">${escapeHTML(flashcard.recto)}</textarea>
                                    <button id="regenerateDefinition" class="regenerate-button"></button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="section">
                        <h3>${chrome.i18n.getMessage("back")}</h3>
                        <div class="sub-section">
                            <h4>${chrome.i18n.getMessage("selectedText")}</h4>
                            <div class="sub-section-content">
                                <div class="input-with-button">
                                    <textarea class="back editable ${isArabic(flashcard.detectedLanguage) ? 'rtl-language' : ''}" rows="3">${escapeHTML(flashcard.verso)}</textarea>
                                    <div class="spacer"></div>
                                </div>
                            </div>
                        </div>
                        <div class="sub-section">
                            <h4>${chrome.i18n.getMessage("examples")}</h4>
                            <div class="sub-section-content">
                                <div class="input-with-button">
                                    <textarea class="examples editable ${isArabic(selectedLanguage) ? 'rtl-language' : ''}" rows="6">${escapeHTML(flashcard.example_1 || '')}\n${escapeHTML(flashcard.example_2 || '')}\n${escapeHTML(flashcard.example_3 || '')}</textarea>
                                    <button id="regenerateExamples" class="regenerate-button"></button>
                                </div>
                            </div>
                        </div>
                        <div class="sub-section" id="mnemonic-section">
                            <label for="mnemonicToggle" class="toggle-switch">
                                <input type="checkbox" id="mnemonicToggle">
                                <span class="slider round">
                                <span class="toggle-label" data-state="off">${chrome.i18n.getMessage("dontGenMnemonic")}</span>
                                <span class="toggle-label" data-state="on">${chrome.i18n.getMessage("genMnemonic")}</span>
                                </span>
                            </label>
                            <div class="sub-section-content" id="mnemonicContent">
                                <div class="input-with-button">
                                    <textarea class="mnemonic editable ${isArabic(selectedLanguage) ? 'rtl-language' : ''}" rows="3">${escapeHTML(flashcard.mnemonic || '')}</textarea>
                                    <button id="regenerateMnemonic" class="regenerate-button"></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="button-container">
                    <button id="cancelReviewButton" class="modal-button">${chrome.i18n.getMessage("cancel")}</button>
                    <button id="validateButton" class="modal-button">${chrome.i18n.getMessage("validate")}</button>
                </div>
            </div>
            <div id="modalBackdrop"></div>
        </div>
        `;
    
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        globalShadowRoot.appendChild(modalContainer);
    
        setupRefreshLogo();
    
        const mnemonicToggle = globalShadowRoot.querySelector('#mnemonicToggle');
        const mnemonicContent = globalShadowRoot.querySelector('#mnemonicContent');
    
        // Charger l'état précédent du toggle
        const initialToggleState = await loadMnemonicToggleState();
        mnemonicToggle.checked = initialToggleState;
        mnemonicContent.style.display = initialToggleState ? 'block' : 'none';
    
        mnemonicToggle.addEventListener('change', async function() {
            const isChecked = this.checked;
            saveMnemonicToggleState(isChecked);
        
            if (isChecked) {
                if (!flashcard.mnemonicGenerated) {
                    // Première activation : générer le mnémonique
                    globalShadowRoot.querySelector('#anki-lingo-flash-review-modal').style.display = 'none';
                    showToast(chrome.i18n.getMessage("regeneratingMnemonic"), true, true);
        
                    await regenerateContent('mnemonic', flashcard.id);
        
                    chrome.storage.sync.get(['flashcards'], function(result) {
                        const updatedFlashcard = result.flashcards[flashcard.id];
                        globalShadowRoot.querySelector('.mnemonic').value = updatedFlashcard.mnemonic || '';
                        
                        flashcard.mnemonicGenerated = true;  // Correction ici
                        flashcard.mnemonic = updatedFlashcard.mnemonic;  // Mise à jour du mnémonique dans l'objet flashcard local
                        result.flashcards[flashcard.id] = flashcard;  // Mise à jour de l'objet flashcard dans le stockage
                        chrome.storage.sync.set({ flashcards: result.flashcards });
                        
                        mnemonicContent.style.display = 'block';
                        globalShadowRoot.querySelector('#anki-lingo-flash-review-modal').style.display = 'flex';
                        removeCurrentToast();
                    });
                } else {
                    // Activations suivantes : simplement afficher le contenu existant
                    mnemonicContent.style.display = 'block';
                }
            } else {
                mnemonicContent.style.display = 'none';
            }
        });
    
        // Utilisation de la délégation d'événements
        const modal = globalShadowRoot.querySelector('#anki-lingo-flash-review-modal');
        
        modal.addEventListener('click', function(event) {
            if (event.target.id === 'validateButton') {
                const updatedFlashcard = {
                    id: flashcard.id,
                    recto: this.querySelector('#reviewModal .definition').value,
                    verso: this.querySelector('#reviewModal .back').value,
                    translation: this.querySelector('#reviewModal .translation').value,
                    mnemonic: mnemonicToggle.checked ? this.querySelector('#reviewModal .mnemonic').value : "",
                    regenerationCount: flashcard.regenerationCount,
                    detectedLanguage: flashcard.detectedLanguage,
                    mnemonicGenerated: flashcard.mnemonicGenerated
                };
    
                // Séparation des exemples
                const examplesText = this.querySelector('#reviewModal .examples').value;
                const examples = examplesText.split('\n').filter(example => example.trim() !== '');
                updatedFlashcard.example_1 = examples[0] || '';
                updatedFlashcard.example_2 = examples[1] || '';
                updatedFlashcard.example_3 = examples[2] || '';
    
                this.remove();
                checkAnkiRunning(updatedFlashcard);
            } else if (event.target.id === 'cancelReviewButton') {
                this.remove();
                chrome.runtime.sendMessage({ action: "flashcardCreationCanceled" }, function (response) {
                    showToast(chrome.i18n.getMessage("flashcardCreationCanceled"));
                });
            } else if (event.target.id === 'regenerateDefinition') {
                regenerateContent('definition', flashcard.id);
            } else if (event.target.id === 'regenerateMnemonic') {
                regenerateContent('mnemonic', flashcard.id);
            } else if (event.target.id === 'regenerateTranslation') {
                regenerateContent('translation', flashcard.id);
            } else if (event.target.id === 'regenerateExamples') {
                regenerateContent('examples', flashcard.id);
            }
        });
    
        // Debugging
        console.log('Modal created:', modal);
        console.log('Validate button:', modal.querySelector('#validateButton'));
        console.log('Cancel button:', modal.querySelector('#cancelReviewButton'));
    
        // Assurez-vous que le DOM est complètement chargé
        setTimeout(() => {
            setupRefreshLogo();
        }, 0);
    }
    
    /**
     * Proceeds with flashcard generation after initial checks.
     * 
     * @param {string} selectedText - The text selected by the user.
     * @param {string} language - The target language for the flashcard.
     * @param {Object} settings - User settings and preferences.
     */
    async function proceedWithFlashcardGeneration(selectedText, language, settings) {
        showToast(chrome.i18n.getMessage("creatingFlashcard"), true, true);

        if (settings.choice === 'remote') {
            console.log('Using remote model');

            // Check if we have a cached translation first
            const cachedTranslation = await getCachedTranslation(selectedText, language);
            if (cachedTranslation) {
                console.log('Using cached translation for flashcard generation');
                await proceedWithFlashcardGenerationWithTranslation(selectedText, cachedTranslation, settings);
                return;
            }

            // Charger l'état du toggle mnémonique
            const mnemonicToggleState = await loadMnemonicToggleState();

            // Choisir le bon prompt en fonction de l'état du toggle mnémonique
            const userMessage = mnemonicToggleState
                ? chrome.i18n.getMessage("generateFlashcardWithMnemonicPrompt", [language, selectedText])
                : chrome.i18n.getMessage("generateFlashcardPrompt", [language, selectedText]);

            console.log(`[generateFlashcard] language (i18n key): ${language}`);
            console.log(`[generateFlashcard] Prompt utilisé:`, userMessage);

            try {
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: "callChatGPTAPI",
                        userId: settings.userId,
                        type: CONVERSATION_TYPES.FLASHCARD,
                        message: userMessage,
                        language: language
                    }, response => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(response);
                        }
                    });
                });
    
                console.log('Full API response:', response);
                if (response.success) {
                    const flashcardData = response.data;

                    // Cache the translation for future use
                    if (flashcardData.translation) {
                        setCachedTranslation(selectedText, language, flashcardData.translation);
                        console.log('Cached translation from flashcard generation');
                    }

                    const flashcardId = Date.now().toString();
                    const newFlashcard = {
                        id: flashcardId,
                        recto: flashcardData.definition,
                        verso: selectedText,
                        mnemonic: mnemonicToggleState ? flashcardData.mnemonic : "",
                        mnemonicGenerated: mnemonicToggleState,
                        translation: flashcardData.translation,
                        example_1: flashcardData.example_1,
                        example_2: flashcardData.example_2,
                        example_3: flashcardData.example_3,
                        regenerationCount: { definition: 0, mnemonic: 0, translation: 0, examples: 0 }
                    };
                    console.log("NEW FLASHCARD:");
                    console.log(newFlashcard);
    
                    const flashcards = settings.flashcards || {};
                    flashcards[flashcardId] = newFlashcard;
    
                    await new Promise(resolve => chrome.storage.sync.set({ flashcards: flashcards }, resolve));
                    showReviewModal(newFlashcard, language);
                    console.log('Flashcard created:', newFlashcard);
                    if (!settings.isOwnCredits) {
                        const incrementResponse = await new Promise(resolve =>
                            chrome.runtime.sendMessage({ action: "incrementFlashcardCount" }, resolve)
                        );
                        if (incrementResponse && incrementResponse.success) {
                            console.log("Flashcard count incremented successfully");
                            updateFlashcardCounter(incrementResponse.newCount, incrementResponse.remainingCards);
                        } else {
                            console.log("Failed to increment flashcard count");
                        }
                    }
                } else {
                    console.log("API Error:", response.error);
                    removeCurrentToast(); // Remove the "creating..." toast
                    
                    // Use the provider information from the response
                    const provider = response.provider || 'openai';
                    
                    // Check if this is an unsupported model error
                    if (response.isUnsupportedModel) {
                        showToast(chrome.i18n.getMessage("unsupportedModelError"));
                    } else if (response.status) {
                        // Use the detailed error information from the background script
                        const errorObj = {
                            status: response.status,
                            message: response.error,
                            errorData: response.errorData || { error: { message: response.error } }
                        };
                        
                        const errorMessage = getApiErrorMessage(errorObj, provider);
                        showToast(errorMessage);
                    } else {
                        // Fallback to the generic creation error
                        showToast(chrome.i18n.getMessage("errorCreatingFlashcard"));
                    }
                }
            } catch (error) {
                console.log("Error calling ChatGPT API:", error);
                removeCurrentToast(); // Remove the "creating..." toast
                
                // Handle network and other errors
                // Since this is a catch block, we don't have response.provider, so use default
                chrome.storage.sync.get(['selectedProvider'], function(providerResult) {
                    const provider = providerResult.selectedProvider || 'openai';
                    const errorMessage = getApiErrorMessage(error, provider);
                    showToast(errorMessage);
                });
            }
        }
    }
    
    /**
     * Checks if Anki is running and proceeds accordingly.
     * 
     * @param {Object} flashcard - The flashcard object to be added to Anki.
     */
    function checkAnkiRunning(flashcard) {
        invoke('version', 6)
            .then(() => {
                showDeckSelectionModal(flashcard);
            })
            .catch(() => {
                showAnkiNotOpenModal(flashcard);
            });
    }
    
    /**
     * Displays a modal informing the user that Anki is not open.
     * 
     * @param {Object} flashcard - The flashcard object that was being processed.
     */
    function showAnkiNotOpenModal(flashcard) {
        console.log("Showing Anki not open modal");
    
        const modalHtml = `
            <div id="anki-lingo-flash-anki-not-open-modal" class="anki-lingo-flash-container">
                <div id="ankiNotOpenModal">
                    <h2>${chrome.i18n.getMessage("error")}</h2>
                    <p>${chrome.i18n.getMessage("pleaseEnsureAnkiOpen")}</p>
                    <div class="button-container">
                        <button id="cancelButton" class="modal-button">${chrome.i18n.getMessage("cancel")}</button>
                        <button id="retryButton" class="modal-button">${chrome.i18n.getMessage("tryAgain")}</button>
                    </div>
                </div>
                <div id="modalBackdrop"></div>
            </div>
        `;
    
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        globalShadowRoot.appendChild(modalContainer);
    
        const linkElement = globalShadowRoot.querySelector('#ankiNotOpenModal a');
        if (linkElement) {
            linkElement.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.runtime.sendMessage({ action: "openTab", url: e.target.href });
            });
        }
    
        globalShadowRoot.getElementById('cancelButton').addEventListener('click', () => {
            globalShadowRoot.querySelector('#anki-lingo-flash-anki-not-open-modal').remove();
            showToast(chrome.i18n.getMessage("flashcardCreationCanceled"));
        });
    
        globalShadowRoot.getElementById('retryButton').addEventListener('click', () => {
            globalShadowRoot.querySelector('#anki-lingo-flash-anki-not-open-modal').remove();
            checkAnkiRunning(flashcard);
        });
    }
    
    /**
     * Checks if the model for a specific language exists in Anki, and creates it if not.
     * 
     * @param {string} modelName - The name of the model to check/create.
     * @returns {Promise} A promise that resolves when the model is checked/created.
     */
    function checkAndCreateModelForLanguage(modelName) {
        return invoke('modelNames', 6)
            .then(models => {
                if (!models.includes(modelName)) {
                    return invoke('createModel', 6, {
                        modelName: modelName,
                        inOrderFields: ["Translation", "Definition", "Selection", "Example_1", "Example_2", "Example_3", "Mnemonic", "Add Reverse"],
                        cardTemplates: [
                            {
                                Name: "Card 1",
                                Front: `
                                    <div style='font-family: "Arial"; font-size: 20px; text-align: center;'>
                                        <b>${chrome.i18n.getMessage('directTranslation')}</b><br>{{Translation}}
                                        <br><br><b>${chrome.i18n.getMessage('Definition')}</b><br>{{Definition}}
                                    </div>`,
                                Back: `
                                    {{FrontSide}}
                                    <hr id="answer">
                                    <div style='font-family: "Arial"; font-size: 20px; text-align: center;'>
                                        {{Selection}}
                                    </div>
                                    <br><br>
                                    <i>1. {{Example_1}}</i><br>
                                    <i>2. {{Example_2}}</i><br>
                                    <i>3. {{Example_3}}</i>
                                    {{#Mnemonic}}
                                    <br><br>
                                    <div style='font-family: "Arial"; font-size: 18px;'>
                                        <b>${chrome.i18n.getMessage('Mnemonic')}</b><br>{{Mnemonic}}
                                    </div>
                                    {{/Mnemonic}}`
                            },
                            {
                                Name: "Card 2 (Reverse)",
                                Front: `
                                    {{#Add Reverse}}
                                        {{Selection}}
                                        <br><br>
                                        <i>1. {{Example_1}}</i><br>
                                        <i>2. {{Example_2}}</i><br>
                                        <i>3. {{Example_3}}</i>
                                        {{#Mnemonic}}
                                        <br><br>
                                        <div style='font-family: "Arial"; font-size: 18px;'>
                                            <b>${chrome.i18n.getMessage('Mnemonic')}</b><br>{{Mnemonic}}
                                        </div>
                                        {{/Mnemonic}}
                                    {{/Add Reverse}}`,
                                Back: `
                                    {{#Add Reverse}}
                                    <div style='font-family: "Arial"; font-size: 20px; text-align: center;'>
                                        <b>${chrome.i18n.getMessage('directTranslation')}</b><br>{{Translation}}
                                        <br><br><b>${chrome.i18n.getMessage('Definition')}</b><br>{{Definition}}
                                    </div>
                                    {{/Add Reverse}}`
                            }
                        ]
                    });
                } else {
                    console.log(`Model ${modelName} already exists.`);
                    return Promise.resolve();
                }
            });
    }
    
    /**
     * Checks if the model exists, creates it if necessary, and then adds the note to Anki.
     * 
     * @param {string} selectedDeck - The name of the selected Anki deck.
     * @param {Object} data - The flashcard data.
     * @param {string} modelName - The name of the Anki model to use.
     * @returns {Promise} A promise that resolves when the note is added.
     */
    function checkAndCreateModelBeforeAdding(selectedDeck, data, modelName, createReverse) {
        console.log("Starting checkAndCreateModelBeforeAdding");
        console.log("Selected deck:", selectedDeck);
        console.log("Model name:", modelName);
        console.log("Flashcard data:", data);
        console.log("Create reverse card:", createReverse);
    
        return checkAndCreateModelForLanguage(modelName)
            .then(() => {
                console.log("Model checked/created successfully");
    
                const note = {
                    "deckName": selectedDeck,
                    "modelName": modelName,
                    "fields": {
                        "Definition": data.recto,
                        "Selection": data.verso,
                        "Translation": data.translation || '',
                        "Example_1": data.example_1 || '',
                        "Example_2": data.example_2 || '',
                        "Example_3": data.example_3 || '',
                        "Mnemonic": data.mnemonic || '',
                        "Add Reverse": createReverse ? "1" : ""
                    },
                    "options": {
                        allowDuplicate: true
                    },
                    "tags": []
                };
    
                console.log("Prepared note:", note);
                return invoke('addNote', 6, { note });
            })
            .then(result => {
                console.log("Note added successfully:", result);
                return result;
            })
            .catch(error => {
                console.log("Error in checkAndCreateModelBeforeAdding:", error);
                throw error;
            });
    }
    
    /**
     * Detects the language of the given text using context from the original element.
     * 
     * @param {string} text - The text to detect the language of.
     * @param {Element} originalElement - The original DOM element containing the text.
     * @returns {string} The detected language code.
     */
    function detectLanguage(text, originalElement) {
        const languagesToCheck = ['cmn', 'spa', 'eng', 'rus', 'arb', 'ben', 'hin', 'por', 'ind', 'jpn', 'fra', 'deu', 'jav', 'kor', 'tel', 'vie', 'mar', 'ita', 'tam', 'tur', 'urd', 'guj', 'pol', 'ukr', 'kan', 'mai', 'mal', 'mya', 'pan', 'ron', 'nld', 'hrv', 'tha', 'swh', 'amh', 'orm', 'uzn', 'aze', 'kat', 'ces', 'hun', 'ell', 'swe', 'heb', 'zlm', 'dan', 'fin', 'nor', 'slk'];

        function detectWithFranc(text) {
            return window.francAll(text, {
                minLength: 1,
                whitelist: languagesToCheck
            })[0][0];
        }

        function getTextContent(element) {
            return element.textContent.trim().replace(/\s+/g, ' ');
        }
        function expandContext(element, depth = 0) {
            if (!element || depth > 5) return null;

            let parent = element.parentElement;
            if (!parent) return null;

            let contextText = getTextContent(parent);
            if (contextText.length > text.length * 3) {
                return contextText;
            }

            return expandContext(parent, depth + 1);
        }

        let initialDetection = detectWithFranc(text);
        console.log("Initial detection:", initialDetection);

        if (languagesToCheck.includes(initialDetection) && originalElement) {
            let expandedContext = expandContext(originalElement);
            if (expandedContext) {
                let contextDetection = detectWithFranc(expandedContext);
                console.log("Context detection:", contextDetection);

                if (contextDetection !== initialDetection) {
                    // If the context detection is different, look for a majority class
                    let detections = [initialDetection, contextDetection];
                    let currentElement = originalElement.parentElement;
                    let depth = 0;

                    while (currentElement && depth < 5) {
                        let furtherContext = getTextContent(currentElement);

                        console.log("expanded context: " + furtherContext);

                        let furtherDetection = detectWithFranc(furtherContext);
                        detections.push(furtherDetection);

                        // Check if a language is in majority
                        let counts = detections.reduce((acc, lang) => {
                            acc[lang] = (acc[lang] || 0) + 1;
                            return acc;
                        }, {});

                        let majorityLang = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
                        if (counts[majorityLang] > detections.length / 2) {
                            console.log("Majority language found:", majorityLang);
                            return majorityLang;
                        }

                        currentElement = currentElement.parentElement;
                        depth++;
                    }
                }
            }
        }

        console.log("Final detection:", initialDetection);
        return initialDetection;
    }
    
    /**
     * Displays a modal for selecting an Anki deck and confirming flashcard details.
     * 
     * @param {Object} data - The flashcard data to be added to Anki.
     *                          `data.detectedLanguage` should ideally be an i18n key if present.
     */
    async function showDeckSelectionModal(data) {
        const decks = await fetchDecks();
        
        chrome.storage.sync.get(['lastUsedDeck', 'language', 'createReverseCardToggle'], async function (result) {
            let lastUsedDeck = result.lastUsedDeck;
            
            // currentLanguageKey should be an i18n key.
            // Prioritize data.detectedLanguage (if it's an i18n key), then stored settings.language, then a default.
            let currentLanguageKey = data.detectedLanguage || result.language;
            if (!SUPPORTED_I18N_LANGUAGE_KEYS.includes(currentLanguageKey)) {
                currentLanguageKey = SUPPORTED_I18N_LANGUAGE_KEYS.includes('english_us') ? 'english_us' : SUPPORTED_I18N_LANGUAGE_KEYS[0]; 
            }
            
            // The language selection dropdown is currently commented out in your HTML.
            // If re-enabled, it will be populated with i18n keys as values.
            // const languageOptions = await generateLanguageOptions(currentLanguageKey);
            
            const deckOptions = decks.map(deck =>
                `<option value="${deck}" ${deck === lastUsedDeck ? 'selected' : ''}>${deck}</option>`
            ).join('');
    
            const createReverseCardToggle = result.createReverseCardToggle !== undefined ? result.createReverseCardToggle : true;
    
            let modalHtml = `
                <div id="anki-lingo-flash-deck-selection-modal" class="anki-lingo-flash-container">
                    <div id="flashcardModal">
                        <div class="form-group">
                            <label for="deckSelect">${chrome.i18n.getMessage("selectTheDeck")}</label>
                            <select id="deckSelect">
                                ${deckOptions}
                            </select>
                        </div>
                        <!--
                        <div class="language-selection">
                            <label for="languageSelect">${chrome.i18n.getMessage("selectLanguage")}</label>
                            <select id="languageSelect">
                                ${await generateLanguageOptions(currentLanguageKey)} // Call if dropdown is active
                            </select>
                        </div>
                        -->
                        <div class="create-reverse-checkbox">
                            <label for="createReverseCardToggle">${chrome.i18n.getMessage("CreateReverseCardLabel")}</label>
                            <label class="toggle-switch">
                                <input type="checkbox" id="createReverseCardToggle" name="createReverseCardToggle" ${createReverseCardToggle ? 'checked' : ''}>
                                <span class="slider">
                                    <span class="toggle-label" data-state="off">${chrome.i18n.getMessage("No")}</span>
                                    <span class="toggle-label" data-state="on">${chrome.i18n.getMessage("Yes")}</span>
                                </span>
                            </label>
                        </div>
                        <div class="button-container">
                            <button id="validateButton" class="modal-button">${chrome.i18n.getMessage("validate")}</button> 
                            <button id="cancelButton" class="modal-button">${chrome.i18n.getMessage("cancel")}</button>
                        </div>
                    </div> 
                    <div id="modalBackdrop"></div>
                </div>
            `;
    
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            globalShadowRoot.appendChild(modalContainer);
    
            // If languageSelect is active:
            // const languageSelect = globalShadowRoot.querySelector('#languageSelect');
            // if (languageSelect) {
            //     languageSelect.value = currentLanguageKey;
            // }
    
            globalShadowRoot.querySelector('#validateButton').addEventListener('click', () => {
                const selectedDeck = globalShadowRoot.querySelector('#deckSelect').value;
                const createReverse = globalShadowRoot.querySelector('#createReverseCardToggle').checked;
    
                // If languageSelect is active:
                // const selectedLanguageKey = globalShadowRoot.querySelector('#languageSelect').value;
                // console.log("Selected language key:", selectedLanguageKey);
                // chrome.storage.sync.set({ language: selectedLanguageKey }); // Optionally save selected language
    
                const modelName = `AnkiLingoFlash_0.4`; // Model name is generic
    
                chrome.storage.sync.set({ createReverseCardToggle: createReverse, lastUsedDeck: selectedDeck });
    
                checkAndCreateModelBeforeAdding(selectedDeck, data, modelName, createReverse)
                    .then(result => {
                        console.log("Note added successfully:", result);
                        showToast(chrome.i18n.getMessage("flashcardAddedToDeck", [selectedDeck]));
                        modalContainer.remove(); // Remove the specific modal instance
                    })
                    .catch(error => {
                        console.log("Error adding note:", error);
                        showToast(chrome.i18n.getMessage("errorAddingFlashcard") + ": " + error.message);
                    });
            });
    
            globalShadowRoot.querySelector('#cancelButton').addEventListener('click', () => {
                showToast(chrome.i18n.getMessage("flashcardCreationCanceled"));
                modalContainer.remove(); // Remove the specific modal instance
            });
        });
    }
    
    /**
     * Sets up the refresh logo for regenerate buttons.
     */
    function setupRefreshLogo() {
        setTimeout(() => {
            const regenerateButtons = globalShadowRoot.querySelectorAll('#anki-lingo-flash-review-modal .regenerate-button');
    
            if (regenerateButtons.length === 0) {
                return;
            }
    
            const iconURL = chrome.runtime.getURL('icons/refresh_logo.svg');
            regenerateButtons.forEach(button => {
                button.style.backgroundImage = `url("${iconURL}")`;
                button.style.backgroundSize = '20px 20px';
                button.style.backgroundRepeat = 'no-repeat';
                button.style.backgroundPosition = 'center';
                button.style.display = 'inline-block';
                console.log('Refresh logo set for button:', button);
            });
        }, 0);
    }
    
    // Call this function after the Shadow DOM is created and whenever you create new regenerate buttons
    setupRefreshLogo();

    // Initialize translation popup functionality
    setupTextSelectionDetection();
    
    /**
     * Removes the toast notification from the DOM.
     */
    function removeToast() {
        const toast = document.querySelector('.toast');
        if (toast) {
            toast.remove();
        }
    }
    
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("Received message:", request);
        if (request.action === "updateFlashcardCount") {
            console.log('Flashcard count updated:', request.count);
            console.log('Remaining cards:', request.remainingCards);
    
            chrome.tabs.query({}, function (tabs) {
                for (var i = 0; i < tabs.length; ++i) {
                    chrome.tabs.sendMessage(tabs[i].id, {
                        action: "updateFlashcardCount",
                        count: request.count,
                        remainingCards: request.remainingCards
                    });
                }
            });
        }
        else if (request.action === "initialize") {
            console.log("Content script initialized and ready to receive messages.");
            sendResponse({ ready: true });
        }
        else if (request.action === "flashcardCreationCanceled") {
            showToast(chrome.i18n.getMessage("flashcardCreationCanceled"));
        } else if (request.action === "generateFlashcard") {
            console.log('Selected text:', request.text);
            // request.language should be an i18n key if sent from popup/context menu
            // If not, generateFlashcard will fall back to settings.language
            const requestedLanguageKey = request.language; 
    
            checkAuth((isAuthenticated) => {
                if (isAuthenticated) {
                    generateFlashcard(request.text, requestedLanguageKey);
                } else {
                    // Auth check already shows the appropriate error message via showToast
                    console.log("Authentication failed for flashcard generation");
                }
            });
        } else if (request.action === "showAnkiNotOpenModal") {
            showAnkiNotOpenModal(request.flashcard);
        } else if (request.action === "showToast") {
            showToast(request.message, request.keepOpen, request.ellipsis);
        }
    });
    
    // Helper function to check if a language is Arabic
    function isArabic(language) {
        return language === 'arabic_standard' || language === 'arabic_eg'; // 'arb' for Standard Arabic, 'arz' for Egyptian Arabic
    }

    function loadMnemonicToggleState() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['mnemonicToggleState'], function(result) {
                resolve(result.mnemonicToggleState !== false);  // Par défaut ON si non défini
            });
        });
    }
    
    function saveMnemonicToggleState(state) {
        chrome.storage.sync.set({ mnemonicToggleState: state });
    }
}
