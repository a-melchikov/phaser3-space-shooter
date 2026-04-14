import Phaser from "phaser";

import type { HighscoreEntry } from "../types/game";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomBetween(min: number, max: number): number {
  return Phaser.Math.FloatBetween(min, max);
}

export function randomInt(min: number, max: number): number {
  return Phaser.Math.Between(min, max);
}

export function chance(probability: number): boolean {
  return Math.random() < probability;
}

export function pickRandom<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

export function formatHighscoreDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "неизвестно";
  }
  return date.toLocaleDateString("ru-RU");
}

export function sanitizeHighscoreEntry(entry: Partial<HighscoreEntry>): HighscoreEntry | null {
  if (typeof entry.score !== "number" || typeof entry.wave !== "number" || typeof entry.date !== "string") {
    return null;
  }

  return {
    score: Math.max(0, Math.floor(entry.score)),
    wave: Math.max(1, Math.floor(entry.wave)),
    date: entry.date
  };
}
