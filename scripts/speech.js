const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;

export function isSpeechSupported() {
  return typeof SpeechRecognition !== "undefined";
}

export function listenForSpanish({
  language = "es-ES",
  maxAlternatives = 3
} = {}) {
  return new Promise((resolve, reject) => {
    if (!isSpeechSupported()) {
      reject(new Error("unsupported"));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = maxAlternatives;
    recognition.continuous = false;

    let finished = false;

    recognition.onresult = (event) => {
      if (finished) return;
      finished = true;
      const transcripts = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        for (let j = 0; j < result.length; j += 1) {
          transcripts.push({
            transcript: result[j].transcript.trim(),
            confidence: result[j].confidence
          });
        }
      }
      recognition.stop();
      resolve({ transcripts });
    };

    recognition.onerror = (event) => {
      if (finished) return;
      finished = true;
      const error = new Error(event.error || "speech-error");
      error.code = event.error;
      reject(error);
    };

    recognition.onend = () => {
      if (finished) return;
      finished = true;
      const error = new Error("no-speech");
      error.code = "no-speech";
      reject(error);
    };

    try {
      recognition.start();
    } catch (error) {
      finished = true;
      reject(error);
    }
  });
}
