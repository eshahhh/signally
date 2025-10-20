'use strict';

const sessionTimeDisplay = document.getElementById('session-time');
const statusDisplay = document.querySelector('.panel__status');
const transcriptionStream = document.getElementById('transcription-stream');
const summaryList = document.getElementById('summary-stream');
const followUpList = document.getElementById('followup-list');

const settingsBtn = document.getElementById('settings-btn');
const settingsSection = document.getElementById('settings-section');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key');
const cancelSettingsBtn = document.getElementById('cancel-settings');

let clockIntervalId = null;
let currentState = 'idle';
let settingsVisible = false;
let summaryLog = [];

function updateSessionClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    sessionTimeDisplay.textContent = `${hours}:${minutes}`;
}

function startClock() {
    updateSessionClock();
    if (clockIntervalId) {
        clearInterval(clockIntervalId);
    }
    clockIntervalId = window.setInterval(updateSessionClock, 60_000);
}

function updateStatusUI(state, details = {}) {
    console.log('[Popup] Updating UI - state:', state, 'details:', details);
    currentState = state;

    let statusText = '';

    switch (state) {
        case 'idle':
            statusText = 'Ready';
            break;
        case 'connecting':
            statusText = 'Connecting...';
            break;
        case 'recording':
            statusText = 'Recording';
            break;
        case 'stopping':
            statusText = 'Stopping...';
            break;
        case 'error':
            statusText = 'Error';
            break;
        default:
            statusText = 'Unknown';
    }

    if (statusDisplay) {
        statusDisplay.innerHTML = `${statusText} · <span id="session-time">${sessionTimeDisplay.textContent}</span>`;
        const newSessionTime = document.getElementById('session-time');
        if (newSessionTime) {
            sessionTimeDisplay.replaceWith(newSessionTime);
        }
    }

    console.log('[Popup] UI updated to:', statusText);
}

function updateTranscription(text, isComplete = false) {
    if (!transcriptionStream) {
        console.warn('[Popup] Transcription stream element not found');
        return;
    }

    console.log('[Popup] Updating transcription:', isComplete ? 'complete' : 'delta', text);

    if (isComplete) {
        const currentP = transcriptionStream.querySelector('.transcription-current');
        if (currentP) {
            currentP.remove();
        }

        const p = document.createElement('p');
        p.textContent = text;
        p.style.marginBottom = '0.5em';
        transcriptionStream.appendChild(p);

        transcriptionStream.scrollTop = transcriptionStream.scrollHeight;
    } else {
        let currentP = transcriptionStream.querySelector('.transcription-current');
        if (!currentP) {
            currentP = document.createElement('p');
            currentP.className = 'transcription-current';
            currentP.style.fontStyle = 'italic';
            currentP.style.color = '#94a3b8';
            transcriptionStream.appendChild(currentP);
        }
        currentP.textContent = text;

        transcriptionStream.scrollTop = transcriptionStream.scrollHeight;
    }
}

function handleTranscriptionDelta(data) {
    console.log('[Popup] Received transcription delta:', data.delta);
    updateTranscription(data.current, false);
}

function handleTranscriptionCompleted(data) {
    console.log('[Popup] Received completed transcription:', data.transcript);
    updateTranscription(data.transcript, true);
}

function handleSummaryGenerated(data) {
    if (!summaryList) {
        console.warn('[Popup] Summary list element not found');
        return;
    }

    console.log('[Popup] Received summary:', data.summary);

    // Add to summary log
    summaryLog.push({
        text: data.summary,
        timestamp: data.timestamp || Date.now()
    });

    const li = document.createElement('li');
    li.textContent = data.summary;
    li.style.marginBottom = '0.75em';
    li.style.paddingLeft = '1em';
    li.style.position = 'relative';

    const bullet = document.createElement('span');
    bullet.textContent = '•';
    bullet.style.position = 'absolute';
    bullet.style.left = '0';
    bullet.style.color = '#64748b';
    li.prepend(bullet);

    summaryList.appendChild(li);
    summaryList.scrollTop = summaryList.scrollHeight;
}

function handleFollowUpQuestions(data) {
    if (!followUpList) {
        console.warn('[Popup] Follow-up list element not found');
        return;
    }

    console.log('[Popup] Received follow-up questions:', data.questions);

    followUpList.innerHTML = '';

    data.questions.forEach((question, index) => {
        const li = document.createElement('li');
        li.textContent = question;
        li.style.marginBottom = '0.75em';
        li.style.paddingLeft = '0.5em';
        followUpList.appendChild(li);
    });

    followUpList.scrollTop = followUpList.scrollHeight;
}

async function initializeState() {
    console.log('[Popup] Requesting current transcription state...');
    try {
        const response = await chrome.runtime.sendMessage({ type: 'SIGNALLY_GET_STATE' });
        if (response && response.state) {
            console.log('[Popup] Received state:', response.state);
            updateStatusUI(response.state);
        }
    } catch (error) {
        console.error('[Popup] Failed to get state:', error);
    }

    await loadApiKeyStatus();
}

async function loadApiKeyStatus() {
    try {
        const result = await chrome.storage.sync.get(['openaiApiKey']);
        if (result.openaiApiKey) {
            apiKeyInput.value = '••••••••••••••••';
            console.log('[Popup] API key loaded (masked)');
        } else {
            console.log('[Popup] No API key found');
        }
    } catch (error) {
        console.error('[Popup] Error loading API key:', error);
    }
}

function toggleSettings() {
    settingsVisible = !settingsVisible;
    if (settingsVisible) {
        settingsSection.style.display = 'flex';
    } else {
        settingsSection.style.display = 'none';
    }
}

async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }

    if (apiKey === '••••••••••••••••') {
        console.log('[Popup] Masked value detected, not saving');
        toggleSettings();
        return;
    }

    try {
        await chrome.storage.sync.set({ openaiApiKey: apiKey });
        console.log('[Popup] API key saved successfully');

        chrome.runtime.sendMessage({ type: 'RELOAD_API_KEY' });

        apiKeyInput.value = '••••••••••••••••';

        alert('API key saved successfully!');
        toggleSettings();
    } catch (error) {
        console.error('[Popup] Error saving API key:', error);
        alert('Failed to save API key. Please try again.');
    }
}

function cancelSettings() {
    loadApiKeyStatus();
    toggleSettings();
}

async function startRecording() {
    try {
        const result = await chrome.storage.sync.get(['openaiApiKey']);
        if (!result.openaiApiKey) {
            alert('⚠️ Please set your OpenAI API key in Settings first!');
            toggleSettings();
            return;
        }
    } catch (error) {
        console.error('[Popup] Error checking API key:', error);
        alert('Error checking API key');
        return;
    }

    console.log('[Popup] Requesting to start recording...');

    summaryLog = [];
    if (summaryList) {
        summaryList.innerHTML = '';
    }
    if (transcriptionStream) {
        transcriptionStream.innerHTML = '';
    }
    if (followUpList) {
        followUpList.innerHTML = '';
    }

    chrome.runtime.sendMessage({
        type: 'START_RECORDING_REQUEST'
    }, (response) => {
        if (response?.success) {
            updateRecordingButtons(true);
        } else {
            alert(response?.error || 'Failed to start recording');
        }
    });
}

async function stopRecording() {
    console.log('[Popup] Requesting to stop recording...');

    chrome.runtime.sendMessage({
        type: 'STOP_RECORDING_REQUEST'
    }, (response) => {
        if (response?.success) {
            updateRecordingButtons(false);
        } else {
            alert(response?.error || 'Failed to stop recording');
        }
    });
}

function updateRecordingButtons(isRecording) {
    const startBtn = document.getElementById('start-record-btn');
    const stopBtn = document.getElementById('stop-record-btn');

    if (startBtn) {
        startBtn.disabled = isRecording;
    }
    if (stopBtn) {
        stopBtn.disabled = !isRecording;
    }
}

function exportSummary() {
    if (summaryLog.length === 0) {
        alert('No summary to export yet');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `signally-summary-${timestamp}.txt`;

    let content = 'Signally Session Summary\n';
    content += '========================\n\n';
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    content += 'Summary Points:\n';
    content += '---------------\n\n';

    summaryLog.forEach((item, index) => {
        content += `${index + 1}. ${item.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    console.log('[Popup] Summary exported successfully');
}

chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') {
        return;
    }

    console.log('[Popup] Received message:', message.type);

    switch (message.type) {
        case 'transcription-state-changed':
            updateStatusUI(message.state, message.details);

            if (message.state === 'recording') {
                updateRecordingButtons(true);
            } else if (message.state === 'idle' || message.state === 'error') {
                updateRecordingButtons(false);
            }

            if (message.state === 'error' && message.details?.message) {
                console.error('[Popup] Error:', message.details.message);
            }
            break;

        case 'transcription-delta':
            handleTranscriptionDelta(message.data);
            break;

        case 'transcription-completed':
            handleTranscriptionCompleted(message.data);
            break;

        case 'summary-generated':
            handleSummaryGenerated(message.data);
            break;

        case 'followup-questions-generated':
            handleFollowUpQuestions(message.data);
            break;

        case 'summary-error':
            console.error('[Popup] Summary error:', message.data?.message);
            break;

        default:
            console.log('[Popup] Unhandled message type:', message.type);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Popup] Popup loaded');
    startClock();
    initializeState();

    settingsBtn.addEventListener('click', toggleSettings);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    cancelSettingsBtn.addEventListener('click', cancelSettings);

    const startRecordBtn = document.getElementById('start-record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const exportBtn = document.getElementById('export-summary-btn');

    if (startRecordBtn) {
        startRecordBtn.addEventListener('click', startRecording);
    }

    if (stopRecordBtn) {
        stopRecordBtn.addEventListener('click', stopRecording);
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', exportSummary);
    }

    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveApiKey();
        }
    });

    apiKeyInput.addEventListener('focus', () => {
        if (apiKeyInput.value === '••••••••••••••••') {
            apiKeyInput.value = '';
        }
    });
});

console.log('[Popup] Signally popup script loaded');
