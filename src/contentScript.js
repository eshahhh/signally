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
        closeButton: null
    };

    let overlayVisible = false;
    let overlayClockInterval = null;
    let currentState = 'idle';

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
            popoutButton,
            closeButton
        };
    }

    function attachOverlayEvents() {
        if (!overlayState.root) {
            return;
        }

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
                if (message.target === 'content') {
                    console.log('[Content] State changed:', message.state);
                    updateStatus(message.state);
                }
                break;

            case 'transcription-delta':
                if (message.target === 'content' && message.data) {
                    console.log('[Content] Transcription delta received');
                    handleTranscriptionDelta(message.data);
                }
                break;

            case 'transcription-completed':
                if (message.target === 'content' && message.data) {
                    console.log('[Content] Transcription completed');
                    handleTranscriptionCompleted(message.data);
                }
                break;

            case 'summary-generated':
                if (message.target === 'content' && message.data) {
                    console.log('[Content] Summary generated');
                    handleSummaryGenerated(message.data);
                }
                break;

            case 'followup-questions-generated':
                if (message.target === 'content' && message.data) {
                    console.log('[Content] Follow-up questions generated');
                    handleFollowUpQuestions(message.data);
                }
                break;

            case 'summary-error':
                if (message.target === 'content' && message.data) {
                    console.error('[Content] Summary error:', message.data.message);
                }
                break;

            default:
                console.log('[Content] Unhandled message type:', message.type);
        }
    });

    console.log('[Content] Signally content script loaded and ready');
})();
