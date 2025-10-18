'use strict';

let peerConnection = null;
let dataChannel = null;
let audioElement = null;
let mediaStream = null;

let currentTranscript = '';

console.log('[Offscreen] Offscreen document initialized');

function setupDataChannel() {
    if (!dataChannel) {
        return;
    }

    dataChannel.addEventListener('open', () => {
        console.log('[Offscreen] Data channel opened - ready to receive transcriptions');
        chrome.runtime.sendMessage({
            type: 'offscreen-datachannel-ready',
            timestamp: Date.now()
        });
    });

    dataChannel.addEventListener('close', () => {
        console.log('[Offscreen] Data channel closed');
    });

    dataChannel.addEventListener('error', (error) => {
        console.error('[Offscreen] Data channel error:', error);
    });

    dataChannel.addEventListener('message', (event) => {
        try {
            const serverEvent = JSON.parse(event.data);
            chrome.runtime.sendMessage({
                type: 'offscreen-server-event',
                event: serverEvent,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[Offscreen] Error parsing server event:', error);
        }
    });
}

function cleanup() {
    console.log('[Offscreen] Cleaning up resources...');

    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
        console.log('[Offscreen] Data channel closed');
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        console.log('[Offscreen] Peer connection closed');
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
            track.stop();
            console.log('[Offscreen] Media track stopped');
        });
        mediaStream = null;
    }

    if (audioElement) {
        audioElement.srcObject = null;
        audioElement = null;
        console.log('[Offscreen] Audio element cleared');
    }

    currentTranscript = '';
    console.log('[Offscreen] Cleanup complete');
}

async function startWebRTC(streamId, ephemeralKey) {
    try {
        console.log('[Offscreen] Getting tab audio stream with ID:', streamId);

        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: "tab",
                    chromeMediaSourceId: streamId,
                }
            },
            video: false
        });

        console.log('[Offscreen] Tab audio stream obtained');

        const output = new AudioContext();
        const source = output.createMediaStreamSource(mediaStream);
        source.connect(output.destination);
        console.log('[Offscreen] Audio playback enabled');

        console.log('[Offscreen] Creating WebRTC peer connection...');
        peerConnection = new RTCPeerConnection();

        audioElement = new Audio();
        audioElement.autoplay = true;
        peerConnection.ontrack = (event) => {
            console.log('[Offscreen] Received remote audio track from model');
            audioElement.srcObject = event.streams[0];
        };

        const audioTrack = mediaStream.getTracks()[0];
        peerConnection.addTrack(audioTrack, mediaStream);
        console.log('[Offscreen] Added tab audio track to peer connection');

        dataChannel = peerConnection.createDataChannel('oai-events');
        setupDataChannel();

        console.log('[Offscreen] Creating SDP offer...');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('[Offscreen] Local SDP set');

        console.log('[Offscreen] Sending SDP to OpenAI Realtime API...');
        const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
            method: 'POST',
            body: offer.sdp,
            headers: {
                'Authorization': `Bearer ${ephemeralKey}`,
                'Content-Type': 'application/sdp'
            }
        });

        if (!sdpResponse.ok) {
            const errorText = await sdpResponse.text();
            throw new Error(`OpenAI API error: ${sdpResponse.status} - ${errorText}`);
        }

        const answerSdp = await sdpResponse.text();
        const answer = {
            type: 'answer',
            sdp: answerSdp
        };

        await peerConnection.setRemoteDescription(answer);
        console.log('[Offscreen] Remote SDP set - WebRTC connection established!');
        console.log('[Offscreen] Now streaming tab audio for transcription...');

        chrome.runtime.sendMessage({
            type: 'offscreen-webrtc-ready',
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('[Offscreen] Error starting WebRTC:', error);

        cleanup();

        chrome.runtime.sendMessage({
            type: 'offscreen-error',
            error: error.message,
            timestamp: Date.now()
        });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
        return;
    }

    console.log('[Offscreen] Received message:', message.type);

    switch (message.type) {
        case 'start-webrtc':
            console.log('[Offscreen] Starting WebRTC with stream ID');
            startWebRTC(message.streamId, message.ephemeralKey)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    console.error('[Offscreen] Failed to start WebRTC:', error);
                    sendResponse({ success: false, error: error.message });
                });
            return true;

        case 'stop-webrtc':
            console.log('[Offscreen] Stopping WebRTC');
            cleanup();
            sendResponse({ success: true });
            return true;

        default:
            console.log('[Offscreen] Unhandled message type:', message.type);
    }
});
