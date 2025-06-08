const DEV_MODE = false;

const AI_PROVIDERS = {
    OPENAI: 'openai',
    GOOGLE: 'google'
};

const elementsToTranslate = [
    { id: 'enterLearningGoal', key: 'enterLearningGoal' },
    { id: 'settingsTitle', key: 'settingsTitle', html: true },
    { id: 'aiModelToggle', key: 'aiModelToggle' },
    { id: 'chooseLanguage', key: 'chooseLanguage', html: true },
    { id: 'ownCreditsOrFreeTrial', key: 'ownCreditsOrFreeTrial', html: true },
    { id: 'enterOpenAIKey', key: 'enterOpenAIKey' },
    { id: 'validate', key: 'validate' },
    { id: 'chooseChatGPTModel', key: 'chooseChatGPTModel' },
    { id: 'pleaseSignIn', key: 'pleaseSignIn' },
    { id: 'signInWithGoogle', key: 'signInWithGoogle' },
    { id: 'notAvailableYet', key: 'notAvailableYet' },
    { id: 'welcome', key: 'welcome' },
    { id: 'loggedInMessage', key: 'loggedInMessage' },
    { id: 'freeFlashcardsLeft', key: 'freeFlashcardsLeft' },
    { id: 'signOut', key: 'signOut' },
    { id: 'local', key: 'local' },
    { id: 'remote', key: 'remote' },
    { id: 'ownCredits', key: 'ownCredits' },
    { id: 'freeTrial', key: 'freeTrial' },
    { id: 'updateNoticeTitle', key: 'updateNoticeTitle' },
    { id: 'updateNoticeChange1', key: 'updateNoticeChange1' },
    { id: 'updateNoticeChange2', key: 'updateNoticeChange2' },
    { id: 'installHyperTTS', key: 'installHyperTTS' },
    { id: 'addPronunciationGuide', key: 'addPronunciationGuide' },
    { id: 'selectAiProvider', key: 'selectAiProvider' },
    { id: 'openaiProvider', key: 'openaiProvider' },
    { id: 'googleProvider', key: 'googleProvider' },
    { id: 'apiKeyLabel', key: 'enterOpenAIKey' },
    { id: 'modelChoiceLabel', key: 'chooseChatGPTModel' }
];

/**
 * Translates elements in the UI based on their data-i18n attribute.
 */
function translateElements() {
    elementsToTranslate.forEach(item => {
      const elements = document.querySelectorAll(`[data-i18n="${item.key}"]`);
      console.log(`Translating ${item.key}, found ${elements.length} elements`);
      elements.forEach(element => {
        const message = chrome.i18n.getMessage(item.key);
        console.log(`Translation for ${item.key}: "${message}"`);
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = message;
            } else if (element.tagName === 'A') {
                element.textContent = message;
            } else if (item.html || message.includes('<')) {
                element.innerHTML = message;
            } else {
                element.textContent = message;
            }
        });
    });
}

/**
 * Shows an update notice with the latest version changes.
 * @param {string} version - The current version of the extension.
 */
function showUpdateNotice(version) {
    const notice = document.querySelector('#update-notice-container .update-notice');
    if (!notice) return;

    notice.style.display = 'block';

    // Update the title
    const titleElement = notice.querySelector('h3[data-i18n="updateNoticeTitle"]');
    if (titleElement) {
        titleElement.textContent = chrome.i18n.getMessage("updateNoticeTitle", [version]);
    }

    // Create and add the list of changes
    const changesList = document.createElement('ul');
    for (let i = 1; i <= 2; i++) {
        const li = document.createElement('li');
        li.setAttribute('data-i18n', `updateNoticeChange${i}`);
        changesList.appendChild(li);
    }
    notice.appendChild(changesList);

    // Create and add the close button
    const closeButton = document.createElement('button');
    closeButton.id = 'update-notice-close-button';
    closeButton.classList.add('close-notice', 'custom-close-button');
    closeButton.textContent = 'OK'; // Change the text of the button
    closeButton.onclick = function() {
        notice.style.display = 'none';
        chrome.storage.sync.set({ showUpdateNotice: false });
    }; 

    // Append the close button after all the content
    notice.appendChild(closeButton);

    // Call translateElements after creating all elements to apply translations
    translateElements();
}

// Wait for the DOM to be fully loaded before executing the main function
document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.sync.get(['showUpdateNotice', 'currentVersion'], function(result) {
        if (result.showUpdateNotice && result.currentVersion && result.currentVersion.startsWith('0.4.')) {
            showUpdateNotice(result.currentVersion);
        }
    });
    
    const popupContainer = document.getElementById('popup-container');
    if (popupContainer) {
        popupContainer.classList.add('fixed-width-popup');
    }

    loadLearningGoal();

    const learningGoalInput = document.getElementById('learningGoal');
    if (learningGoalInput) {
        learningGoalInput.addEventListener('change', saveLearningGoal);
    }

    const learningGoalHelp = document.getElementById('learningGoalHelp');
    if (learningGoalHelp) {
        learningGoalHelp.addEventListener('click', function(e) {
            e.preventDefault();
            chrome.tabs.create({ url: 'https://ankilingoflash.com/configure-ankilingoflash.html#learning-goal' });
        });
    }

    const apiKeyHelp = document.getElementById('apiKeyHelp');
    if (apiKeyHelp) {
        apiKeyHelp.addEventListener('click', function(e) {
        e.preventDefault(); // Empêche le comportement par défaut du clic
        chrome.tabs.create({ url: 'https://ankilingoflash.com/#pricing' });
        });
    }

    // Call the translation function
    translateElements();

    // Initialize various components and settings
    loadSavedLanguage();
    initializeToggleSwitches();
    addEventListeners();
    updateUserInfo();
    updateOptionsVisibility();
    addModelChoiceListener();
});

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
 * Get a localized sort function based on the given language.
 * @param {string} language - The language code.
 * @returns {Function} A comparison function for sorting.
 */
function getLocalizedSort(language) {
    // Map of language codes to their respective locales
    const languageCodes = {
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
        'persian': 'fa-IR' // Add Persian locale
    };

    const localeCode = languageCodes[language] || 'en-US';

    try {
        // Create and return a comparison function using Intl.Collator
        return new Intl.Collator(localeCode).compare;
    } catch (error) {
        console.warn(`Failed to create Collator for language ${language}. Falling back to default sort.`, error);
        // If Collator creation fails, return a simple string comparison function
        return (a, b) => a.localeCompare(b);
    }
}

/**
 * Generate language options for the dropdown.
 * @param {string} currentLanguage - The currently selected language.
 * @returns {Promise<string>} A promise that resolves to an HTML string of language options.
 */
async function generateLanguageOptions(currentLanguage) {
    return new Promise((resolve) => {
        chrome.i18n.getAcceptLanguages((languages) => {
            const sortFunction = getLocalizedSort(currentLanguage);

            const languageCodes = [
                'english_us',
                'english_uk',
                'english_au',
                'english_ca',
                'spanish_es',
                'spanish_latam',
                'french_fr',
                'french_ca',
                'german_de',
                'german_ch',
                'italian_it',
                'italian_ch',
                'dutch_nl',
                'dutch_be',
                'portuguese_pt',
                'portuguese_br',
                'russian',
                'mandarin_simplified',
                'mandarin_traditional',
                'cantonese',
                'japanese',
                'arabic_standard',
                'arabic_eg',
                'korean',
                'hindi',
                'persian'
            ];

            // Generate HTML options for each language, sorted by the localized name
            const languageOptions = languageCodes
                .map(code => ({
                    code,
                    name: chrome.i18n.getMessage(code) || code
                }))
                .sort((a, b) => sortFunction(a.name, b.name))
                .map(({ code, name }) =>
                    `<option value="${code}" ${currentLanguage === code ? 'selected' : ''}>${name}</option>`
                )
                .join('');

            resolve(languageOptions);
        });
    });
}

/**
 * Decrypt an API key.
 * @param {Object} encryptedData - The encrypted API key data.
 * @param {string} password - The password used for decryption.
 * @returns {Promise<string>} A promise that resolves with the decrypted API key.
 */
async function decryptApiKey(encryptedData, password) {
    const encoder = new TextEncoder();
    // Import the password as a key
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    // Derive a key using PBKDF2
    const derivedKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: new Uint8Array(encryptedData.salt), iterations: 100000, hash: "SHA-256" },
        key,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) },
        derivedKey,
        new Uint8Array(encryptedData.encrypted)
    );
    // Return the decrypted data as a string
    return new TextDecoder().decode(decrypted);
}

/**
 * Load the saved language and set up the language dropdown.
 */
async function loadSavedLanguage() {
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        chrome.storage.sync.get(['language'], async function (result) {
            let currentLanguage = result.language;
            if (!currentLanguage) {
                currentLanguage = navigator.language.replace('-', '_').toLowerCase();

                const browserToAppLanguage = {
                    'en': 'english_us',
                    'es': 'spanish_es',
                    'fr': 'french_fr',
                    'de': 'german_de',
                    'it': 'italian_it',
                    'nl': 'dutch_nl',
                    'pt': 'portuguese_pt',
                    'ru': 'russian',
                    'zh': 'mandarin_simplified',
                    'ja': 'japanese',
                    'ar': 'arabic_standard',
                    'ko': 'korean',
                    'hi': 'hindi',
                    'fa': 'persian' // Add Persian browser language mapping
                };
                console.log('a currentLanguage', currentLanguage);
                currentLanguage = browserToAppLanguage[currentLanguage.split('_')[0]] || 'english_us';
                console.log('b currentLanguage', currentLanguage);
            }
            // Generate language options and set the dropdown HTML
            const options = await generateLanguageOptions(currentLanguage);
            languageSelect.innerHTML = options;
            languageSelect.value = currentLanguage;
            // Save the current language
            chrome.storage.sync.set({ language: currentLanguage });
        });

        // Add event listener for language change
        languageSelect.addEventListener('change', function () {
            const selectedLanguage = this.value;
            chrome.storage.sync.set({ language: selectedLanguage }, function () {
                console.log('Language saved:', selectedLanguage);
                chrome.storage.sync.get(['language'], function (result) {
                    console.log('Language retrieved:', result.language);
                });
            });
        });
    }
}

/**
 * Initialize toggle switches and load saved settings.
 */
function initializeToggleSwitches() {
    const useOwnApiKeyToggle = document.getElementById('useOwnApiKeyToggle');
    const ownCreditsOption = document.getElementById('ownCreditsOption');
    const freeTrialOption = document.getElementById('freeTrialOption');
    const aiProviderSelect = document.getElementById('aiProviderSelect');

    if (useOwnApiKeyToggle && ownCreditsOption && freeTrialOption) {
        // Add event listener for API key toggle
        useOwnApiKeyToggle.addEventListener('change', function () {
            chrome.storage.sync.set({ isOwnCredits: this.checked }, function () {
                console.log('isOwnCredits saved:', this.checked);
                updateOptionsVisibility();
            });
        });
    }

    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', function() {
            const selectedProvider = this.value;
            chrome.storage.sync.set({ selectedProvider: selectedProvider }, function() {
                console.log('AI Provider saved:', selectedProvider);
                updateApiKeyLabel(selectedProvider);
                updateModelChoiceLabel(selectedProvider);
                // Reset API key validation status and input on provider change
                const apiKeyInput = document.getElementById('apiKey');
                if (apiKeyInput) {
                    apiKeyInput.value = '';
                    apiKeyInput.classList.remove('valid', 'invalid');
                    hideApiKeyError();
                }
                if (selectedProvider === AI_PROVIDERS.OPENAI) {
                    chrome.storage.sync.set({ apiKeyValidated: false, googleApiKeyValidated: false });
                } else {
                    chrome.storage.sync.set({ googleApiKeyValidated: false, apiKeyValidated: false });
                }
                updateOptionsVisibility(); // Re-check visibility, especially for model choice
                fetchModels(); // Attempt to fetch models for the new provider if key was previously validated for it
            });
        });
    }

    // Load saved settings and decrypt API key if available
    chrome.storage.sync.get(['isOwnCredits', 'selectedProvider', 'encryptedApiKey', 'installationPassword', 'encryptedGoogleApiKey'], async function (result) {
        if (useOwnApiKeyToggle) {
            useOwnApiKeyToggle.checked = result.isOwnCredits;
        }

        const currentProvider = result.selectedProvider || AI_PROVIDERS.OPENAI;
        if (aiProviderSelect) {
            aiProviderSelect.value = currentProvider;
        }
        updateApiKeyLabel(currentProvider);
        updateModelChoiceLabel(currentProvider);


        const apiKeyField = document.getElementById('apiKey');
        if (apiKeyField && result.installationPassword) {
            let encryptedKeyToUse;
            if (currentProvider === AI_PROVIDERS.OPENAI && result.encryptedApiKey) {
                encryptedKeyToUse = result.encryptedApiKey;
            } else if (currentProvider === AI_PROVIDERS.GOOGLE && result.encryptedGoogleApiKey) {
                encryptedKeyToUse = result.encryptedGoogleApiKey;
            }

            if (encryptedKeyToUse) {
                try {
                    const decryptedApiKey = await decryptApiKey(encryptedKeyToUse, result.installationPassword);
                    apiKeyField.value = decryptedApiKey;
                } catch (decryptError) {
                    console.log(chrome.i18n.getMessage("failedToDecryptApiKey"), decryptError);
                    apiKeyField.value = '';
                }
            }
        }
        updateOptionsVisibility();
    });
}

/**
 * Add event listeners to various elements.
 */
function addEventListeners() {
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const validateApiKey = document.getElementById('validateApiKey');

    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    if (validateApiKey) {
        validateApiKey.addEventListener('click', handleValidateApiKey);
    }
}


/**
 * Handle API key validation.
 */
async function handleValidateApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    const apiKey = apiKeyInput.value.trim();
    const selectedProvider = document.getElementById('aiProviderSelect').value;

    if (!apiKey) {
        showApiKeyError(selectedProvider === AI_PROVIDERS.GOOGLE ? "enterGoogleApiKey" : "enterOpenAIKey");
        return;
    }

    const action = selectedProvider === AI_PROVIDERS.GOOGLE ? "validateGoogleApiKey" : "validateApiKey";

    // Show some loading state on the button if desired
    const validateButton = document.getElementById('validateApiKey');
    const originalButtonText = validateButton.textContent;
    validateButton.textContent = chrome.i18n.getMessage("validating") + "...";
    validateButton.disabled = true;

    chrome.runtime.sendMessage({ action: action, apiKey: apiKey }, async function (response) {
        validateButton.textContent = originalButtonText; // Restore button text
        validateButton.disabled = false; // Re-enable button

        if (chrome.runtime.lastError) {
            console.error(`Error during API key validation: ${chrome.runtime.lastError.message}`);
            showApiKeyError(chrome.i18n.getMessage("genericError")); // Use a generic error
            return;
        }

        if (response && response.valid) {
            apiKeyInput.classList.remove('invalid');
            apiKeyInput.classList.add('valid');
            hideApiKeyError();

            try {
                const installationPassword = await generateInstallationPassword();
                const encryptedApiKey = await encryptApiKey(apiKey, installationPassword);

                const storageUpdate = {
                    isOwnCredits: true,
                    installationPassword: installationPassword
                };

                if (selectedProvider === AI_PROVIDERS.GOOGLE) {
                    storageUpdate.encryptedGoogleApiKey = encryptedApiKey;
                    storageUpdate.encryptedApiKey = null; // Clear OpenAI key
                    storageUpdate.googleApiKeyValidated = true;
                    storageUpdate.apiKeyValidated = false; // Set OpenAI as not validated
                    storageUpdate.model = null; // Clear any selected OpenAI model
                } else { // OpenAI
                    storageUpdate.encryptedApiKey = encryptedApiKey;
                    storageUpdate.encryptedGoogleApiKey = null; // Clear Google key
                    storageUpdate.apiKeyValidated = true;
                    storageUpdate.googleApiKeyValidated = false; // Set Google as not validated
                    storageUpdate.googleModel = null; // Clear any selected Google model
                }

                chrome.storage.sync.set(storageUpdate, function () {
                    if (chrome.runtime.lastError) {
                        console.error("Error setting storage after API key validation:", chrome.runtime.lastError.message);
                        showApiKeyError(chrome.i18n.getMessage("genericError"));
                        return;
                    }
                    console.log(`API key for ${selectedProvider} validated and stored successfully`);
                    updateOptionsVisibility(); // This will re-read storage
                    fetchModels(apiKey, selectedProvider); // Fetch models for the now-validated provider
                });
            } catch (error) {
                console.error("Error encrypting or preparing API key for storage:", error);
                showApiKeyError(chrome.i18n.getMessage("genericError"));
            }

        } else {
            const errorMessageKey = selectedProvider === AI_PROVIDERS.GOOGLE ?
                "errorValidatingGoogleApiKey" :
                "errorValidatingApiKey";
            // Always use a predefined, localized message for the user.
            const displayMessage = chrome.i18n.getMessage(errorMessageKey);

            showApiKeyError(displayMessage, true); // displayMessage is already translated by getMessage
            apiKeyInput.classList.add('invalid');
            apiKeyInput.classList.remove('valid');
            // Ensure the correct validation status is false in storage if validation fails
            const failedValidationUpdate = {};
            if (selectedProvider === AI_PROVIDERS.GOOGLE) {
                failedValidationUpdate.googleApiKeyValidated = false;
            } else {
                failedValidationUpdate.apiKeyValidated = false;
            }
            chrome.storage.sync.set(failedValidationUpdate);
        }
    });
}

/**
 * Update user information in the UI.
 * @param {Object} user - The user object containing user information.
 * @param {number} flashcardCount - The number of flashcards created.
 * @param {number} freeGenerationLimit - The limit of free flashcard generations.
 */
function updateUserInfo(user = null, flashcardCount = 0, freeGenerationLimit) {
    const userInfo = document.getElementById('user-info');

    chrome.storage.sync.get(['isOwnCredits', 'freeGenerationLimit', 'userName', 'userEmail', 'selectedProvider'], function (result) {
        const isOwnCreditsMode = result.isOwnCredits;
        const limit = freeGenerationLimit || result.freeGenerationLimit;
        const currentProvider = result.selectedProvider || AI_PROVIDERS.OPENAI;

        if (user && !isOwnCreditsMode) {
            if (userInfo) {
                // Display user information if a user is logged in and not using own credits
                userInfo.style.display = 'block';
                userInfo.innerHTML = `
                    <h2>${chrome.i18n.getMessage("welcome")} ${escapeHTML(result.userName || user.name)}!</h2>
                    <p>${chrome.i18n.getMessage("loggedInMessage")}</p>
                    <p>Email: ${escapeHTML(result.userEmail || user.email)}</p>
                    <p id="flashcard-counter">${chrome.i18n.getMessage("freeFlashcardsLeft")} <span id="flashcard-count">${limit - flashcardCount}</span></p>
                    <button id="logout-button" class="btn">${chrome.i18n.getMessage("signOut")}</button>
                `;
                document.getElementById('logout-button').addEventListener('click', handleLogout);
            }
        } else {
            // Hide user information if no user is logged in or using own credits
            if (userInfo) userInfo.style.display = 'none';
        }
    });
}

/**
 * Update the login button in the UI.
 * @param {HTMLElement} container - The container element for the login button.
 */
function updateLoginButton(container) {
    if (!container.querySelector('#login-button')) {
        // Create login button if it doesn't exist
        container.innerHTML = `
            <p>${chrome.i18n.getMessage('pleaseSignIn')}</p>
            <button id="login-button" class="gsi-material-button">
                <div class="gsi-material-button-state"></div>
                <div class="gsi-material-button-content-wrapper">
                    <div class="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: block;">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                    </div>
                    <span class="gsi-material-button-contents">${chrome.i18n.getMessage('signInWithGoogle')}</span>
                    <span style="display: none;">${chrome.i18n.getMessage('signInWithGoogle')}</span>
                </div>
            </button>
        `;
        document.getElementById('login-button').addEventListener('click', handleLogin);
    }
}

/**
 * Checks the internet connection by making a request to a specific endpoint.
 * @returns {Promise<boolean>} A promise that resolves to true if online, rejects with false otherwise.
 */
function checkInternetConnection() {
    return new Promise((resolve, reject) => {
      fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/check-connectivity')
        .then(response => response.json())
        .then(data => {
          if (data.status === 'online') {
            resolve(true);
          } else {
            reject(false);
          }
        })
        .catch(() => {
          reject(false);
        });
    });
  }

/**
 * Show API key error message.
 * @param {string} message - The error message to display.
 */
function showApiKeyError(messageKeyOrMessage, isPreTranslated = false) {
    const apiKeyInput = document.getElementById('apiKey');
    const errorElement = document.getElementById('apiKeyError');
    if (errorElement) {
        errorElement.textContent = isPreTranslated ? messageKeyOrMessage : chrome.i18n.getMessage(messageKeyOrMessage);
        errorElement.style.display = 'block';
    }
    if (apiKeyInput) {
        apiKeyInput.classList.add('invalid');
        apiKeyInput.classList.remove('valid');
    }
}

/**
 * Hide API key error message.
 */
function hideApiKeyError() {
    const apiKeyInput = document.getElementById('apiKey');
    const errorElement = document.getElementById('apiKeyError');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    if (apiKeyInput) {
        apiKeyInput.classList.remove('invalid');
    }
}

/**
 * Update the model choice dropdown.
 * @param {string[]} models - Array of available model names.
 */
function updateModelChoice(models, provider) {
    if (!Array.isArray(models)) {
        console.log(chrome.i18n.getMessage(provider === AI_PROVIDERS.GOOGLE ? "noGoogleModelsFound" : "noGptModelsFound"), models);
        return;
    }

    let filteredModels = [];
    if (provider === AI_PROVIDERS.GOOGLE) {
        // Google models usually start with "models/gemini-" or "gemini-"
        filteredModels = models.filter(model => typeof model === 'string' && (model.startsWith('models/gemini-') || model.startsWith('gemini-')));
    } else {
        // Filter models to only include GPT models for OpenAI
        filteredModels = models.filter(model => typeof model === 'string' && model.startsWith('gpt-'));
    }

    if (filteredModels.length === 0) {
        console.warn(chrome.i18n.getMessage(provider === AI_PROVIDERS.GOOGLE ? "noGoogleModelsFound" : "noGptModelsFound"));
        const modelChoice = document.getElementById('modelChoice');
        if (modelChoice) modelChoice.innerHTML = `<option value="">${chrome.i18n.getMessage("noModelsAvailable")}</option>`;
        return;
    }

    const modelChoice = document.getElementById('modelChoice');
    if (modelChoice) {
        const currentValue = modelChoice.value;
        // Populate the dropdown with filtered models
        modelChoice.innerHTML = filteredModels.map(model => {
            // For Google, display name might be preferable if available, but model ID is needed for value
            const displayName = model.startsWith('models/') ? model.substring(model.lastIndexOf('/') + 1) : model;
            return `<option value="${model}">${displayName}</option>`;
        }).join('');

        // Set the selected model based on stored preference or default
        const storageKey = provider === AI_PROVIDERS.GOOGLE ? 'googleModel' : 'model';
        chrome.storage.sync.get([storageKey], function (result) {
            const savedModel = result[storageKey];
            if (savedModel && filteredModels.includes(savedModel)) {
                modelChoice.value = savedModel;
            } else if (currentValue && filteredModels.includes(currentValue)) {
                modelChoice.value = currentValue;
            } else if (filteredModels.length > 0) {
                modelChoice.value = filteredModels[0];
                chrome.storage.sync.set({ [storageKey]: filteredModels[0] });
            }
        });
    }
}

/**
 * Send a request to fetch available models.
 * @param {string} apiKey - The API key to use for fetching models.
 * @param {string} provider - The AI provider ('openai' or 'google').
 */
function sendFetchModelsRequest(apiKey, provider) {
    const action = provider === AI_PROVIDERS.GOOGLE ? "fetchGoogleModels" : "fetchModels";
    chrome.runtime.sendMessage({
        action: action,
        apiKey: apiKey
    }, function (response) {
        if (response.error) {
            console.log(chrome.i18n.getMessage(provider === AI_PROVIDERS.GOOGLE ? "errorFetchingGoogleModels" : "errorFetchingModels"), response.error);
            updateModelChoice([], provider); // Clear models on error
        } else {
            updateModelChoice(response.models, provider);
        }
    });
}

/**
 * Fetch available models based on user settings.
 * @param {string} apiKey - The API key to use for fetching models.
 * @param {string} provider - The AI provider ('openai' or 'google'). If not provided, it's read from storage.
 */
function fetchModels(apiKey, provider) {
    chrome.storage.sync.get(['isOwnCredits', 'selectedProvider'], function (result) {
        const currentProvider = provider || result.selectedProvider || AI_PROVIDERS.OPENAI;

        if (result.isOwnCredits) {
            if (!apiKey) {
                const encryptedKeyName = currentProvider === AI_PROVIDERS.GOOGLE ? 'encryptedGoogleApiKey' : 'encryptedApiKey';
                chrome.storage.sync.get([encryptedKeyName, 'installationPassword'], async function (keyResult) {
                    if (keyResult[encryptedKeyName] && keyResult.installationPassword) {
                        try {
                            const decryptedApiKey = await decryptApiKey(keyResult[encryptedKeyName], keyResult.installationPassword);
                            sendFetchModelsRequest(decryptedApiKey, currentProvider);
                        } catch (error) {
                            console.log(`Error decrypting API key for ${currentProvider}:`, error);
                        }
                    } else {
                        console.log(chrome.i18n.getMessage(currentProvider === AI_PROVIDERS.GOOGLE ? "googleApiKeyMissing" : "apiKeyMissing"));
                    }
                });
            } else {
                sendFetchModelsRequest(apiKey, currentProvider);
            }
        } else {
            // If not using own credits, fetch models from the extension's API (currently OpenAI specific)
            // This part might need adjustment if free tier should support Google in the future via your worker
            if (currentProvider === AI_PROVIDERS.OPENAI) {
                fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/models')
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            console.log(chrome.i18n.getMessage("errorFetchingModels"), data.error);
                            updateModelChoice([], AI_PROVIDERS.OPENAI);
                        } else {
                            updateModelChoice(data.result, AI_PROVIDERS.OPENAI);
                        }
                    })
                    .catch(error => {
                        console.log(chrome.i18n.getMessage("errorFetchingModels"), error);
                        updateModelChoice([], AI_PROVIDERS.OPENAI);
                    });
            } else {
                // For Google on free tier, currently no backend support, so clear models
                updateModelChoice([], AI_PROVIDERS.GOOGLE);
                console.log("Google models not available for free trial via this extension's backend yet.");
            }
        }
    });
}

// Variable to store the current toast notification
let creationToast;

/**
 * Show a toast notification.
 * @param {string} message - The message to display in the toast.
 * @param {boolean} keepOpen - Whether to keep the toast open indefinitely.
 * @param {boolean} ellipsis - Whether to show an ellipsis animation in the toast.
 */
function showToast(message, keepOpen = false, ellipsis = false) {
    let toastContainer = document.querySelector('#toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = chrome.i18n.getMessage(message);

    if (ellipsis) {
        const ellipsisSpan = document.createElement('span');
        ellipsisSpan.className = 'ellipsis';
        toast.appendChild(ellipsisSpan);
    }

    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    if (!keepOpen) {
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 500);
        }, 3000);
    } else {
        creationToast = toast;
    }
}

/**
 * Add event listener for model choice changes.
 */
function addModelChoiceListener() {
    const modelChoice = document.getElementById('modelChoice');
    if (modelChoice) {
        modelChoice.addEventListener('change', function () {
            const selectedProvider = document.getElementById('aiProviderSelect').value;
            const storageKey = selectedProvider === AI_PROVIDERS.GOOGLE ? 'googleModel' : 'model';
            chrome.storage.sync.set({ [storageKey]: this.value }, function () {
                console.log(`Model choice for ${selectedProvider} saved:`, this.value);
            });
        });
    }
}

// Event listener for messages from the background script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "updateFlashcardCount") {
        updateFlashcardCounter(request.count, request.remainingCards);
    }
});

/**
 * Generate a random installation password.
 * @returns {Promise<string>} A promise that resolves to a random installation password.
 */
async function generateInstallationPassword() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Encrypt the API key.
 * @param {string} apiKey - The API key to encrypt.
 * @param {string} password - The password to use for encryption.
 * @returns {Promise<Object>} A promise that resolves to an object containing the encrypted data.
 */
async function encryptApiKey(apiKey, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        key,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        derivedKey,
        data
    );
    return {
        salt: Array.from(salt),
        iv: Array.from(iv),
        encrypted: Array.from(new Uint8Array(encrypted))
    };
}

/**
 * Update the flashcard counter in the UI.
 * @param {number} count - The new flashcard count.
 * @param {number} remainingCards - The number of remaining cards.
 */
function updateFlashcardCounter(count, remainingCards) {
    const flashcardCountElement = document.getElementById('flashcard-count');
    if (flashcardCountElement) {
        flashcardCountElement.textContent = remainingCards - count;
    }
}

/**
 * Updates the visibility of various UI options based on user settings.
 */
function updateOptionsVisibility() {
    chrome.storage.sync.get([
        'user', 'apiKeyValidated', 'googleApiKeyValidated', 'choice', 
        'isOwnCredits', 'flashcardCount', 'selectedProvider'
    ], function (result) {
        const modelToggleContainer = document.querySelector('.form-group:has(#modelToggle)');
        const remoteSettings = document.getElementById('remoteSettings');
        const useOwnApiKeyToggle = document.getElementById('useOwnApiKeyToggle');
        const ownCreditsOption = document.getElementById('ownCreditsOption');
        const freeTrialOption = document.getElementById('freeTrialOption');
        const userInfo = document.getElementById('user-info');
        const modelChoiceSection = document.getElementById('modelChoiceSection');
        const localModelMessage = document.getElementById('localModelMessage');
        const aiProviderSection = document.getElementById('aiProviderSection');
        const apiKeyEntrySection = document.getElementById('apiKeyEntrySection');

        // Hide model toggle container (AI model remote/local)
        if (modelToggleContainer) modelToggleContainer.style.display = 'none';

        const isRemoteMode = result.choice === 'remote'; // This seems to be legacy, assuming always remote for now
        const isOwnCreditsMode = result.isOwnCredits;
        const currentProvider = result.selectedProvider || AI_PROVIDERS.OPENAI;

        // Update UI based on remote/local mode (assuming remote for now)
        // if (modelToggle) modelToggle.checked = isRemoteMode;
        if (remoteSettings) remoteSettings.style.display = 'block'; // Always show remote settings
        if (localModelMessage) localModelMessage.style.display = 'none'; // Hide local message

        // Update UI for remote mode
        if (useOwnApiKeyToggle) useOwnApiKeyToggle.checked = isOwnCreditsMode;
        if (ownCreditsOption) ownCreditsOption.style.display = 'block'; // Always show ownCreditsOption container

        if (aiProviderSection) {
            aiProviderSection.style.display = isOwnCreditsMode ? 'block' : 'none';
        }
        if (apiKeyEntrySection) {
            apiKeyEntrySection.style.display = isOwnCreditsMode ? 'block' : 'none';
        }

        if (isOwnCreditsMode) {
            // Settings for users using their own API key
            if (freeTrialOption) freeTrialOption.style.display = 'none';
            if (userInfo) userInfo.style.display = 'none';

            const apiKeyIsValidForCurrentProvider = (currentProvider === AI_PROVIDERS.GOOGLE && result.googleApiKeyValidated) ||
                                                 (currentProvider === AI_PROVIDERS.OPENAI && result.apiKeyValidated);

            if (modelChoiceSection) {
                const wasHidden = modelChoiceSection.style.display === 'none';
                modelChoiceSection.style.display = apiKeyIsValidForCurrentProvider ? 'block' : 'none';
                if (wasHidden && apiKeyIsValidForCurrentProvider) {
                    fetchModels(null, currentProvider); // Pass currentProvider
                } else if (!apiKeyIsValidForCurrentProvider) {
                    modelChoiceSection.style.display = 'none'; // Ensure it's hidden if key not valid
                }
            }
        } else {
            // Settings for users not using their own API key (Free Trial / Extension's API)
            if (aiProviderSection) aiProviderSection.style.display = 'none'; // Hide provider choice for free trial
            if (modelChoiceSection) modelChoiceSection.style.display = 'none'; // Hide model choice for free trial initially

            if (result.user) { // Logged in for free trial
                if (freeTrialOption) freeTrialOption.style.display = 'none';
                if (userInfo) userInfo.style.display = 'block';
                // For free trial, models are fetched from our backend, currently OpenAI
                // If you want to show models for free trial:
                // modelChoiceSection.style.display = 'block';
                // fetchModels(null, AI_PROVIDERS.OPENAI); // Or whatever provider free trial uses
            } else { // Not logged in
                if (freeTrialOption) {
                    freeTrialOption.style.display = 'block';
                    updateLoginButton(freeTrialOption);
                }
                if (userInfo) userInfo.style.display = 'none';
            }
        }

        // Update user info display
        updateUserInfo(result.user, result.flashcardCount, result.freeGenerationLimit);
    });
}

/**
 * Updates the API key input label based on the selected provider.
 * @param {string} provider - The selected AI provider ('openai' or 'google').
 */
function updateApiKeyLabel(provider) {
    const apiKeyLabel = document.getElementById('apiKeyLabel');
    if (apiKeyLabel) {
        const key = provider === AI_PROVIDERS.GOOGLE ? 'enterGoogleApiKey' : 'enterOpenAIKey';
        apiKeyLabel.textContent = chrome.i18n.getMessage(key);
        apiKeyLabel.setAttribute('data-i18n', key); // For consistency if translateElements is called again
    }
}

/**
 * Updates the model choice label based on the selected provider.
 * @param {string} provider - The selected AI provider ('openai' or 'google').
 */
function updateModelChoiceLabel(provider) {
    const modelChoiceLabel = document.getElementById('modelChoiceLabel');
    if (modelChoiceLabel) {
        const key = provider === AI_PROVIDERS.GOOGLE ? 'chooseGoogleModel' : 'chooseChatGPTModel';
        modelChoiceLabel.textContent = chrome.i18n.getMessage(key);
        modelChoiceLabel.setAttribute('data-i18n', key);
    }
}

/**
 * Initialize the popup by setting up all necessary components and event listeners.
 */
function initializePopup() {
    loadSavedLanguage();
    initializeToggleSwitches();
    addEventListeners();
    updateUserInfo();
    updateOptionsVisibility(); 
    addModelChoiceListener();
}

/**
 * Saves the current learning goal to storage when it changes.
 */
function saveLearningGoal() {
    const learningGoal = document.getElementById('learningGoal').value;
    chrome.storage.sync.set({ learningGoal: learningGoal }, function() {
        console.log('Learning goal saved:', learningGoal);
    });
}

/**
 * Loads the saved learning goal from storage and sets it in the UI.
 */
function loadLearningGoal() {
    chrome.storage.sync.get(['learningGoal'], function(result) {
        if (result.learningGoal) {
            document.getElementById('learningGoal').value = result.learningGoal;
        }
    });
}

// Event listener for when the DOM content is loaded
document.addEventListener('DOMContentLoaded', initializePopup); 