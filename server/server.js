import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

app.post('/token', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'Server configuration error: API key not configured'
        });
    }

    const sessionConfig = {
        session: {
            type: 'transcription',
            audio: {
                input: {
                    format: {
                        type: 'audio/pcm',
                        rate: 24000
                    },
                    noise_reduction: {
                        type: 'near_field'
                    },
                    transcription: {
                        model: 'whisper-1',
                        language: 'en',
                        prompt: ''
                    },
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500
                    }
                }
            }
        }
    };

    try {
        const response = await fetch(
            'https://api.openai.com/v1/realtime/client_secrets',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionConfig)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
                error: `OpenAI API error: ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to generate token',
            message: error.message
        });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`[Server] Signally token server running on http://localhost:${PORT}`);
    console.log(`[Server] Environment check: OPENAI_API_KEY is ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
});
