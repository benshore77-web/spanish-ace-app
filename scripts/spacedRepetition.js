import { normalizeSpanish } from "./utils.js";

const MINUTES = 60 * 1000;

export function evaluateAnswer(expected, received) {
  const cleanExpected = normalizeSpanish(expected);
  const cleanReceived = normalizeSpanish(received || "");
  const correct = cleanExpected === cleanReceived;
  const distance = levenshtein(cleanExpected, cleanReceived);
  const tolerance = Math.max(1, Math.floor(cleanExpected.length * 0.2));
  const almost = !correct && distance <= tolerance;
  return { correct, almost, distance };
}

export function updateProgress(word, isCorrect, grade = isCorrect ? 5 : 2) {
  const now = Date.now();
  const repetitions = isCorrect ? word.repetitions + 1 : 0;
  let efactor = word.efactor;
  let interval = word.interval || 5;

  const q = Math.max(0, Math.min(5, grade));
  efactor = Math.max(1.3, efactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (isCorrect) {
    if (repetitions === 1) {
      interval = 10; // minutes
    } else if (repetitions === 2) {
      interval = 12 * 60; // 12 hours
    } else {
      interval = Math.round((word.interval || 12 * 60) * efactor);
    }
  } else {
    interval = Math.max(5, Math.round((word.interval || 10) / 2));
  }

  const due = now + interval * MINUTES;

  return {
    repetitions,
    interval,
    efactor,
    due,
    lastReviewed: now,
    correct: word.correct + (isCorrect ? 1 : 0),
    incorrect: word.incorrect + (isCorrect ? 0 : 1),
    streak: isCorrect ? word.streak + 1 : 0
  };
}

export function scoreForWord(word) {
  const total = word.correct + word.incorrect;
  if (total === 0) return 0.5;
  return word.correct / total;
}

export function dueScore(word) {
  const now = Date.now();
  const timeDiff = word.due - now;
  if (timeDiff <= 0) return 1;
  const days = timeDiff / (24 * 60 * MINUTES);
  return Math.max(0, 1 - days / 7);
}

export function priorityScore(word) {
  const accuracy = scoreForWord(word);
  return (1 - accuracy) * 0.7 + dueScore(word) * 0.3 + (word.streak === 0 ? 0.1 : 0);
}

export function getDueWords(state, topicId) {
  const now = Date.now();
  return Object.values(state.words)
    .filter((word) => word.topicId === topicId)
    .sort((a, b) => (a.due || 0) - (b.due || 0) || scoreForWord(a) - scoreForWord(b))
    .filter((word) => !word.due || word.due <= now + 5 * MINUTES);
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}
