# J.A.R.V.I.S. — Tony Stark style assistant

A full-stack Jarvis: Iron-Man HUD interface, voice input (wake word "Jarvis"), voice output (TTS), and an AI brain via an OpenAI-compatible API.

## What's included

- `server.js` — Express server, serves the HUD and proxies chat to an OpenAI-compatible API. Falls back to an offline rule-based mode when no API key is set.
- `public/` — HUD interface (HTML/CSS/JS), Web Speech API for STT + TTS, wake word, push-to-talk, quick commands.
- `.env.example` — configuration template.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file:
   ```bash
   cp .env.example .env
   ```
3. (Optional but recommended) Add an API key in `.env`:
   ```env
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```
   Without a key, Jarvis runs in offline mode with limited canned replies.
4. Start:
   ```bash
   npm start
   ```
   Open http://localhost:3000

## Voice

- **Input (STT):** uses the browser Web Speech API. Click "Listen" or press Space. Say the wake word **"Jarvis"** followed by your command, e.g. "Jarvis, what time is it?".
- **Output (TTS):** uses browser SpeechSynthesis. Toggle with "Voice: ON/OFF". Pick a voice and adjust rate/pitch in the right panel.
- For a more natural voice, you can swap browser TTS for an OpenAI TTS / ElevenLabs call in `speak()` (see below).

## API

- `GET /api/health` — status + whether an API key is configured.
- `POST /api/chat` — body `{ messages: [{role, content}], temperature }`. Returns `{ reply, source, model }`.

## Using a different LLM

Any OpenAI-compatible endpoint works. Set `OPENAI_BASE_URL` + `OPENAI_MODEL` + `OPENAI_API_KEY`:
- Ollama: run `ollama serve`, then `OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_API_KEY=ollama`, `OPENAI_MODEL=llama3.1`.
- Azure OpenAI: set base URL to your deployment endpoint.
- Groq / Together / etc.: their OpenAI-compatible URLs.

## Better voice (optional)

Replace `speak()` in `public/app.js` with a call to `/api/tts` that uses OpenAI TTS (`/v1/audio/speech`) or ElevenLabs, then play the returned audio. Add the endpoint in `server.js`.

## Permissions

The browser will ask for microphone permission on first "Listen". HTTPS (or localhost) is required for SpeechRecognition in most browsers. Chrome/Edge work best.

## Notes

- Wake word detection here is client-side keyword matching on the transcript. For a true always-on wake word, use a dedicated engine (Porcupine) in a native/Electron app.
- This is a demo assistant; do not expose the server publicly without auth.
