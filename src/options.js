'use strict';

const apiKeyInput = document.getElementById('api-key');
const saveButton = document.getElementById('save-btn');
const clearButton = document.getElementById('clear-btn');
const statusMessage = document.getElementById('status-message');

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
    statusMessage.style.display = 'block';

    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}

async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['openaiApiKey']);
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('Failed to load settings', true);
    }
}

async function saveSettings() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showStatus('Please enter an API key', true);
        return;
    }

    if (!apiKey.startsWith('sk-')) {
        showStatus('Invalid API key format. OpenAI keys start with "sk-"', true);
        return;
    }

    try {
        await chrome.storage.sync.set({ openaiApiKey: apiKey });
        showStatus('Settings saved successfully!');
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Failed to save settings', true);
    }
}

async function clearSettings() {
    try {
        await chrome.storage.sync.remove(['openaiApiKey']);
        apiKeyInput.value = '';
        showStatus('API key cleared successfully!');
    } catch (error) {
        console.error('Error clearing settings:', error);
        showStatus('Failed to clear settings', true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    saveButton?.addEventListener('click', saveSettings);
    clearButton?.addEventListener('click', clearSettings);

    apiKeyInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveSettings();
        }
    });
});
