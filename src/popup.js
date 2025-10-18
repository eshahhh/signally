'use strict';

const sessionTimeDisplay = document.getElementById('session-time');
const statusDisplay = document.querySelector('.panel__status');
const transcriptionStream = document.getElementById('transcription-stream');

let clockIntervalId = null;
let currentState = 'idle';

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
}

chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') {
        return;
    }

    console.log('[Popup] Received message:', message.type);

    switch (message.type) {
        case 'transcription-state-changed':
            updateStatusUI(message.state, message.details);
            break;

        case 'transcription-delta':
            if (message.data) {
                handleTranscriptionDelta(message.data);
            }
            break;

        case 'transcription-completed':
            if (message.data) {
                handleTranscriptionCompleted(message.data);
            }
            break;

        default:
            console.log('[Popup] Unhandled message type:', message.type);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Popup] Popup loaded');
    startClock();
    initializeState();
});

console.log('[Popup] Signally popup script loaded');
