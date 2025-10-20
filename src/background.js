'use strict';

import Summarizer from './summarizer.js';

const TOKEN_SERVER_URL = 'http://localhost:3000/token';

let signallyWindowId = null;
let transcriptionState = 'idle';
let activeTabId = null;

let offscreenDocumentExists = false;
let isTranscribing = false;

let currentTranscript = '';
let transcriptionBuffer = [];

let summarizer = null;

function initializeSummarizer() {
    if (!summarizer) {
        summarizer = new Summarizer();
        console.log('[Background] Summarizer initialized');
    }
    return summarizer;
}

function broadcastTranscriptionState(state, details = {}) {
    transcriptionState = state;

    const message = {
        type: 'transcription-state-changed',
        state: state,
        details: details,
        timestamp: Date.now()
    };

    if (signallyWindowId) {
        chrome.runtime.sendMessage(message).catch(() => { });
    }

    if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, message).catch(() => { });
    }
}

async function ensureOffscreenDocument() {
    if (offscreenDocumentExists) {
        return true;
    }

    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
        offscreenDocumentExists = true;
        return true;
    }

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Capture and transcribe tab audio using OpenAI Realtime API'
    });

    offscreenDocumentExists = true;
    return true;
}

async function startTranscription(tabId) {
    if (isTranscribing) {
        return;
    }

    try {
        const result = await chrome.storage.sync.get(['openaiApiKey']);
        if (!result.openaiApiKey) {
            broadcastTranscriptionState('error', {
                message: 'OpenAI API key not set. Please configure it in Settings.'
            });
            return;
        }
    } catch (error) {
        broadcastTranscriptionState('error', {
            message: 'Failed to check API key. Please try again.'
        });
        return;
    }

    broadcastTranscriptionState('connecting', { message: 'Connecting...' });

    try {
        await ensureOffscreenDocument();

        const ephemeralKey = await fetchEphemeralToken();

        const streamId = await chrome.tabCapture.getMediaStreamId({
            targetTabId: tabId
        });

        const response = await chrome.runtime.sendMessage({
            type: 'start-webrtc',
            streamId: streamId,
            ephemeralKey: ephemeralKey
        });

        if (response.success) {
            isTranscribing = true;
            broadcastTranscriptionState('recording', { message: 'Recording tab audio...' });
        } else {
            throw new Error(response.error || 'Failed to start WebRTC in offscreen document');
        }

    } catch (error) {
        broadcastTranscriptionState('error', { message: error.message });
    }
}

async function stopTranscription() {
    if (offscreenDocumentExists) {
        try {
            await chrome.runtime.sendMessage({ type: 'stop-webrtc' });
        } catch (error) { }
    }

    isTranscribing = false;
    currentTranscript = '';
    transcriptionBuffer = [];

    if (summarizer) {
        summarizer.reset();
        console.log('[Background] Summarizer reset for next session');
    }

    broadcastTranscriptionState('idle', { message: 'Ready to record' });
}

async function fetchEphemeralToken() {
    const response = await fetch(TOKEN_SERVER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Token server error: ${response.status}`;
        throw new Error(errorMsg);
    }

    const data = await response.json();

    if (!data.value) {
        throw new Error('Invalid token response from server');
    }

    return data.value;
}

function handleServerEvent(event) {
    switch (event.type) {
        case 'session.created':
            break;

        case 'conversation.item.input_audio_transcription.delta':
            handleTranscriptionDelta(event);
            break;

        case 'conversation.item.input_audio_transcription.completed':
            handleTranscriptionCompleted(event);
            break;

        case 'input_audio_buffer.committed':
            break;

        case 'error':
            broadcastTranscriptionState('error', {
                message: event.error?.message || 'Unknown server error'
            });
            break;

        default:
            break;
    }
}

function handleTranscriptionDelta(event) {
    const delta = event.delta || '';
    currentTranscript += delta;

    const message = {
        type: 'transcription-delta',
        data: {
            delta: delta,
            current: currentTranscript,
            itemId: event.item_id
        }
    };

    if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, message).catch(() => { });
    }

    if (signallyWindowId) {
        chrome.runtime.sendMessage(message).catch(() => { });
    }
}

function handleTranscriptionCompleted(event) {
    const transcript = event.transcript || '';

    console.log('[Background] ===== Transcription Completed =====');
    console.log('[Background] Item ID:', event.item_id);
    console.log('[Background] Transcript:', transcript);
    console.log('[Background] Transcript length:', transcript.length);
    console.log('[Background] ========================================');

    transcriptionBuffer.push({
        itemId: event.item_id,
        transcript: transcript,
        timestamp: Date.now()
    });

    const message = {
        type: 'transcription-completed',
        data: {
            transcript: transcript,
            itemId: event.item_id,
            timestamp: Date.now()
        }
    };

    if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, message).catch(() => { });
    }

    if (signallyWindowId) {
        chrome.runtime.sendMessage(message).catch(() => { });
    }

    currentTranscript = '';

    const sum = initializeSummarizer();
    const shouldSummarize = sum.addTranscription(transcript);

    console.log('[Background] Should summarize?', shouldSummarize);
    console.log('[Background] Buffer size:', transcriptionBuffer.length);

    if (shouldSummarize) {
        console.log('[Background] Generating summary...');
        generateAndBroadcastSummary();
    }
}

async function generateAndBroadcastSummary() {
    const sum = initializeSummarizer();

    try {
        console.log('[Background] Starting summary generation...');
        const result = await sum.generateSummary();

        if (!result) {
            console.warn('[Background] Failed to generate summary - no result returned');

            const errorMessage = {
                type: 'summary-error',
                data: {
                    message: 'Failed to generate summary. The API may be overloaded or the request was too large.',
                    timestamp: Date.now()
                }
            };

            if (activeTabId) {
                chrome.tabs.sendMessage(activeTabId, errorMessage).catch(() => { });
            }

            if (signallyWindowId) {
                chrome.runtime.sendMessage(errorMessage).catch(() => { });
            }

            return;
        }

        console.log('[Background] Summary generated:', result.summary);
        console.log('[Background] Follow-up questions:', result.followUpQuestions);

        const summaryMessage = {
            type: 'summary-generated',
            data: {
                summary: result.summary,
                timestamp: Date.now()
            }
        };

        if (activeTabId) {
            chrome.tabs.sendMessage(activeTabId, summaryMessage).catch(() => { });
        }

        if (signallyWindowId) {
            chrome.runtime.sendMessage(summaryMessage).catch(() => { });
        }

        const followUpMessage = {
            type: 'followup-questions-generated',
            data: {
                questions: result.followUpQuestions,
                timestamp: Date.now()
            }
        };

        if (activeTabId) {
            chrome.tabs.sendMessage(activeTabId, followUpMessage).catch(() => { });
        }

        if (signallyWindowId) {
            chrome.runtime.sendMessage(followUpMessage).catch(() => { });
        }

    } catch (error) {
        console.error('[Background] Error generating summary:', error);

        const errorMessage = {
            type: 'summary-error',
            data: {
                message: `Summary generation error: ${error.message}`,
                timestamp: Date.now()
            }
        };

        if (activeTabId) {
            chrome.tabs.sendMessage(activeTabId, errorMessage).catch(() => { });
        }

        if (signallyWindowId) {
            chrome.runtime.sendMessage(errorMessage).catch(() => { });
        }
    }
}

async function ensureSignallyWindow() {
    if (signallyWindowId) {
        try {
            await chrome.windows.update(signallyWindowId, { focused: true });
            return;
        } catch (err) {
            signallyWindowId = null;
        }
    }

    const created = await chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 420,
        height: 820,
        focused: true
    });
    signallyWindowId = created.id ?? null;
}

chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id || !tab.url) {
        return;
    }

    const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'edge-extension:'];
    if (restrictedProtocols.some(proto => tab.url.startsWith(proto))) {
        return;
    }

    await injectAndToggleOverlay(tab.id);
});

async function injectAndToggleOverlay(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, { type: 'SIGNALLY_TOGGLE_OVERLAY' });
    } catch (err) {
        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['overlay.css']
            });
        } catch (cssErr) {
            return;
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['contentScript.js']
            });

            setTimeout(async () => {
                try {
                    await chrome.tabs.sendMessage(tabId, { type: 'SIGNALLY_TOGGLE_OVERLAY' });
                } catch (toggleErr) { }
            }, 100);
        } catch (injectErr) { }
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
        return;
    }

    if (message.type === 'offscreen-webrtc-ready') {
        return;
    }

    if (message.type === 'offscreen-datachannel-ready') {
        return;
    }

    if (message.type === 'offscreen-server-event') {
        handleServerEvent(message.event);
        return;
    }

    if (message.type === 'offscreen-error') {
        broadcastTranscriptionState('error', { message: message.error });
        isTranscribing = false;
        return;
    }

    if (message.type === 'SIGNALLY_OPEN_WINDOW') {
        (async () => {
            try {
                await ensureSignallyWindow();
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (message.type === 'SIGNALLY_GET_STATE') {
        sendResponse({ state: transcriptionState });
        return true;
    }

    if (message.type === 'RELOAD_API_KEY') {
        if (summarizer) {
            summarizer.loadApiKey();
            console.log('[Background] API key reloaded in summarizer');
        }
        return true;
    }

    if (message.type === 'START_RECORDING_REQUEST') {
        (async () => {
            try {
                const result = await chrome.storage.sync.get(['openaiApiKey']);
                if (!result.openaiApiKey) {
                    sendResponse({
                        success: false,
                        error: '⚠️ OpenAI API key not set. Please configure it in Settings.'
                    });
                    return;
                }

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.id) {
                    sendResponse({ success: false, error: 'No active tab found' });
                    return;
                }

                if (isTranscribing) {
                    sendResponse({ success: false, error: 'Already recording' });
                    return;
                }

                activeTabId = tab.id;
                await startTranscription(tab.id);
                sendResponse({ success: true });
            } catch (error) {
                console.error('[Background] Error starting recording:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (message.type === 'STOP_RECORDING_REQUEST') {
        (async () => {
            try {
                if (!isTranscribing) {
                    sendResponse({ success: false, error: 'Not currently recording' });
                    return;
                }

                await stopTranscription();
                activeTabId = null;
                sendResponse({ success: true });
            } catch (error) {
                console.error('[Background] Error stopping recording:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

chrome.windows.onRemoved.addListener((removedId) => {
    if (removedId === signallyWindowId) {
        signallyWindowId = null;
    }
});
