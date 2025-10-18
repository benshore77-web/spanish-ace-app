export function normalizeSpanish(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "ny")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPercentage(value) {
  if (Number.isNaN(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export function pickAccuracyClass(score) {
  if (score >= 0.8) return "accuracy-good";
  if (score >= 0.5) return "accuracy-warning";
  return "accuracy-poor";
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

