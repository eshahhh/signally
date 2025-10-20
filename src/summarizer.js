'use strict';

class Summarizer {
    constructor() {
        this.model = "gpt-5-nano";
        this.apiBaseUrl = "https://api.openai.com/v1";
        this.responsesEndpoint = `${this.apiBaseUrl}/responses`;
        this.apiKey = null;

        this.transcriptionWindow = [];
        this.transcriptionCount = 0;
        this.summaryThreshold = 1;
        this.maxWindowSize = 10;
        this.allSummaries = [];
        this.allFollowUpQuestions = new Set();

        console.log('[Summarizer] Initialized with model:', this.model);
        this.loadApiKey();
    }

    async loadApiKey() {
        try {
            const result = await chrome.storage.sync.get(['openaiApiKey']);
            this.apiKey = result.openaiApiKey || null;
            if (this.apiKey) {
                console.log('[Summarizer] API key loaded from storage');
            } else {
                console.warn('[Summarizer] No API key found in storage');
            }
        } catch (error) {
            console.error('[Summarizer] Error loading API key:', error);
        }
    }

    async setApiKey(apiKey) {
        try {
            await chrome.storage.sync.set({ openaiApiKey: apiKey });
            this.apiKey = apiKey;
            console.log('[Summarizer] API key saved to storage');
            return true;
        } catch (error) {
            console.error('[Summarizer] Error saving API key:', error);
            return false;
        }
    }

    addTranscription(transcript) {
        if (!transcript || transcript.trim().length === 0) {
            return false;
        }

        this.transcriptionWindow.push({
            text: transcript,
            timestamp: Date.now()
        });
        this.transcriptionCount++;

        if (this.transcriptionWindow.length > this.maxWindowSize) {
            this.transcriptionWindow.shift();
            console.log('[Summarizer] Trimmed transcription window to', this.maxWindowSize, 'items');
        }

        console.log(`[Summarizer] Added transcription #${this.transcriptionCount}. Buffer size: ${this.transcriptionWindow.length}`);

        const shouldSummarize = this.transcriptionCount % this.summaryThreshold === 0;

        if (shouldSummarize) {
            console.log('[Summarizer] Threshold reached, summary generation recommended');
        }

        return shouldSummarize;
    }

    getTranscriptionContext() {
        return this.transcriptionWindow
            .map(item => item.text)
            .join(' ')
            .trim();
    }

    buildSystemPrompt() {
        const previousFollowUps = Array.from(this.allFollowUpQuestions).slice(-5);

        let prompt = `You are an intelligent meeting assistant that generates concise summaries and insightful follow-up questions.

IMPORTANT GUIDELINES:
- The transcription data you receive may be incomplete or mid-sentence
- You will receive ongoing transcription chunks along with previous context
- Focus on extracting key points, decisions, action items, and important topics
- Generate summaries that are concise (1-2 sentences) but capture the essence
- Create follow-up questions that are relevant, thought-provoking, and actionable
- DO NOT repeat questions that have been asked before

Your response MUST be valid JSON in this exact format:
{
  "summary": "A concise 1-2 sentence summary of the key points discussed",
  "followUpQuestions": [
    "First follow-up question?",
    "Second follow-up question?",
    "Third follow-up question?"
  ]
}

PREVIOUS FOLLOW-UP QUESTIONS (DO NOT REPEAT):`;

        if (previousFollowUps.length > 0) {
            prompt += '\n' + previousFollowUps.map((q, i) => `${i + 1}. ${q}`).join('\n');
        } else {
            prompt += '\nNone yet.';
        }

        return prompt;
    }

    buildInputMessages() {
        const context = this.getTranscriptionContext();
        const previousSummaries = this.allSummaries.slice(-5);

        let userMessage = `PREVIOUS CONTEXT:\n`;

        if (previousSummaries.length > 0) {
            userMessage += previousSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n');
        } else {
            userMessage += 'This is the first summary.';
        }

        userMessage += `\n\nNEW TRANSCRIPTION:\n${context}`;
        userMessage += `\n\nGenerate a concise summary and 3 relevant follow-up questions in valid JSON format.`;

        return [
            {
                role: "developer",
                content: this.buildSystemPrompt()
            },
            {
                role: "user",
                content: userMessage
            }
        ];
    }

    async generateSummary(temperature = 0.7) {
        try {
            if (!this.apiKey) {
                console.error('[Summarizer] No API key configured');
                throw new Error('OpenAI API key not configured. Please set it in settings.');
            }

            const inputMessages = this.buildInputMessages();

            const payload = {
                model: this.model,
                reasoning: { effort: "low" },
                input: inputMessages
            };

            console.log('[Summarizer] ===== DEBUG: Full Prompt =====');
            console.log('[Summarizer] Model:', payload.model);
            console.log('[Summarizer] Reasoning:', payload.reasoning);
            console.log('[Summarizer] Transcription window size:', this.transcriptionWindow.length);
            console.log('[Summarizer] Transcription context:', this.getTranscriptionContext());
            console.log('[Summarizer] All summaries count:', this.allSummaries.length);
            console.log('[Summarizer] All follow-up questions count:', this.allFollowUpQuestions.size);
            console.log('[Summarizer] Input Messages:');
            inputMessages.forEach((msg, idx) => {
                console.log(`[Summarizer]   Message ${idx + 1} (${msg.role}):`);
                console.log(`[Summarizer]   ${msg.content}`);
            });
            console.log('[Summarizer] Full payload:', JSON.stringify(payload, null, 2));
            console.log('[Summarizer] ===== END DEBUG =====');

            const payloadSize = JSON.stringify(payload).length;
            console.log('[Summarizer] Payload size:', payloadSize, 'bytes');

            if (payloadSize > 100000) {
                console.warn('[Summarizer] Payload too large, trimming context');
                this.transcriptionWindow = this.transcriptionWindow.slice(-3);
                return this.generateSummary(temperature);
            }

            console.log('[Summarizer] Calling OpenAI Responses API at', this.responsesEndpoint);

            const response = await fetch(this.responsesEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'No error details');
                console.error('[Summarizer] API error response:', errorText);
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[Summarizer] API Response:', JSON.stringify(result, null, 2));

            let content = '';
            if (result.output_text) {
                content = result.output_text;
            } else if (result.output && Array.isArray(result.output) && result.output.length > 0) {
                const messageOutput = result.output.find(item => item.type === 'message');
                if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content) && messageOutput.content.length > 0) {
                    const textContent = messageOutput.content.find(item => item.type === 'output_text');
                    if (textContent && textContent.text) {
                        content = textContent.text;
                    }
                }
            }

            console.log('[Summarizer] Extracted content:', content);

            if (!content) {
                console.error('[Summarizer] No content found in API response');
                throw new Error('No content in API response');
            }

            const parsed = this.parseResponse(content);

            if (parsed) {
                if (parsed.summary) {
                    this.allSummaries.push(parsed.summary);
                    console.log('[Summarizer] Added new summary:', parsed.summary);
                }

                if (parsed.followUpQuestions && Array.isArray(parsed.followUpQuestions)) {
                    parsed.followUpQuestions.forEach(q => {
                        this.allFollowUpQuestions.add(q);
                    });
                    console.log('[Summarizer] Added', parsed.followUpQuestions.length, 'new follow-up questions');
                }
            }

            return parsed;

        } catch (error) {
            console.error('[Summarizer] Error calling OpenAI:', error);
            console.error('[Summarizer] Error details:', {
                message: error.message,
                stack: error.stack
            });
            return null;
        }
    }

    parseResponse(content) {
        try {
            let cleaned = content.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
            }

            const parsed = JSON.parse(cleaned);

            if (!parsed.summary || !Array.isArray(parsed.followUpQuestions)) {
                console.warn('[Summarizer] Invalid response structure:', parsed);
                return null;
            }

            return parsed;

        } catch (error) {
            console.error('[Summarizer] Failed to parse LLM response:', error);
            console.error('[Summarizer] Raw content:', content);
            return null;
        }
    }

    reset() {
        this.transcriptionWindow = [];
        this.transcriptionCount = 0;
        this.allSummaries = [];
        this.allFollowUpQuestions.clear();
        console.log('[Summarizer] State reset');
    }

    getAllSummaries() {
        return [...this.allSummaries];
    }

    getAllFollowUpQuestions() {
        return Array.from(this.allFollowUpQuestions);
    }
}

export default Summarizer;
