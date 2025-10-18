'use strict';

(() => {
    if (window.self !== window.top) {
        return;
    }

    let overlayState = {
        root: null,
        clock: null,
        transcription: null,
        summary: null,
        followups: null,
        optionsButton: null,
        popoutButton: null,
        closeButton: null
    };

    let overlayVisible = false;
    let overlayClockInterval = null;

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
        status.textContent = 'Monitoring · ';
        const clock = document.createElement('span');
        clock.id = 'signally-overlay-clock';
        clock.textContent = '--:--';
        status.appendChild(clock);
        heading.appendChild(status);

        const actions = document.createElement('div');
        actions.className = 'panel__actions';
        header.appendChild(actions);

        const optionsButton = document.createElement('button');
        optionsButton.className = 'panel__icon-btn';
        optionsButton.type = 'button';
        optionsButton.title = 'Options';
        optionsButton.setAttribute('aria-label', 'Options');
        const optionsGlyph = document.createElement('span');
        optionsGlyph.setAttribute('aria-hidden', 'true');
        optionsGlyph.textContent = '⚙';
        optionsButton.appendChild(optionsGlyph);
        actions.appendChild(optionsButton);

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
            transcription: transcriptBody,
            summary: summaryList,
            followups: followupList,
            optionsButton,
            popoutButton,
            closeButton
        };
    }

    function attachOverlayEvents() {
        if (!overlayState.root) {
            return;
        }

        overlayState.optionsButton?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'SIGNALLY_OPEN_OPTIONS' });
        });
        overlayState.popoutButton?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'SIGNALLY_OPEN_WINDOW' });
        });
        overlayState.closeButton?.addEventListener('click', hideOverlay);
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

    chrome.runtime.onMessage.addListener((message) => {
        if (!message || typeof message !== 'object') {
            return;
        }

        if (message.type === 'SIGNALLY_TOGGLE_OVERLAY') {
            toggleOverlay();
        }
    });
})();
