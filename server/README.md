# Signally Token Server

A simple Express server that mints ephemeral OpenAI tokens for the Signally extension.

Set your OpenAI API key as an environment variable:
```bash
export OPENAI_API_KEY=sk-your-key-here
```

This server acts as a secure middleware that mints the ephemeral tokens so that the extension can use it without leaking the openAI key.
