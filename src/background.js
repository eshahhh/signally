'use strict';

const TOKEN_SERVER_URL = 'http://localhost:3000/token';

let signallyWindowId = null;
let transcriptionState = 'idle';
let activeTabId = null;

let offscreenDocumentExists = false;
let isTranscribing = false;

let currentTranscript = '';
let transcriptionBuffer = [];

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
        chrome.tabs.sendMessage(activeTabId, {
            ...message,
            target: 'content'
        }).catch(() => { });
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
        chrome.tabs.sendMessage(activeTabId, {
            ...message,
            target: 'content'
        }).catch(() => { });
    }

    if (signallyWindowId) {
        chrome.runtime.sendMessage(message).catch(() => { });
    }
}

function handleTranscriptionCompleted(event) {
    const transcript = event.transcript || '';

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
        chrome.tabs.sendMessage(activeTabId, {
            ...message,
            target: 'content'
        }).catch(() => { });
    }

    if (signallyWindowId) {
        chrome.runtime.sendMessage(message).catch(() => { });
    }

    currentTranscript = '';
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

    if (transcriptionState === 'recording') {
        broadcastTranscriptionState('stopping');
        stopTranscription();
        activeTabId = null;
    } else if (transcriptionState === 'idle' || transcriptionState === 'error') {
        activeTabId = tab.id;
        await startTranscription(tab.id);
    } else {
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
});

chrome.windows.onRemoved.addListener((removedId) => {
    if (removedId === signallyWindowId) {
        signallyWindowId = null;
    }
});
