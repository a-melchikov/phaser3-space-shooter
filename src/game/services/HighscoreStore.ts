import type { HighscoreEntry } from "../types/game";
import { HIGHSCORE_LIMIT, STORAGE_KEYS } from "../utils/constants";
import { sanitizeHighscoreEntry } from "../utils/helpers";

export class HighscoreStore {
  public static loadScores(): HighscoreEntry[] {
    this.migrateLegacyScores();

    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.highscores);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((entry) => sanitizeHighscoreEntry(entry))
        .filter((entry): entry is HighscoreEntry => entry !== null)
        .sort((left, right) => right.score - left.score)
        .slice(0, HIGHSCORE_LIMIT);
    } catch {
      return [];
    }
  }

  public static saveScore(entry: HighscoreEntry): HighscoreEntry[] {
    const sanitized = sanitizeHighscoreEntry(entry);
    if (!sanitized) {
      return this.loadScores();
    }

    const nextScores = [...this.loadScores(), sanitized]
      .sort((left, right) => right.score - left.score)
      .slice(0, HIGHSCORE_LIMIT);

    try {
      window.localStorage.setItem(STORAGE_KEYS.highscores, JSON.stringify(nextScores));
    } catch {
      // localStorage недоступен — игра продолжает работать без сохранения.
    }

    return nextScores;
  }

  public static migrateLegacyScores(): void {
    try {
      const hasNewScores = window.localStorage.getItem(STORAGE_KEYS.highscores);
      if (hasNewScores) {
        return;
      }

      const legacyRaw = window.localStorage.getItem(STORAGE_KEYS.legacyHighscores);
      if (!legacyRaw) {
        return;
      }

      const parsed = JSON.parse(legacyRaw);
      if (!Array.isArray(parsed)) {
        return;
      }

      const migrated = parsed
        .map((entry) => sanitizeHighscoreEntry(entry))
        .filter((entry): entry is HighscoreEntry => entry !== null)
        .sort((left, right) => right.score - left.score)
        .slice(0, HIGHSCORE_LIMIT);

      window.localStorage.setItem(STORAGE_KEYS.highscores, JSON.stringify(migrated));
    } catch {
      // Нечего мигрировать — безопасно продолжаем.
    }
  }
}
