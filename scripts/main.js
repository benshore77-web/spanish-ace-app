import { TOPIC_DATA } from "./data.js";
import {
  loadProgress,
  saveProgress,
  ensureWord,
  getWordId,
  recordHistory,
  getRecentHistory,
  updateWord
} from "./storage.js";
import {
  evaluateAnswer,
  updateProgress,
  scoreForWord,
  priorityScore
} from "./spacedRepetition.js";
import {
  formatPercentage,
  pickAccuracyClass,
  formatTimestamp,
  shuffleArray
} from "./utils.js";
import { triggerCelebration } from "./celebration.js";
import { playCelebrationTone, playErrorTone, speakSpanish } from "./audio.js";
import { isSpeechSupported, listenForSpanish } from "./speech.js";

const LEVELS = [
  { id: 1, label: "Level 1", tagline: "Acquire", description: "See the Spanish and hear it." },
  { id: 2, label: "Level 2", tagline: "Assemble", description: "Build the Spanish from scrambled letters." },
  { id: 3, label: "Level 3", tagline: "Deploy", description: "Type the Spanish perfectly." }
];

const AppState = {
  level: 1,
  progress: loadProgress(),
  currentSession: null,
  topics: [...TOPIC_DATA]
};

const elements = {};

function isPhrase(word) {
  if (!word || !word.spanish) return false;
  return word.spanish.trim().includes(" ");
}

function getScrambleUnits(word) {
  if (!word || !word.spanish) return [];
  const trimmed = word.spanish.trim();
  if (!trimmed) return [];

  if (isPhrase(word)) {
    return trimmed.split(/\s+/).map((unit, index) => ({
      key: `phrase-${index}`,
      value: unit,
      display: unit
    }));
  }

  return Array.from(word.spanish).map((char, index) => ({
    key: `char-${index}`,
    value: char,
    display: char === " " ? "␣" : char
  }));
}

function init() {
  cacheElements();
  hydrateProgress();
  renderLevelSelect();
  renderDashboard();
  wireUpload();
}

function cacheElements() {
  elements.levelSelect = document.getElementById("level-select");
  elements.summaryPanel = document.getElementById("summary-panel");
  elements.topicsList = document.getElementById("topics-list");
  elements.priorityWords = document.getElementById("priority-words");
  elements.recentHistory = document.getElementById("recent-history");
  elements.sessionLayer = document.getElementById("session-layer");
  elements.uploadInput = document.getElementById("vocab-upload");
  elements.uploadStatus = document.getElementById("upload-status");
  elements.uploadResults = document.getElementById("upload-results");
}

function hydrateProgress() {
  AppState.topics.forEach((topic) => {
    topic.words.forEach((word) => ensureWord(AppState.progress, topic.id, word));
  });
  saveProgress(AppState.progress);
}

function renderLevelSelect() {
  elements.levelSelect.innerHTML = "";
  LEVELS.forEach((level) => {
    const button = document.createElement("button");
    button.textContent = `${level.label} · ${level.tagline}`;
    button.title = level.description;
    if (AppState.level === level.id) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      AppState.level = level.id;
      renderLevelSelect();
      if (AppState.currentSession) {
        closeSession();
      }
    });
    elements.levelSelect.appendChild(button);
  });
}

function renderDashboard() {
  renderSummary();
  renderTopics();
  renderPriorityWords();
  renderHistory();
}

function renderSummary() {
  const words = Object.values(AppState.progress.words);
  const totalWords = words.length;
  const mastered = words.filter((word) => word.repetitions >= 3 && scoreForWord(word) >= 0.85).length;
  const accuracy = words.length
    ? words.reduce((acc, word) => acc + scoreForWord(word), 0) / words.length
    : 0;
  const dueSoon = words.filter((word) => word.due && word.due <= Date.now()).length;

  const summaryCards = [
    {
      title: "Total Words",
      value: totalWords,
      detail: "Across all mission topics."
    },
    {
      title: "Mastered",
      value: mastered,
      detail: "Words reviewed successfully 3+ times."
    },
    {
      title: "Accuracy",
      value: formatPercentage(accuracy),
      detail: "Overall success rate across sessions."
    },
    {
      title: "Due Now",
      value: dueSoon,
      detail: "Words waiting for review right now."
    }
  ];

  elements.summaryPanel.innerHTML = summaryCards
    .map(
      (card) => `
        <article class="summary-card">
          <h3>${card.title}</h3>
          <p class="summary-value">${card.value}</p>
          <p class="summary-detail">${card.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderTopics() {
  const now = Date.now();
  elements.topicsList.innerHTML = "";

  AppState.topics.forEach((topic) => {
    topic.words.forEach((word) => ensureWord(AppState.progress, topic.id, word));
    const topicWords = topic.words.map((word) => AppState.progress.words[getWordId(topic.id, word.english)]);
    const reviewedWords = topicWords.filter(Boolean);
    const completed = reviewedWords.filter((word) => word.repetitions >= 3 && scoreForWord(word) >= 0.85).length;
    const due = reviewedWords.filter((word) => word.due && word.due <= now).length;
    const accuracy = reviewedWords.length
      ? reviewedWords.reduce((acc, word) => acc + scoreForWord(word), 0) / reviewedWords.length
      : 0;

    const wrapper = document.createElement("div");
    wrapper.className = "topic-card";
    wrapper.innerHTML = `
      <div class="topic-header">
        <h3>${topic.title}</h3>
        <span>${topic.words.length} words</span>
      </div>
      <div class="topic-meta">
        <span>Due: <strong>${due}</strong></span>
        <span>Mastered: <strong>${completed}</strong></span>
        <span class="${pickAccuracyClass(accuracy)}">Accuracy: ${formatPercentage(accuracy)}</span>
      </div>
      <div class="topic-progress">
        <div class="topic-progress-bar" style="width: ${Math.round(
          (completed / topic.words.length) * 100
        )}%"></div>
      </div>
      <p>${topic.description}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "topic-actions";
    const startButton = document.createElement("button");
    startButton.textContent = "Launch Mission";
    startButton.addEventListener("click", () => startSession(topic.id));
    actions.appendChild(startButton);
    wrapper.appendChild(actions);
    elements.topicsList.appendChild(wrapper);
  });
}

function renderPriorityWords() {
  const words = Object.values(AppState.progress.words);
  if (!words.length) {
    elements.priorityWords.innerHTML = "<p>No words yet. Start a mission to begin!</p>";
    return;
  }
  const ranked = [...words]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 6);
  if (!ranked.length) {
    elements.priorityWords.innerHTML = "<p>Great work! No priority words right now.</p>";
    return;
  }
  elements.priorityWords.innerHTML = ranked
    .map((word) => {
      const topic = AppState.topics.find((item) => item.id === word.topicId);
      const accuracy = scoreForWord(word);
      return `
        <div class="priority-word">
          <div class="word-info">
            <strong>${word.english}</strong>
            <span>${word.spanish}</span>
            <div class="word-meta">
              <span>${topic ? topic.title : "Unknown Topic"}</span>
              <span class="${pickAccuracyClass(accuracy)}">${formatPercentage(accuracy)} accuracy</span>
            </div>
          </div>
          <span>Due ${
            !word.due || word.due <= Date.now()
              ? "now"
              : new Date(word.due).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }</span>
        </div>
      `;
    })
    .join("");
}

function renderHistory() {
  const history = getRecentHistory(AppState.progress, 10);
  if (!history.length) {
    elements.recentHistory.innerHTML = "<p>No missions flown yet. Select a topic to start!</p>";
    return;
  }
  elements.recentHistory.innerHTML = history
    .map((entry) => {
      return `
        <div class="history-entry">
          <span class="label">${entry.topicTitle} · Level ${entry.level}</span>
          <span>${entry.english} → ${entry.spanish}</span>
          <span class="label">Outcome</span>
          <span class="${entry.correct ? "accuracy-good" : "accuracy-poor"}">${
            entry.correct ? "Success" : "Retry"
          }</span>
          <span class="label">When</span>
          <span>${formatTimestamp(entry.timestamp)}</span>
        </div>
      `;
    })
    .join("");
}

function startSession(topicId) {
  const topic = AppState.topics.find((item) => item.id === topicId);
  if (!topic) return;

  const queue = topic.words
    .map((word) => ensureWord(AppState.progress, topic.id, word))
    .sort((a, b) => (a.due || 0) - (b.due || 0));

  const dueNow = queue.filter((word) => !word.due || word.due <= Date.now());
  const upcoming = queue.filter((word) => word.due && word.due > Date.now());
  const planned = [...dueNow, ...upcoming.slice(0, Math.max(0, 6 - dueNow.length))];

  if (!planned.length) {
    showModalMessage(
      `${topic.title}`,
      "All words are resting right now. Check back soon or try another topic!"
    );
    return;
  }

  AppState.currentSession = {
    topic,
    queue: planned,
    asked: 0,
    correct: 0,
    feedbackTimeout: null,
    scramble: null
  };

  elements.sessionLayer.classList.remove("hidden");
  renderSessionCard();
}

function closeSession() {
  if (AppState.currentSession && AppState.currentSession.feedbackTimeout) {
    clearTimeout(AppState.currentSession.feedbackTimeout);
  }
  AppState.currentSession = null;
  elements.sessionLayer.classList.add("hidden");
  elements.sessionLayer.innerHTML = "";
}

function renderSessionCard() {
  const session = AppState.currentSession;
  if (!session) return;
  if (!session.queue.length) {
    elements.sessionLayer.innerHTML = `
      <div class="session-card">
        <div class="session-header">
          <span>${session.topic.title}</span>
          <span>Mission Complete</span>
        </div>
        <p class="prompt-text">Great flying, Magnus!</p>
        <p class="summary-detail">${session.correct} correct out of ${session.asked} attempts.</p>
        <div class="session-actions">
          <button class="button-success">Back to dashboard</button>
        </div>
      </div>
    `;
    elements.sessionLayer.querySelector("button").addEventListener("click", () => {
      closeSession();
      renderDashboard();
    });
    return;
  }

  const current = session.queue[0];
  const header = `Level ${AppState.level} · ${LEVELS.find((l) => l.id === AppState.level).tagline}`;
  const missionDetail = isPhrase(current)
    ? '<p class="session-detail">Sentence mission: combine vocab to answer fluently.</p>'
    : "";

  let bodyContent = "";
  if (AppState.level === 1) {
    bodyContent = renderLevelOne(current);
  } else if (AppState.level === 2) {
    bodyContent = renderLevelTwo(current);
  } else {
    bodyContent = renderLevelThree(current);
  }

  elements.sessionLayer.innerHTML = `
    <div class="session-card" data-word-id="${current.id}">
      <div class="session-header">
        <span>${session.topic.title}</span>
        <span>${header}</span>
      </div>
      <div class="session-progress">Question ${session.asked + 1}</div>
      ${missionDetail}
      ${bodyContent}
      <div class="feedback-message" id="session-feedback"></div>
      <div class="session-actions" id="session-actions"></div>
      <div class="speech-eval" id="speech-eval"></div>
      <button class="session-close" aria-label="Close session">✕</button>
    </div>
  `;

  elements.sessionLayer.querySelector(".session-close").addEventListener("click", closeSession);
  setupSessionActions(current);

  if (AppState.level === 1) {
    speakSpanish(current.spanish);
  }
}

function renderLevelOne(word) {
  return `
    <div class="prompt">
      <p class="prompt-text">${word.english}</p>
      <p class="answer-text">${word.spanish}</p>
      <button class="button-success" id="pronounce-btn">Play pronunciation</button>
    </div>
  `;
}

function renderLevelTwo(word) {
  const units = getScrambleUnits(word);
  const shuffled = shuffleArray(units);
  const mode = isPhrase(word) ? "phrase" : "letters";
  return `
    <div class="prompt">
      <p class="prompt-text">${word.english}</p>
      <div class="scramble-area" data-target="${word.spanish}" data-mode="${mode}">
        <div class="scramble-output" id="scramble-output"></div>
        <div class="scramble-letters">
          ${shuffled
            .map(
              (item) =>
                `<button data-unit="${encodeURIComponent(item.value)}" data-key="${item.key}">${item.display}</button>`
            )
            .join("")}
        </div>
        <button class="button-danger" id="scramble-reset">Reset</button>
        ${mode === "phrase" ? '<p class="scramble-hint">Tap the words in order to rebuild the sentence.</p>' : ""}
      </div>
    </div>
  `;
}

function renderLevelThree(word) {
  return `
    <div class="prompt">
      <p class="prompt-text">${word.english}</p>
      <div class="input-area">
        <input type="text" id="typed-answer" placeholder="Type the Spanish" autocomplete="off" />
      </div>
    </div>
  `;
}

function setupSessionActions(word) {
  const actions = elements.sessionLayer.querySelector("#session-actions");
  const feedback = elements.sessionLayer.querySelector("#session-feedback");

  if (AppState.level === 1) {
    const again = document.createElement("button");
    again.className = "button-danger";
    again.textContent = "Need more practice";
    again.addEventListener("click", () => handleSessionResult(word, false, "Logged for more practice."));

    const good = document.createElement("button");
    good.className = "button-success";
    good.textContent = "I nailed it";
    good.addEventListener("click", () => handleSessionResult(word, true, "Locked in!"));

    actions.append(again, good);

    const pronounceBtn = elements.sessionLayer.querySelector("#pronounce-btn");
    if (pronounceBtn) {
      pronounceBtn.addEventListener("click", () => speakSpanish(word.spanish));
    }
  }

  if (AppState.level === 2) {
    const output = elements.sessionLayer.querySelector("#scramble-output");
    const buttons = [...elements.sessionLayer.querySelectorAll(".scramble-letters button")];
    const reset = elements.sessionLayer.querySelector("#scramble-reset");
    const used = new Set();
    const area = elements.sessionLayer.querySelector(".scramble-area");
    const mode = area?.dataset.mode || "letters";
    const selection = [];

    buttons.forEach((btn, index) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key ?? String(index);
        if (used.has(key)) return;
        used.add(key);
        const unit = decodeURIComponent(btn.dataset.unit || "");
        if (mode === "phrase") {
          selection.push(unit);
          output.textContent = selection.join(" ");
        } else {
          selection.push(unit === " " ? " " : unit);
          output.textContent = selection.join("");
        }
        btn.disabled = true;
      });
    });

    reset.addEventListener("click", () => {
      output.textContent = "";
      used.clear();
      selection.length = 0;
      buttons.forEach((btn) => {
        btn.disabled = false;
      });
    });

    const submit = document.createElement("button");
    submit.className = "button-success";
    submit.textContent = "Submit";
    submit.addEventListener("click", () => {
      const attempt = (mode === "phrase"
        ? selection.join(" ")
        : selection.join("")
      ).trim();
      if (!attempt) {
        feedback.textContent = mode === "phrase" ? "Assemble the sentence first." : "Assemble the word first.";
        return;
      }
      const result = evaluateAnswer(word.spanish, attempt);
      handleSessionResult(word, result.correct, result.correct ? "Perfect!" : "Let's try that again.", {
        attempt,
        result
      });
    });

    const surrender = document.createElement("button");
    surrender.className = "button-danger";
    surrender.textContent = "Reveal";
    surrender.addEventListener("click", () => {
      feedback.textContent = `The answer is ${word.spanish}.`;
      handleSessionResult(word, false, "We'll revisit this soon.");
    });

    actions.append(surrender, submit);
  }

  if (AppState.level === 3) {
    const input = elements.sessionLayer.querySelector("#typed-answer");
    input.focus();
    const submit = document.createElement("button");
    submit.className = "button-success";
    submit.textContent = "Check";
    submit.addEventListener("click", () => {
      const attempt = input.value.trim();
      if (!attempt) {
        feedback.textContent = "Type your best guess first.";
        return;
      }
      const result = evaluateAnswer(word.spanish, attempt);
      handleSessionResult(
        word,
        result.correct,
        result.correct ? "Correct!" : result.almost ? "So close!" : "Not quite.",
        { attempt, result }
      );
    });

    const giveUp = document.createElement("button");
    giveUp.className = "button-danger";
    giveUp.textContent = "Reveal";
    giveUp.addEventListener("click", () => {
      feedback.textContent = `It's ${word.spanish}. Keep going!`;
      handleSessionResult(word, false, "Logged for review.");
    });

    actions.append(giveUp, submit);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        submit.click();
      }
    });
  }

  setupSpeechTest(word);
}

function handleSessionResult(word, isCorrect, message, extras = {}) {
  const session = AppState.currentSession;
  if (!session) return;
  const feedback = elements.sessionLayer.querySelector("#session-feedback");

  const updatedWord = updateWord(AppState.progress, word.id, (existing) =>
    updateProgress(existing, isCorrect)
  );
  const effectiveWord = updatedWord || word;
  recordHistory(AppState.progress, {
    topicId: session.topic.id,
    topicTitle: session.topic.title,
    english: effectiveWord.english,
    spanish: effectiveWord.spanish,
    level: AppState.level,
    correct: isCorrect,
    attempt: extras.attempt || null
  });
  saveProgress(AppState.progress);

  session.asked += 1;
  if (isCorrect) session.correct += 1;

  if (isCorrect) {
    if (AppState.level >= 2) {
      speakSpanish(effectiveWord.spanish);
      setTimeout(() => {
        triggerCelebration();
        playCelebrationTone();
      }, 450);
    } else {
      triggerCelebration();
      playCelebrationTone();
    }
    feedback.textContent = message;
    feedback.classList.remove("accuracy-poor");
    feedback.classList.add("accuracy-good");
  } else {
    playErrorTone();
    const reveal = message.includes(effectiveWord.spanish)
      ? message
      : `${message} Answer: ${effectiveWord.spanish}.`;
    feedback.textContent = reveal;
    feedback.classList.remove("accuracy-good");
    feedback.classList.add("accuracy-poor");
  }

  session.queue.shift();
  if (!isCorrect) {
    session.queue.splice(1, 0, effectiveWord);
  }

  renderDashboard();

  if (session.feedbackTimeout) {
    clearTimeout(session.feedbackTimeout);
  }
  session.feedbackTimeout = setTimeout(() => {
    renderSessionCard();
  }, isCorrect ? 1200 : 900);
}

function setupSpeechTest(word) {
  const speechContainer = elements.sessionLayer.querySelector("#speech-eval");
  if (!speechContainer) return;

  const phraseMode = isPhrase(word);

  speechContainer.innerHTML = "";

  if (!isSpeechSupported()) {
    const status = document.createElement("p");
    status.className = "speech-status muted";
    status.textContent = "Speech recognition is not available on this device.";
    speechContainer.appendChild(status);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "🎙️ Pronunciation check";

  const status = document.createElement("p");
  status.className = "speech-status muted";
  status.textContent = phraseMode
    ? "Tap to check how your sentence sounds."
    : "Tap to compare your pronunciation.";

  const transcriptsList = document.createElement("ul");
  transcriptsList.className = "speech-transcripts";
  transcriptsList.hidden = true;

  const resetState = () => {
    speechContainer.classList.remove("speech-success", "speech-warning", "speech-error");
    transcriptsList.innerHTML = "";
    transcriptsList.hidden = true;
  };

  const showTranscripts = (entries = []) => {
    transcriptsList.innerHTML = "";
    if (!entries.length) {
      transcriptsList.hidden = true;
      return;
    }
    transcriptsList.hidden = false;
    entries.forEach((item) => {
      const li = document.createElement("li");
      if (item.result?.correct) {
        li.classList.add("match-correct");
      } else if (item.result?.almost) {
        li.classList.add("match-almost");
      } else {
        li.classList.add("match-miss");
      }
      const transcriptLine = document.createElement("span");
      transcriptLine.className = "transcript";
      transcriptLine.textContent = item.text;
      li.appendChild(transcriptLine);

      if (Number.isFinite(item.confidence)) {
        const confidence = Math.round(item.confidence * 100);
        const confidenceLine = document.createElement("span");
        confidenceLine.className = "confidence";
        confidenceLine.textContent = `Confidence ${confidence}%`;
        li.appendChild(confidenceLine);
      }

      transcriptsList.appendChild(li);
    });
  };

  speechContainer.append(button, status, transcriptsList);

  button.addEventListener("click", async () => {
    resetState();
    button.disabled = true;
    status.classList.remove("muted");
    status.textContent = phraseMode
      ? "Listening… say the full sentence in Spanish now."
      : "Listening… say it in Spanish now.";
    try {
      const { transcripts } = await listenForSpanish();
      if (!transcripts || !transcripts.length) {
        speechContainer.classList.add("speech-warning");
        status.textContent = "I couldn't hear that. Try again.";
        showTranscripts([]);
        return;
      }

      const scored = transcripts.map((entry) => ({
        text: entry.transcript,
        confidence: entry.confidence,
        result: evaluateAnswer(word.spanish, entry.transcript)
      }));

      showTranscripts(scored);

      const perfect = scored.find((item) => item.result.correct);
      if (perfect) {
        speechContainer.classList.add("speech-success");
        status.textContent = phraseMode
          ? `Great pronunciation! I heard “${perfect.text}”.`
          : `Great pronunciation! I heard “${perfect.text}”.`;
        return;
      }

      const almost = scored.find((item) => item.result.almost);
      if (almost) {
        speechContainer.classList.add("speech-warning");
        status.textContent = phraseMode
          ? `Almost there! I heard “${almost.text}”. Smooth it out.`
          : `Almost! I heard “${almost.text}”. Check the sounds.`;
        return;
      }

      const heard = scored[0]?.text;
      speechContainer.classList.add("speech-error");
      if (heard) {
        status.textContent = phraseMode
          ? `I heard “${heard}”. Let's try the full sentence again.`
          : `I heard “${heard}”. Let's try again for ${word.spanish}.`;
      } else {
        status.textContent = "Let's try that again—no match this time.";
      }
    } catch (error) {
      speechContainer.classList.add("speech-error");
      showTranscripts([]);
      if (error.code === "not-allowed" || error.code === "service-not-allowed") {
        status.textContent = "Allow microphone access to try the speaking test.";
      } else if (error.code === "no-speech") {
        status.textContent = "I didn't catch anything. Try again.";
      } else if (error.code === "aborted") {
        status.textContent = "Listening cancelled. Give it another go.";
      } else if (error.message === "unsupported") {
        status.textContent = "Speech recognition is not supported in this browser.";
      } else {
        status.textContent = "Something interrupted the speech test. Try again.";
      }
    } finally {
      button.disabled = false;
    }
  });
}

function showModalMessage(title, message) {
  elements.sessionLayer.classList.remove("hidden");
  elements.sessionLayer.innerHTML = `
    <div class="session-card">
      <div class="session-header">
        <span>${title}</span>
        <span>Info</span>
      </div>
      <p class="prompt-text">${message}</p>
      <div class="session-actions">
        <button class="button-success">Got it</button>
      </div>
    </div>
  `;
  elements.sessionLayer.querySelector("button").addEventListener("click", () => {
    closeSession();
  });
}

function wireUpload() {
  if (!elements.uploadInput) return;
  elements.uploadInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    elements.uploadStatus.textContent = "Scanning new intel...";
    elements.uploadResults.innerHTML = "";
    try {
      if (!window.Tesseract) {
        elements.uploadStatus.textContent = "Tesseract library is still loading. Try again in a moment.";
        return;
      }
      const { data } = await window.Tesseract.recognize(file, "spa+eng", {
        logger: (info) => {
          if (info.status === "recognizing text") {
            elements.uploadStatus.textContent = `Processing: ${Math.round(info.progress * 100)}%`;
          }
        }
      });
      elements.uploadStatus.textContent = "Extraction complete. Organise the vocab below.";
      const lines = data.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 2);
      if (!lines.length) {
        elements.uploadResults.innerHTML = "<p>No text detected. Try a clearer image.</p>";
        return;
      }
      renderUploadResults(lines);
    } catch (error) {
      console.error(error);
      elements.uploadStatus.textContent = "Could not read the file. Please try again.";
    }
    event.target.value = "";
  });
}

function renderUploadResults(lines) {
  elements.uploadResults.innerHTML = lines
    .map((line, index) => {
      return `
        <div class="extracted-word" data-index="${index}">
          <header>
            <span>Detected text</span>
            <select data-role="topic">
              ${AppState.topics
                .map((topic) => `<option value="${topic.id}">${topic.title}</option>`)
                .join("")}
            </select>
          </header>
          <input type="text" data-role="english" placeholder="English" />
          <input type="text" data-role="spanish" placeholder="Spanish" value="${line}" />
          <button data-role="save">Add to topic</button>
        </div>
      `;
    })
    .join("");

  elements.uploadResults.querySelectorAll("[data-role='save']").forEach((button) => {
    button.addEventListener("click", () => {
      const container = button.closest(".extracted-word");
      const english = container.querySelector("[data-role='english']").value.trim();
      const spanish = container.querySelector("[data-role='spanish']").value.trim();
      const topicId = container.querySelector("[data-role='topic']").value;
      if (!english || !spanish) {
        container.classList.add("shake");
        setTimeout(() => container.classList.remove("shake"), 400);
        return;
      }
      addCustomWord(topicId, { english, spanish });
      container.innerHTML = `<p>${english} → ${spanish} has been added to ${
        AppState.topics.find((topic) => topic.id === topicId)?.title
      }.</p>`;
      renderDashboard();
    });
  });
}

function addCustomWord(topicId, word) {
  const topic = AppState.topics.find((item) => item.id === topicId);
  if (!topic) return;
  const exists = topic.words.some(
    (entry) => entry.english.toLowerCase() === word.english.toLowerCase()
  );
  if (!exists) {
    topic.words.push(word);
  }
  const progressWord = ensureWord(AppState.progress, topicId, word);
  progressWord.spanish = word.spanish;
  progressWord.english = word.english;
  saveProgress(AppState.progress);
}

window.addEventListener("DOMContentLoaded", init);
