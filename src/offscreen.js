'use strict';

let recorder = null;
let audioChunks = [];
const RECORDING_DURATION = 10000;

chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object' || message.target !== 'offscreen') {
        return;
    }

    switch (message.type) {
        case 'start-recording':
            startRecording(message.data);
            break;
        case 'stop-recording':
            stopRecording();
            break;
        default:
            console.error('Unrecognized message:', message.type);
    }
});

async function startRecording(streamId) {
    if (recorder?.state === 'recording') {
        console.error('Called startRecording while recording is in progress.');
        return;
    }

    try {
        const media = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            }
        });

        // Continue to play the captured audio to the user
        const output = new AudioContext();
        const source = output.createMediaStreamSource(media);
        source.connect(output.destination);

        // Start recording with audio-only format
        recorder = new MediaRecorder(media, { mimeType: 'audio/webm' });

        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        recorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });

            // Create a download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `signally-recording-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            // Clear state ready for next recording
            recorder = null;
            audioChunks = [];

            // Update hash
            window.location.hash = '';
        };

        recorder.start();

        // Record the current state in the URL
        window.location.hash = 'recording';

        // Automatically stop recording after 10 seconds
        setTimeout(() => {
            if (recorder && recorder.state === 'recording') {
                chrome.runtime.sendMessage({
                    type: 'stop-recording',
                    target: 'offscreen'
                });
            }
        }, RECORDING_DURATION);

        console.log('Recording started for 10 seconds...');
    } catch (err) {
        console.error('Error starting recording:', err);
        chrome.runtime.sendMessage({
            type: 'recording-error',
            target: 'background',
            error: err.message
        });
    }
}

function stopRecording() {
    if (!recorder || recorder.state !== 'recording') {
        console.warn('No active recording to stop.');
        return;
    }

    recorder.stop();

    recorder.stream.getTracks().forEach((track) => track.stop());

    console.log('Recording stopped.');
}
