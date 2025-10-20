'use strict';

(() => {
    if (window.self !== window.top) {
        return;
    }

    let overlayState = {
        root: null,
        clock: null,
        status: null,
        transcription: null,
        summary: null,
        followups: null,
        popoutButton: null,
        closeButton: null,
        settingsBtn: null,
        settingsSection: null,
        apiKeyInput: null,
        saveApiKeyBtn: null,
        cancelSettingsBtn: null,
        startRecordBtn: null,
        stopRecordBtn: null,
        exportBtn: null
    };

    let overlayVisible = false;
    let overlayClockInterval = null;
    let currentState = 'idle';
    let settingsVisible = false;
    let summaryLog = [];

    function ensureOverlay() {
        if (overlayState.root) {
            return true;
        }

        const host = document.body || document.documentElement;
        if (!host) {
            return false;
        }

        overlayState = buildOverlay();
        host.appendChild(overlayState.root);
        attachOverlayEvents();
        return true;
    }

    function buildOverlay() {
        const root = document.createElement('aside');
        root.id = 'signally-overlay';
        root.className = 'signally-hidden';
        root.setAttribute('role', 'complementary');
        root.setAttribute('aria-label', 'Signally live transcription');

        const panel = document.createElement('div');
        panel.className = 'panel';
        root.appendChild(panel);

        const header = document.createElement('header');
        header.className = 'panel__header';
        panel.appendChild(header);

        const heading = document.createElement('div');
        heading.className = 'panel__heading';
        header.appendChild(heading);

        const brand = document.createElement('div');
        brand.className = 'panel__brand';
        brand.textContent = 'Signally';
        heading.appendChild(brand);

        const status = document.createElement('div');
        status.className = 'panel__status';
        status.id = 'signally-overlay-status';
        status.textContent = 'Ready · ';
        const clock = document.createElement('span');
        clock.id = 'signally-overlay-clock';
        clock.textContent = '--:--';
        status.appendChild(clock);
        heading.appendChild(status);

        const actions = document.createElement('div');
        actions.className = 'panel__actions';
        header.appendChild(actions);

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'panel__icon-btn';
        settingsBtn.type = 'button';
        settingsBtn.title = 'Settings';
        settingsBtn.setAttribute('aria-label', 'Settings');
        settingsBtn.textContent = '{ }';
        actions.appendChild(settingsBtn);

        const popoutButton = document.createElement('button');
        popoutButton.className = 'panel__icon-btn';
        popoutButton.type = 'button';
        popoutButton.title = 'Open Signally window';
        popoutButton.setAttribute('aria-label', 'Open Signally window');
        const popoutGlyph = document.createElement('span');
        popoutGlyph.setAttribute('aria-hidden', 'true');
        popoutGlyph.textContent = '[ ]';
        popoutButton.appendChild(popoutGlyph);
        actions.appendChild(popoutButton);

        const closeButton = document.createElement('button');
        closeButton.className = 'panel__icon-btn panel__icon-btn--close';
        closeButton.type = 'button';
        closeButton.title = 'Close overlay';
        closeButton.setAttribute('aria-label', 'Close overlay');
        const closeGlyph = document.createElement('span');
        closeGlyph.setAttribute('aria-hidden', 'true');
        closeGlyph.textContent = 'X';
        closeButton.appendChild(closeGlyph);
        actions.appendChild(closeButton);

        const settingsSection = document.createElement('section');
        settingsSection.className = 'panel__section panel__section--settings';
        settingsSection.id = 'signally-overlay-settings';
        settingsSection.style.display = 'none';
        panel.appendChild(settingsSection);

        const settingsTitle = document.createElement('h2');
        settingsTitle.className = 'section__title';
        settingsTitle.textContent = 'Settings';
        settingsSection.appendChild(settingsTitle);

        const settingsBody = document.createElement('div');
        settingsBody.className = 'settings__body';
        settingsSection.appendChild(settingsBody);

        const apiKeyLabel = document.createElement('label');
        apiKeyLabel.htmlFor = 'signally-overlay-api-key';
        apiKeyLabel.className = 'settings__label';
        apiKeyLabel.textContent = 'OpenAI API Key:';
        settingsBody.appendChild(apiKeyLabel);

        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'password';
        apiKeyInput.id = 'signally-overlay-api-key';
        apiKeyInput.className = 'settings__input';
        apiKeyInput.placeholder = 'sk-...';
        apiKeyInput.autocomplete = 'off';
        settingsBody.appendChild(apiKeyInput);

        const settingsActions = document.createElement('div');
        settingsActions.className = 'settings__actions';
        settingsBody.appendChild(settingsActions);

        const saveApiKeyBtn = document.createElement('button');
        saveApiKeyBtn.className = 'settings__btn settings__btn--primary';
        saveApiKeyBtn.textContent = 'Save';
        settingsActions.appendChild(saveApiKeyBtn);

        const cancelSettingsBtn = document.createElement('button');
        cancelSettingsBtn.className = 'settings__btn settings__btn--secondary';
        cancelSettingsBtn.textContent = 'Cancel';
        settingsActions.appendChild(cancelSettingsBtn);

        const settingsInfo = document.createElement('p');
        settingsInfo.className = 'settings__info';
        settingsInfo.textContent = 'Your API key is stored securely in your browser and never shared.';
        settingsBody.appendChild(settingsInfo);

        const controlsSection = document.createElement('section');
        controlsSection.className = 'panel__section panel__section--controls';
        panel.appendChild(controlsSection);

        const controlsTitle = document.createElement('h2');
        controlsTitle.className = 'section__title';
        controlsTitle.textContent = 'Recording Controls';
        controlsSection.appendChild(controlsTitle);

        const controlsBody = document.createElement('div');
        controlsBody.className = 'controls__body';
        controlsSection.appendChild(controlsBody);

        const startRecordBtn = document.createElement('button');
        startRecordBtn.className = 'controls__btn controls__btn--start';
        startRecordBtn.id = 'signally-overlay-start-record';
        startRecordBtn.textContent = 'START RECORDING';
        controlsBody.appendChild(startRecordBtn);

        const stopRecordBtn = document.createElement('button');
        stopRecordBtn.className = 'controls__btn controls__btn--stop';
        stopRecordBtn.id = 'signally-overlay-stop-record';
        stopRecordBtn.textContent = 'STOP RECORDING';
        stopRecordBtn.disabled = true;
        controlsBody.appendChild(stopRecordBtn);

        const exportBtn = document.createElement('button');
        exportBtn.className = 'controls__btn controls__btn--export';
        exportBtn.id = 'signally-overlay-export';
        exportBtn.textContent = 'EXPORT SUMMARY';
        controlsBody.appendChild(exportBtn);

        const transcriptSection = document.createElement('section');
        transcriptSection.className = 'panel__section';
        transcriptSection.setAttribute('aria-live', 'polite');
        panel.appendChild(transcriptSection);

        const transcriptTitle = document.createElement('h2');
        transcriptTitle.className = 'section__title';
        transcriptTitle.textContent = 'Live Transcription';
        transcriptSection.appendChild(transcriptTitle);

        const transcriptBody = document.createElement('div');
        transcriptBody.className = 'section__body stream__block';
        transcriptBody.id = 'signally-transcription';
        transcriptSection.appendChild(transcriptBody);

        const summarySection = document.createElement('section');
        summarySection.className = 'panel__section';
        summarySection.setAttribute('aria-live', 'polite');
        panel.appendChild(summarySection);

        const summaryTitle = document.createElement('h2');
        summaryTitle.className = 'section__title';
        summaryTitle.textContent = 'Running Summary';
        summarySection.appendChild(summaryTitle);

        const summaryList = document.createElement('ul');
        summaryList.className = 'summary__list stream__list';
        summaryList.id = 'signally-summary';
        summarySection.appendChild(summaryList);

        const followupSection = document.createElement('section');
        followupSection.className = 'panel__section';
        followupSection.setAttribute('aria-live', 'polite');
        panel.appendChild(followupSection);

        const followupTitle = document.createElement('h2');
        followupTitle.className = 'section__title';
        followupTitle.textContent = 'Suggested Follow-ups';
        followupSection.appendChild(followupTitle);

        const followupList = document.createElement('ol');
        followupList.className = 'followup__list stream__list';
        followupList.id = 'signally-followups';
        followupSection.appendChild(followupList);

        return {
            root,
            clock,
            status,
            transcription: transcriptBody,
            summary: summaryList,
            followups: followupList,
            settingsBtn,
            settingsSection,
            apiKeyInput,
            saveApiKeyBtn,
            cancelSettingsBtn,
            popoutButton,
            closeButton,
            startRecordBtn,
            stopRecordBtn,
            exportBtn
        };
    }

    function attachOverlayEvents() {
        if (!overlayState.root) {
            return;
        }

        overlayState.settingsBtn?.addEventListener('click', () => {
            console.log('[Content] Toggling settings');
            toggleSettings();
        });

        overlayState.saveApiKeyBtn?.addEventListener('click', () => {
            console.log('[Content] Saving API key');
            saveApiKey();
        });

        overlayState.cancelSettingsBtn?.addEventListener('click', () => {
            console.log('[Content] Canceling settings');
            cancelSettings();
        });

        overlayState.apiKeyInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveApiKey();
            }
        });

        overlayState.apiKeyInput?.addEventListener('focus', () => {
            if (overlayState.apiKeyInput.value === '••••••••••••••••') {
                overlayState.apiKeyInput.value = '';
            }
        });

        overlayState.startRecordBtn?.addEventListener('click', () => {
            console.log('[Content] Start recording clicked');
            startRecording();
        });

        overlayState.stopRecordBtn?.addEventListener('click', () => {
            console.log('[Content] Stop recording clicked');
            stopRecording();
        });

        overlayState.exportBtn?.addEventListener('click', () => {
            console.log('[Content] Export summary clicked');
            exportSummary();
        });

        overlayState.popoutButton?.addEventListener('click', () => {
            console.log('[Content] Opening popup window...');
            chrome.runtime.sendMessage({ type: 'SIGNALLY_OPEN_WINDOW' });
        });
        overlayState.closeButton?.addEventListener('click', () => {
            console.log('[Content] Closing overlay');
            hideOverlay();
        });
    }

    function toggleOverlay() {
        if (overlayVisible) {
            hideOverlay();
        } else {
            showOverlay();
        }
    }

    function showOverlay() {
        if (!ensureOverlay()) {
            return;
        }

        if (overlayVisible) {
            return;
        }

        overlayState.root.classList.remove('signally-hidden');
        overlayVisible = true;
        startClock();

        chrome.runtime.sendMessage({ type: 'SIGNALLY_GET_STATE' }, (response) => {
            if (response?.state) {
                updateStatus(response.state);
                if (response.state === 'recording') {
                    updateRecordingButtons(true);
                } else {
                    updateRecordingButtons(false);
                }
            }
        });
    }

    function hideOverlay() {
        if (!overlayVisible || !overlayState.root) {
            return;
        }

        overlayVisible = false;
        overlayState.root.classList.add('signally-hidden');
        stopClock();
    }

    function updateClock() {
        if (!overlayState.clock) {
            return;
        }
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        overlayState.clock.textContent = `${hours}:${minutes}`;
    }

    function updateStatus(state) {
        if (!overlayState.status || !overlayState.clock) {
            return;
        }

        console.log('[Content] Updating status to:', state);
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
                statusText = 'Ready';
        }

        const clockText = overlayState.clock.textContent;
        overlayState.status.innerHTML = `${statusText} · <span id="signally-overlay-clock">${clockText}</span>`;

        const newClock = document.getElementById('signally-overlay-clock');
        if (newClock) {
            overlayState.clock = newClock;
        }

        console.log('[Content] Status updated');
    }

    function startClock() {
        updateClock();
        if (overlayClockInterval) {
            clearInterval(overlayClockInterval);
        }
        overlayClockInterval = window.setInterval(updateClock, 60_000);
    }

    function stopClock() {
        if (overlayClockInterval) {
            clearInterval(overlayClockInterval);
            overlayClockInterval = null;
        }
    }

    function updateTranscription(text, isComplete = false) {
        if (!overlayState.transcription) {
            console.warn('[Content] Transcription element not found');
            return;
        }

        console.log('[Content] Updating transcription:', isComplete ? 'complete' : 'delta', text);

        if (isComplete) {
            const p = document.createElement('p');
            p.textContent = text;
            p.style.marginBottom = '0.5em';
            overlayState.transcription.appendChild(p);

            overlayState.transcription.scrollTop = overlayState.transcription.scrollHeight;
        } else {
            let currentP = overlayState.transcription.querySelector('.transcription-current');
            if (!currentP) {
                currentP = document.createElement('p');
                currentP.className = 'transcription-current';
                currentP.style.fontStyle = 'italic';
                currentP.style.color = '#888';
                overlayState.transcription.appendChild(currentP);
            }
            currentP.textContent = text;

            overlayState.transcription.scrollTop = overlayState.transcription.scrollHeight;
        }
    }

    function handleTranscriptionDelta(data) {
        console.log('[Content] Received transcription delta:', data.delta);
        updateTranscription(data.current, false);
    }

    function handleTranscriptionCompleted(data) {
        console.log('[Content] Received completed transcription:', data.transcript);

        const currentP = overlayState.transcription?.querySelector('.transcription-current');
        if (currentP) {
            currentP.remove();
        }

        updateTranscription(data.transcript, true);
    }

    function handleSummaryGenerated(data) {
        if (!overlayState.summary) {
            console.warn('[Content] Summary element not found');
            return;
        }

        console.log('[Content] Received summary:', data.summary);

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
        bullet.style.color = '#888';
        li.prepend(bullet);

        overlayState.summary.appendChild(li);
        overlayState.summary.scrollTop = overlayState.summary.scrollHeight;
    }

    function toggleSettings() {
        settingsVisible = !settingsVisible;
        if (overlayState.settingsSection) {
            overlayState.settingsSection.style.display = settingsVisible ? 'flex' : 'none';
        }
        if (settingsVisible) {
            loadApiKeyStatus();
        }
    }

    async function loadApiKeyStatus() {
        try {
            const result = await chrome.storage.sync.get(['openaiApiKey']);
            if (overlayState.apiKeyInput) {
                if (result.openaiApiKey) {
                    overlayState.apiKeyInput.value = '••••••••••••••••';
                    console.log('[Content] API key loaded (masked)');
                } else {
                    overlayState.apiKeyInput.value = '';
                    console.log('[Content] No API key found');
                }
            }
        } catch (error) {
            console.error('[Content] Error loading API key:', error);
        }
    }

    async function saveApiKey() {
        if (!overlayState.apiKeyInput) return;

        const apiKey = overlayState.apiKeyInput.value.trim();

        if (!apiKey) {
            showNotification('Please enter an API key', 'error');
            return;
        }

        if (apiKey === '••••••••••••••••') {
            console.log('[Content] Masked value detected, not saving');
            toggleSettings();
            return;
        }

        try {
            await chrome.storage.sync.set({ openaiApiKey: apiKey });
            console.log('[Content] API key saved successfully');

            chrome.runtime.sendMessage({ type: 'RELOAD_API_KEY' });

            overlayState.apiKeyInput.value = '••••••••••••••••';

            showNotification('API key saved successfully!', 'success');
            toggleSettings();
        } catch (error) {
            console.error('[Content] Error saving API key:', error);
            showNotification('Failed to save API key. Please try again.', 'error');
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
                showNotification('⚠️ Please set your OpenAI API key in Settings first!', 'error');
                toggleSettings();
                return;
            }
        } catch (error) {
            console.error('[Content] Error checking API key:', error);
            showNotification('Error checking API key', 'error');
            return;
        }

        console.log('[Content] Requesting to start recording...');

        summaryLog = [];
        if (overlayState.summary) {
            overlayState.summary.innerHTML = '';
        }
        if (overlayState.transcription) {
            overlayState.transcription.innerHTML = '';
        }
        if (overlayState.followups) {
            overlayState.followups.innerHTML = '';
        }

        chrome.runtime.sendMessage({
            type: 'START_RECORDING_REQUEST'
        }, (response) => {
            if (response?.success) {
                updateRecordingButtons(true);
            } else {
                showNotification(response?.error || 'Failed to start recording', 'error');
            }
        });
    }

    async function stopRecording() {
        console.log('[Content] Requesting to stop recording...');

        chrome.runtime.sendMessage({
            type: 'STOP_RECORDING_REQUEST'
        }, (response) => {
            if (response?.success) {
                updateRecordingButtons(false);
            } else {
                showNotification(response?.error || 'Failed to stop recording', 'error');
            }
        });
    }

    function updateRecordingButtons(isRecording) {
        if (overlayState.startRecordBtn) {
            overlayState.startRecordBtn.disabled = isRecording;
        }
        if (overlayState.stopRecordBtn) {
            overlayState.stopRecordBtn.disabled = !isRecording;
        }
    }

    function exportSummary() {
        if (summaryLog.length === 0) {
            showNotification('No summary to export yet', 'warning');
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

        showNotification('Summary exported successfully!', 'success');
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `signally-notification signally-notification--${type}`;
        notification.textContent = message;

        let bgColor = 'rgba(30, 41, 59, 0.95)';
        if (type === 'error') bgColor = 'rgba(71, 85, 105, 0.95)';
        if (type === 'success') bgColor = 'rgba(51, 65, 85, 0.95)';

        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 24px;
            background: ${bgColor};
            color: #e2e8f0;
            padding: 12px 18px;
            border-radius: 6px;
            border: 1px solid rgba(148, 163, 184, 0.3);
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            font-size: 13px;
            font-weight: 500;
            z-index: 2147483648;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            max-width: 350px;
            word-wrap: break-word;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transition = 'opacity 0.3s ease';
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    function handleFollowUpQuestions(data) {
        if (!overlayState.followups) {
            console.warn('[Content] Follow-up list element not found');
            return;
        }

        console.log('[Content] Received follow-up questions:', data.questions);

        overlayState.followups.innerHTML = '';

        data.questions.forEach((question, index) => {
            const li = document.createElement('li');
            li.textContent = question;
            li.style.marginBottom = '0.75em';
            li.style.paddingLeft = '0.5em';
            overlayState.followups.appendChild(li);
        });

        overlayState.followups.scrollTop = overlayState.followups.scrollHeight;
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (!message || typeof message !== 'object') {
            return;
        }

        console.log('[Content] Received message:', message.type);

        switch (message.type) {
            case 'SIGNALLY_TOGGLE_OVERLAY':
                console.log('[Content] Toggling overlay');
                toggleOverlay();
                break;

            case 'transcription-state-changed':
                console.log('[Content] State changed:', message.state);
                updateStatus(message.state);

                if (message.state === 'recording') {
                    updateRecordingButtons(true);
                } else if (message.state === 'idle' || message.state === 'error') {
                    updateRecordingButtons(false);
                }

                if (message.state === 'error' && message.details?.message) {
                    showNotification(message.details.message, 'error');
                }
                break;

            case 'transcription-delta':
                if (message.data) {
                    console.log('[Content] Transcription delta received');
                    handleTranscriptionDelta(message.data);
                }
                break;

            case 'transcription-completed':
                if (message.data) {
                    console.log('[Content] Transcription completed');
                    handleTranscriptionCompleted(message.data);
                }
                break;

            case 'summary-generated':
                if (message.data) {
                    console.log('[Content] Summary generated');
                    handleSummaryGenerated(message.data);
                }
                break;

            case 'followup-questions-generated':
                if (message.data) {
                    console.log('[Content] Follow-up questions generated');
                    handleFollowUpQuestions(message.data);
                }
                break;

            case 'summary-error':
                if (message.data) {
                    console.error('[Content] Summary error:', message.data.message);
                }
                break;

            default:
                console.log('[Content] Unhandled message type:', message.type);
        }
    });

    console.log('[Content] Signally content script loaded and ready');
})();
