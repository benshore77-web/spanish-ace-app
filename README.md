# Spanish Ace

Spanish Ace is a futuristic heads-up-display style web app that helps Magnus (and other learners!) master Spanish vocabulary through spaced repetition, playful missions, and quick feedback.

## Features

- ✅ **Curriculum aligned topics** that match the supplied vocab sheet (ages & numbers, months, pets, descriptions, colours, high-frequency words, family sets, and full phrases).
- ✅ **Curriculum aligned topics** that match the supplied vocab sheet (ages & numbers, months, pets, descriptions, colours, high-frequency words, and more).
- ✅ **Three training levels**
  - *Level 1 – Acquire:* See and hear the Spanish straight away while deciding if it is locked in.
  - *Level 2 – Assemble:* Build the answer from scrambled Spanish letters.
  - *Level 3 – Deploy:* Type the Spanish with accent-aware tolerance.
- ✅ **Smart spaced repetition** that remembers performance, spaces reviews, and spotlights priority words on the dashboard.
- ✅ **Celebrations and cues** with HUD animations, synth sounds, and spoken pronunciation when answers are correct.
- ✅ **Optional pronunciation missions** – trigger a speech check at any level to compare your spoken Spanish (Web Speech API required).
- ✅ **Image/doc text extraction** via Tesseract.js so new vocabulary can be scanned, classified by topic, and added directly from the dashboard.
- ✅ **Progress intelligence** including mastery counts, accuracy, due items, recent missions, and topic-level analytics.

All data is stored in the browser’s `localStorage` so Magnus’ history carries between sessions on the same device.

## Getting started

1. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
2. Allow audio playback when prompted so pronunciation and celebration sounds can be heard.
3. Pick a level, select a topic from the **Topic Hangar**, and launch a mission!

### Adding new vocabulary

Use the **Intel Uplink** card to drop a scanned worksheet or photo. After OCR completes you can assign each line to a topic, tweak the English/Spanish pair, and add it to the deck instantly.

## Technology

This project is implemented with vanilla JavaScript, CSS, and HTML—no build step required. The only external dependency is the [Tesseract.js](https://github.com/naptha/tesseract.js/) CDN bundle that powers image text recognition directly in the browser.

## Development notes

- Spaced repetition is based on a simplified SM-2 algorithm with minute-level intervals for quicker short-term reinforcement.
- Pronunciation relies on the browser’s Web Speech API (`speechSynthesis`). On platforms without that API the app gracefully skips audio.
- Speaking checks use the Web Speech Recognition API (`SpeechRecognition`). If the API or microphone permissions aren’t available the UI falls back with guidance.
- Synth celebration/error tones are generated with the Web Audio API.

Enjoy the mission! 🚀
<!-- Updated: 18 Oct 2025 -->
