'use strict';

(() => {
    if (window.self !== window.top) {
        return;
    }

    const TRANSCRIPT_SEGMENTS = [
        { speaker: 'Alex', text: 'Thanks for joining. Today we are aligning on the Q4 launch milestones.' },
        { speaker: 'Jamie', text: 'Marketing assets are on track and the landing page draft will be ready by Friday.' },
        { speaker: 'Priya', text: 'Engineering still needs a final requirements handoff for the integration work.' },
        { speaker: 'Noah', text: 'Customer success is preparing the enablement kit once timelines are locked.' }
    ];

    const SUMMARY_POINTS = [
        'Launch date penciled in for November 18 pending integration confidence.',
        'Design review scheduled for early next week with updated hero concepts.',
        'API specs must be finalized before engineering signs off on the integration backlog.'
    ];

    const FOLLOWUP_SETS = [
        [
            'Share the latest API documentation with the engineering team.',
            'Confirm creative asset deadlines with external partners.',
            'Schedule a risk review focused on integration timelines.'
        ],
        [
            'Prepare a customer comms draft announcing the beta window.',
            'Sync with analytics to define launch KPIs and dashboards.',
            'Block time with sales enablement for product walkthroughs.'
        ],
        [
            'Confirm QA coverage for mobile and desktop experiences.',
            'Collect feedback from the pilot cohort on onboarding flow gaps.',
            'Outline contingency plan if marketing assets slip by a week.'
        ]
    ];

    let overlayState = {
        root: null,
        clock: null,
        transcription: null,
        summary: null,
        followups: null,
        followupsButton: null,
        popoutButton: null,
        closeButton: null
    };

    let overlayVisible = false;
    let baseRenderToken = 0;
    let followupRenderToken = 0;
    let overlayClockInterval = null;
    let activeFollowupIndex = 0;

    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    async function typeText(target, text, token, tokenResolver) {
        for (const char of text) {
            if (!overlayVisible || token !== tokenResolver()) {
                return;
            }
            target.textContent += char;
            await sleep(randomDelay(18, 42));
            if (!overlayVisible || token !== tokenResolver()) {
                return;
            }
        }
    }

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

        const followupFooter = document.createElement('div');
        followupFooter.className = 'followup__footer';
        followupSection.appendChild(followupFooter);

        const followupButton = document.createElement('button');
        followupButton.className = 'primary-btn';
        followupButton.id = 'signally-followups-btn';
        followupButton.type = 'button';
        followupButton.textContent = 'Generate follow-ups';
        followupFooter.appendChild(followupButton);

        return {
            root,
            clock,
            transcription: transcriptBody,
            summary: summaryList,
            followups: followupList,
            followupsButton: followupButton,
            popoutButton,
            closeButton
        };
    }

    function attachOverlayEvents() {
        if (!overlayState.root) {
            return;
        }

        overlayState.followupsButton?.addEventListener('click', handleGenerateFollowups);
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

        overlayState.transcription.textContent = '';
        overlayState.summary.textContent = '';
        overlayState.followups.textContent = '';

        overlayState.root.classList.remove('signally-hidden');
        overlayVisible = true;
        startClock();
        startStreaming();
    }

    function hideOverlay() {
        if (!overlayVisible || !overlayState.root) {
            return;
        }

        overlayVisible = false;
        overlayState.root.classList.add('signally-hidden');
        stopClock();
        baseRenderToken += 1;
        followupRenderToken += 1;
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

    async function streamTranscription(token) {
        const container = overlayState.transcription;
        if (!container) {
            return;
        }
        container.textContent = '';

        for (const segment of TRANSCRIPT_SEGMENTS) {
            if (!overlayVisible || token !== baseRenderToken) {
                return;
            }

            const line = document.createElement('p');
            const speaker = document.createElement('strong');
            speaker.textContent = `${segment.speaker}: `;
            line.appendChild(speaker);
            const textNode = document.createTextNode('');
            line.appendChild(textNode);
            container.appendChild(line);

            await typeText(textNode, segment.text, token, () => baseRenderToken);
            if (!overlayVisible || token !== baseRenderToken) {
                return;
            }

            await sleep(randomDelay(220, 480));
        }
    }

    async function streamSummary(token) {
        const container = overlayState.summary;
        if (!container) {
            return;
        }
        container.textContent = '';

        for (const point of SUMMARY_POINTS) {
            if (!overlayVisible || token !== baseRenderToken) {
                return;
            }

            const item = document.createElement('li');
            container.appendChild(item);
            await typeText(item, point, token, () => baseRenderToken);
            if (!overlayVisible || token !== baseRenderToken) {
                return;
            }

            await sleep(randomDelay(260, 520));
        }
    }

    async function streamFollowups(token, followupIndex) {
        const container = overlayState.followups;
        if (!container) {
            return;
        }

        const followups = FOLLOWUP_SETS[followupIndex] ?? FOLLOWUP_SETS[0];
        container.textContent = '';

        for (const itemText of followups) {
            if (!overlayVisible || token !== followupRenderToken) {
                return;
            }

            const item = document.createElement('li');
            container.appendChild(item);
            await typeText(item, itemText, token, () => followupRenderToken);
            if (!overlayVisible || token !== followupRenderToken) {
                return;
            }

            await sleep(randomDelay(240, 460));
        }
    }

    function pickNextFollowupIndex() {
        if (FOLLOWUP_SETS.length <= 1) {
            return 0;
        }

        let candidate = activeFollowupIndex;
        while (candidate === activeFollowupIndex) {
            candidate = Math.floor(Math.random() * FOLLOWUP_SETS.length);
        }
        return candidate;
    }

    async function startStreaming() {
        baseRenderToken += 1;
        const token = baseRenderToken;

        await streamTranscription(token);
        if (!overlayVisible || token !== baseRenderToken) {
            return;
        }

        await streamSummary(token);
        if (!overlayVisible || token !== baseRenderToken) {
            return;
        }

        followupRenderToken += 1;
        activeFollowupIndex = 0;
        await streamFollowups(followupRenderToken, activeFollowupIndex);
    }

    function handleGenerateFollowups() {
        if (!overlayVisible) {
            return;
        }

        followupRenderToken += 1;
        activeFollowupIndex = pickNextFollowupIndex();
        streamFollowups(followupRenderToken, activeFollowupIndex);
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
