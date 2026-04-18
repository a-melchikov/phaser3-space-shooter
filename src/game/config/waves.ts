import type { BossId, WaveThemeId, WaveThemeTemplate } from "../types/combat";

export const FIXED_WAVE_THEMES: Partial<Record<number, WaveThemeId>> = {
  1: "onboarding",
  2: "swarm",
  3: "heavyIntro",
  4: "fastMix",
  6: "marksmanIntro",
  7: "rammerIntro",
  8: "mixedElite",
  9: "minefield",
  11: "siege",
  12: "tankWall",
  13: "mixedElite",
  14: "crossfire"
};

export const LATE_WAVE_THEME_ROTATION: readonly WaveThemeId[] = [
  "fastAssault",
  "sniperNest",
  "siege",
  "tankWall",
  "crossfire",
  "mixedElite",
  "bulwarkAssault",
  "minefield",
  "endlessMixer"
] as const;

export const BOSS_ORDER: readonly BossId[] = [
  "bulwarkHowitzer",
  "blinkReaver",
  "broodCarrier",
  "prismBeamArray",
  "aegisCoreMatrix"
] as const;

export const WAVE_THEME_TEMPLATES: Record<WaveThemeId, WaveThemeTemplate> = {
  onboarding: {
    id: "onboarding",
    label: "Разведка",
    batchSizeMin: 1,
    batchSizeMax: 2,
    batchDelayMinMs: 650,
    batchDelayMaxMs: 800,
    budgetMultiplier: 0.9,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "basic", weight: 5 },
      { archetype: "fast", weight: 1 }
    ],
    forcedBatches: [
      {
        enemies: [
          { archetype: "basic", lane: 1 },
          { archetype: "basic", lane: 3 }
        ],
        delayAfterMs: 760
      }
    ]
  },
  swarm: {
    id: "swarm",
    label: "Рой",
    batchSizeMin: 2,
    batchSizeMax: 3,
    batchDelayMinMs: 520,
    batchDelayMaxMs: 720,
    budgetMultiplier: 1.05,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "basic", weight: 3 },
      { archetype: "fast", weight: 4 }
    ]
  },
  heavyIntro: {
    id: "heavyIntro",
    label: "Тяжёлая линия",
    batchSizeMin: 1,
    batchSizeMax: 2,
    batchDelayMinMs: 560,
    batchDelayMaxMs: 760,
    budgetMultiplier: 1.05,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "basic", weight: 3 },
      { archetype: "fast", weight: 2 },
      { archetype: "heavy", weight: 2 }
    ],
    forcedBatches: [
      {
        enemies: [{ archetype: "heavy", lane: 2 }],
        delayAfterMs: 700
      }
    ]
  },
  fastMix: {
    id: "fastMix",
    label: "Быстрый микс",
    batchSizeMin: 2,
    batchSizeMax: 3,
    batchDelayMinMs: 480,
    batchDelayMaxMs: 680,
    budgetMultiplier: 1.1,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "basic", weight: 2 },
      { archetype: "fast", weight: 5 },
      { archetype: "heavy", weight: 1 }
    ]
  },
  marksmanIntro: {
    id: "marksmanIntro",
    label: "Снайперский нажим",
    batchSizeMin: 1,
    batchSizeMax: 2,
    batchDelayMinMs: 600,
    batchDelayMaxMs: 760,
    budgetMultiplier: 1.05,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "basic", weight: 3 },
      { archetype: "fast", weight: 2 },
      { archetype: "heavy", weight: 2 },
      { archetype: "sniper", weight: 1, minWave: 6 }
    ],
    forcedBatches: [
      {
        enemies: [{ archetype: "sniper", lane: 2 }],
        delayAfterMs: 760
      }
    ]
  },
  rammerIntro: {
    id: "rammerIntro",
    label: "Рывок",
    batchSizeMin: 2,
    batchSizeMax: 3,
    batchDelayMinMs: 420,
    batchDelayMaxMs: 620,
    budgetMultiplier: 1.15,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "basic", weight: 2 },
      { archetype: "fast", weight: 3 },
      { archetype: "kamikaze", weight: 2, minWave: 7 },
      { archetype: "heavy", weight: 1 }
    ],
    forcedBatches: [
      {
        enemies: [
          { archetype: "kamikaze", lane: 1 },
          { archetype: "kamikaze", lane: 3 }
        ],
        delayAfterMs: 720
      }
    ]
  },
  mixedElite: {
    id: "mixedElite",
    label: "Элитный состав",
    batchSizeMin: 2,
    batchSizeMax: 3,
    batchDelayMinMs: 430,
    batchDelayMaxMs: 620,
    budgetMultiplier: 1.2,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "heavy", weight: 3 },
      { archetype: "sniper", weight: 2, minWave: 8 },
      { archetype: "turret", weight: 2, minWave: 11 },
      { archetype: "tank", weight: 2, minWave: 12 }
    ]
  },
  minefield: {
    id: "minefield",
    label: "Минное поле",
    batchSizeMin: 1,
    batchSizeMax: 2,
    batchDelayMinMs: 560,
    batchDelayMaxMs: 720,
    budgetMultiplier: 1.08,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "basic", weight: 2 },
      { archetype: "fast", weight: 2 },
      { archetype: "mineLayer", weight: 3, minWave: 9 },
      { archetype: "heavy", weight: 1 }
    ],
    forcedBatches: [
      {
        enemies: [{ archetype: "mineLayer", lane: 2 }],
        delayAfterMs: 820
      }
    ]
  },
  siege: {
    id: "siege",
    label: "Осада",
    batchSizeMin: 1,
    batchSizeMax: 3,
    batchDelayMinMs: 450,
    batchDelayMaxMs: 660,
    budgetMultiplier: 1.18,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "heavy", weight: 3 },
      { archetype: "turret", weight: 2, minWave: 11 },
      { archetype: "sniper", weight: 1, minWave: 11 },
      { archetype: "fast", weight: 2 }
    ]
  },
  tankWall: {
    id: "tankWall",
    label: "Танковая стена",
    batchSizeMin: 1,
    batchSizeMax: 2,
    batchDelayMinMs: 500,
    batchDelayMaxMs: 720,
    budgetMultiplier: 1.2,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "tank", weight: 3, minWave: 12 },
      { archetype: "heavy", weight: 3 },
      { archetype: "turret", weight: 1, minWave: 11 }
    ],
    forcedBatches: [
      {
        enemies: [
          { archetype: "tank", lane: 1 },
          { archetype: "tank", lane: 3 }
        ],
        delayAfterMs: 860
      }
    ]
  },
  crossfire: {
    id: "crossfire",
    label: "Перекрёстный огонь",
    batchSizeMin: 2,
    batchSizeMax: 3,
    batchDelayMinMs: 420,
    batchDelayMaxMs: 640,
    budgetMultiplier: 1.2,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "sniper", weight: 2, minWave: 11 },
      { archetype: "turret", weight: 2, minWave: 11 },
      { archetype: "fast", weight: 2 },
      { archetype: "heavy", weight: 2 },
      { archetype: "mineLayer", weight: 1, minWave: 11 }
    ]
  },
  fastAssault: {
    id: "fastAssault",
    label: "Скоростной штурм",
    batchSizeMin: 2,
    batchSizeMax: 3,
    batchDelayMinMs: 360,
    batchDelayMaxMs: 560,
    budgetMultiplier: 1.25,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "fast", weight: 4 },
      { archetype: "kamikaze", weight: 3, minWave: 16 },
      { archetype: "sniper", weight: 1, minWave: 16 },
      { archetype: "heavy", weight: 1 }
    ]
  },
  sniperNest: {
    id: "sniperNest",
    label: "Гнездо стрелков",
    batchSizeMin: 1,
    batchSizeMax: 2,
    batchDelayMinMs: 500,
    batchDelayMaxMs: 680,
    budgetMultiplier: 1.16,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "sniper", weight: 3, minWave: 16 },
      { archetype: "turret", weight: 2, minWave: 16 },
      { archetype: "heavy", weight: 2 },
      { archetype: "fast", weight: 1 }
    ]
  },
  bulwarkAssault: {
    id: "bulwarkAssault",
    label: "Пролом",
    batchSizeMin: 1,
    batchSizeMax: 2,
    batchDelayMinMs: 430,
    batchDelayMaxMs: 620,
    budgetMultiplier: 1.28,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "tank", weight: 3, minWave: 16 },
      { archetype: "heavy", weight: 3 },
      { archetype: "kamikaze", weight: 1, minWave: 16 },
      { archetype: "turret", weight: 2, minWave: 16 }
    ]
  },
  endlessMixer: {
    id: "endlessMixer",
    label: "Смешанный натиск",
    batchSizeMin: 2,
    batchSizeMax: 3,
    batchDelayMinMs: 360,
    batchDelayMaxMs: 620,
    budgetMultiplier: 1.32,
    allowLaneReuse: false,
    weightedPool: [
      { archetype: "fast", weight: 2 },
      { archetype: "heavy", weight: 2 },
      { archetype: "sniper", weight: 2, minWave: 16 },
      { archetype: "kamikaze", weight: 2, minWave: 16 },
      { archetype: "mineLayer", weight: 1, minWave: 16 },
      { archetype: "turret", weight: 2, minWave: 16 },
      { archetype: "tank", weight: 1, minWave: 16 }
    ]
  },
  bossEncounter: {
    id: "bossEncounter",
    label: "Босс",
    batchSizeMin: 0,
    batchSizeMax: 0,
    batchDelayMinMs: 0,
    batchDelayMaxMs: 0,
    budgetMultiplier: 0,
    allowLaneReuse: true,
    weightedPool: []
  }
};
