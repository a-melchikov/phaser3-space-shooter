import type { HighscoreEntry, PracticeScoreEntry } from "../types/game";
import { HIGHSCORE_LIMIT, STORAGE_KEYS } from "../utils/constants";
import { sanitizeHighscoreEntry, sanitizePracticeScoreEntry } from "../utils/helpers";

export class PracticeScoreStore {
  public loadScores(): PracticeScoreEntry[] {
    this.migrateLegacyScores();

    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.practiceScores);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((entry) => sanitizePracticeScoreEntry(entry))
        .filter((entry): entry is PracticeScoreEntry => entry !== null)
        .sort((left, right) => right.score - left.score)
        .slice(0, HIGHSCORE_LIMIT);
    } catch {
      return [];
    }
  }

  public saveScore(entry: PracticeScoreEntry): PracticeScoreEntry[] {
    const sanitized = sanitizePracticeScoreEntry(entry);
    if (!sanitized) {
      return this.loadScores();
    }

    const nextScores = [...this.loadScores(), sanitized]
      .sort((left, right) => right.score - left.score)
      .slice(0, HIGHSCORE_LIMIT);

    try {
      window.localStorage.setItem(STORAGE_KEYS.practiceScores, JSON.stringify(nextScores));
    } catch {
      // Local practice history is optional and should not break gameplay.
    }

    return nextScores;
  }

  public migrateLegacyScores(): void {
    try {
      const hasPracticeScores = window.localStorage.getItem(STORAGE_KEYS.practiceScores);
      if (hasPracticeScores) {
        return;
      }

      const migratedFromCurrent = this.loadLegacyScores(STORAGE_KEYS.legacyPracticeScores);
      if (migratedFromCurrent.length > 0) {
        window.localStorage.setItem(STORAGE_KEYS.practiceScores, JSON.stringify(migratedFromCurrent));
        return;
      }

      const migratedFromLegacy = this.loadLegacyScores(STORAGE_KEYS.legacyHighscores);
      if (migratedFromLegacy.length > 0) {
        window.localStorage.setItem(STORAGE_KEYS.practiceScores, JSON.stringify(migratedFromLegacy));
      }
    } catch {
      // Legacy migration is best-effort only.
    }
  }

  private loadLegacyScores(storageKey: string): PracticeScoreEntry[] {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => sanitizeHighscoreEntry(entry))
      .filter((entry): entry is HighscoreEntry => entry !== null)
      .map((entry) => this.toPracticeScoreEntry(entry))
      .sort((left, right) => right.score - left.score)
      .slice(0, HIGHSCORE_LIMIT);
  }

  private toPracticeScoreEntry(entry: HighscoreEntry): PracticeScoreEntry {
    return {
      score: entry.score,
      wave: entry.wave,
      date: entry.date,
      playerLabel: "Локальная практика",
      mode: "guest",
      rankedEligible: false
    };
  }
}
