'use strict';

const sessionTimeDisplay = document.getElementById('session-time');
const transcriptionContainer = document.getElementById('transcription-stream');
const summaryList = document.getElementById('summary-stream');
const followupList = document.getElementById('followup-list');
const followupsButton = document.getElementById('followups-btn');

// Fake simulation of some Random AI generated yap

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

let clockIntervalId = null;
let baseRenderToken = 0;
let followupRenderToken = 0;
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
        if (token !== tokenResolver()) {
            return;
        }
        target.textContent += char;
        await sleep(randomDelay(18, 42));
        if (token !== tokenResolver()) {
            return;
        }
    }
}

async function streamTranscription(token) {
    transcriptionContainer.textContent = '';

    for (const segment of TRANSCRIPT_SEGMENTS) {
        if (token !== baseRenderToken) {
            return;
        }

        const line = document.createElement('p');
        const speaker = document.createElement('strong');
        speaker.textContent = `${segment.speaker}: `;
        line.appendChild(speaker);

        const textNode = document.createTextNode('');
        line.appendChild(textNode);
        transcriptionContainer.appendChild(line);

        await typeText(textNode, segment.text, token, () => baseRenderToken);
        if (token !== baseRenderToken) {
            return;
        }

        await sleep(randomDelay(220, 480));
    }
}

async function streamSummary(token) {
    summaryList.textContent = '';

    for (const point of SUMMARY_POINTS) {
        if (token !== baseRenderToken) {
            return;
        }

        const item = document.createElement('li');
        summaryList.appendChild(item);
        await typeText(item, point, token, () => baseRenderToken);
        if (token !== baseRenderToken) {
            return;
        }

        await sleep(randomDelay(260, 520));
    }
}

async function streamFollowups(token, followupIndex) {
    const followups = FOLLOWUP_SETS[followupIndex] ?? FOLLOWUP_SETS[0];
    followupList.textContent = '';

    for (const itemText of followups) {
        if (token !== followupRenderToken) {
            return;
        }

        const item = document.createElement('li');
        followupList.appendChild(item);
        await typeText(item, itemText, token, () => followupRenderToken);
        if (token !== followupRenderToken) {
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
    if (token !== baseRenderToken) {
        return;
    }

    await streamSummary(token);
    if (token !== baseRenderToken) {
        return;
    }

    followupRenderToken += 1;
    activeFollowupIndex = 0;
    await streamFollowups(followupRenderToken, activeFollowupIndex);
}

function handleGenerateFollowups() {
    followupRenderToken += 1;
    activeFollowupIndex = pickNextFollowupIndex();
    streamFollowups(followupRenderToken, activeFollowupIndex);
}

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

document.addEventListener('DOMContentLoaded', () => {
    startClock();
    startStreaming();

    followupsButton?.addEventListener('click', handleGenerateFollowups);
});
