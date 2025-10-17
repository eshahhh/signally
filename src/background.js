'use strict';

let signallyWindowId = null;

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
        console.warn('Signally cannot run on restricted pages:', tab.url);
        return;
    }

    try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SIGNALLY_TOGGLE_OVERLAY' });
    } catch (err) {
        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['overlay.css']
            });
        } catch (cssErr) {
            console.error('Unable to inject Signally styles:', cssErr);
            return;
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['contentScript.js']
            });
            await chrome.tabs.sendMessage(tab.id, { type: 'SIGNALLY_TOGGLE_OVERLAY' });
        } catch (injectErr) {
            console.error('Unable to toggle Signally overlay:', injectErr);
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
        return;
    }

    if (message.type === 'SIGNALLY_OPEN_WINDOW') {
        (async () => {
            try {
                await ensureSignallyWindow();
                sendResponse({ ok: true });
            } catch (err) {
                console.error('Failed to launch Signally window:', err);
                sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
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
