'use strict';

const sessionTimeDisplay = document.getElementById('session-time');
const optionsButton = document.getElementById('options-btn');

let clockIntervalId = null;

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

function openOptions() {
    chrome.runtime.openOptionsPage();
}

document.addEventListener('DOMContentLoaded', () => {
    startClock();
    optionsButton?.addEventListener('click', openOptions);
});
