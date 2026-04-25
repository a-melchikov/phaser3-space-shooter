import { BOSS_REPEAT_START_WAVE, BOSS_TRANSITION_MS, WAVE_TRANSITION_MS, getProgressionStageConfig, isBossWave, isEliteWave } from "../config/combat";
import { ENEMY_BUDGET_COSTS, getEnemyRole } from "../config/enemies";
import { BOSS_ORDER, FIXED_WAVE_THEMES, LATE_WAVE_THEME_ROTATION, WAVE_THEME_TEMPLATES } from "../config/waves";
import type {
  BossId,
  EnemyArchetypeId,
  EnemyVariant,
  PlannedEnemySpawn,
  ProgressionStageConfig,
  SpawnBatch,
  WaveKind,
  WavePlan,
  WaveThemeId,
  WaveThemeTemplate,
  WeightedEnemyPick
} from "../types/combat";
import { pickRandom, randomInt } from "../utils/helpers";

const ELITE_WAVE_WEIGHT_BONUS: Partial<Record<EnemyArchetypeId, number>> = {
  heavy: 1.25,
  sniper: 1.35,
  turret: 1.45,
  tank: 1.45
};

export class WavePlanner {
  private previousLateTheme: WaveThemeId | undefined;

  public createPlan(wave: number): WavePlan {
    const stageConfig = getProgressionStageConfig(wave);

    if (isBossWave(wave)) {
      return this.createBossPlan(wave, stageConfig);
    }

    const kind: WaveKind = isEliteWave(wave) ? "elite" : "normal";
    const theme = this.pickTheme(wave, kind);
    const template = WAVE_THEME_TEMPLATES[theme];
    const spawnBatches = this.buildBatches(wave, kind, stageConfig, template);

    return {
      wave,
      stage: stageConfig.id,
      kind,
      theme,
      bannerText: kind === "elite" ? `Волна ${wave} • элита` : `Волна ${wave}`,
      subtitle: template.label,
      caps: stageConfig.caps,
      dropBonus: stageConfig.dropBonus,
      spawnBatches,
      bossCycle: 0
    };
  }

  private createBossPlan(wave: number, stageConfig: ProgressionStageConfig): WavePlan {
    const bossNumber = Math.floor(wave / 5) - 1;
    const bossCycle = Math.max(0, Math.floor(bossNumber / BOSS_ORDER.length));
    const bossIndex = ((bossNumber % BOSS_ORDER.length) + BOSS_ORDER.length) % BOSS_ORDER.length;
    const bossId = BOSS_ORDER[bossIndex];
    const repeatCycle = wave >= BOSS_REPEAT_START_WAVE ? bossCycle : 0;

    return {
      wave,
      stage: stageConfig.id,
      kind: "boss",
      theme: "bossEncounter",
      bannerText: `Волна ${wave} • босс`,
      subtitle: this.getBossSubtitle(bossId, repeatCycle),
      caps: stageConfig.caps,
      dropBonus: stageConfig.dropBonus,
      spawnBatches: [],
      bossId,
      bossCycle: repeatCycle
    };
  }

  public getTransitionDuration(plan: WavePlan): number {
    return plan.kind === "boss" ? BOSS_TRANSITION_MS : WAVE_TRANSITION_MS;
  }

  private pickTheme(wave: number, kind: WaveKind): WaveThemeId {
    const fixedTheme = FIXED_WAVE_THEMES[wave];
    if (fixedTheme) {
      this.previousLateTheme = fixedTheme;
      return fixedTheme;
    }

    if (kind === "elite") {
      this.previousLateTheme = "mixedElite";
      return "mixedElite";
    }

    const rotationStart = Math.max(0, wave - 16);
    let theme = LATE_WAVE_THEME_ROTATION[rotationStart % LATE_WAVE_THEME_ROTATION.length];
    if (theme === this.previousLateTheme) {
      theme = LATE_WAVE_THEME_ROTATION[(rotationStart + 1) % LATE_WAVE_THEME_ROTATION.length];
    }

    this.previousLateTheme = theme;
    return theme;
  }

  private buildBatches(
    wave: number,
    kind: WaveKind,
    stageConfig: ProgressionStageConfig,
    template: WaveThemeTemplate
  ): SpawnBatch[] {
    const batches: SpawnBatch[] = [];
    const spawnCounts = new Map<string, number>();
    let remainingBudget = this.getWaveBudget(wave, kind, stageConfig, template);

    template.forcedBatches?.forEach((seed) => {
      const enemies = seed.enemies.map((entry) => this.createPlannedSpawn(
        entry.archetype,
        entry.variant ?? this.resolveVariant(entry.archetype, wave, kind, stageConfig, spawnCounts),
        entry.lane,
        "wave"
      ));
      enemies.forEach((enemy) => {
        remainingBudget -= this.getSpawnCost(enemy.archetype, enemy.variant);
        this.bumpSpawnCount(spawnCounts, enemy.archetype, enemy.variant);
      });
      batches.push({
        enemies,
        delayAfterMs: seed.delayAfterMs,
        allowLaneReuse: seed.allowLaneReuse
      });
    });

    let laneCursor = randomInt(0, 4);
    while (remainingBudget > 0.8) {
      const batchSize = Math.max(template.batchSizeMin, Math.min(template.batchSizeMax, remainingBudget < 2 ? 1 : randomInt(template.batchSizeMin, template.batchSizeMax)));
      const usedLanes = new Set<number>();
      const enemies: PlannedEnemySpawn[] = [];

      for (let index = 0; index < batchSize; index += 1) {
        const pick = this.pickWeightedEnemy(template.weightedPool, wave, kind, spawnCounts);
        if (!pick) {
          break;
        }

        const variant = this.resolveVariant(pick.archetype, wave, kind, stageConfig, spawnCounts, pick.variant);
        const cost = this.getSpawnCost(pick.archetype, variant);
        if (cost > remainingBudget && enemies.length > 0) {
          break;
        }

        const lane = this.pickLane(usedLanes, laneCursor, template.allowLaneReuse);
        laneCursor = (lane + 2) % 5;
        const enemy = this.createPlannedSpawn(pick.archetype, variant, lane, "wave");
        enemies.push(enemy);
        usedLanes.add(lane);
        remainingBudget -= cost;
        this.bumpSpawnCount(spawnCounts, pick.archetype, variant);
      }

      if (enemies.length === 0) {
        break;
      }

      batches.push({
        enemies,
        delayAfterMs: randomInt(template.batchDelayMinMs, template.batchDelayMaxMs),
        allowLaneReuse: template.allowLaneReuse
      });
    }

    return batches;
  }

  private getWaveBudget(
    wave: number,
    kind: WaveKind,
    stageConfig: ProgressionStageConfig,
    template: WaveThemeTemplate
  ): number {
    const baseBudget = stageConfig.budgetBase + (wave - stageConfig.minWave) * stageConfig.budgetPerWave;
    const eliteBonus = kind === "elite" ? 2.5 : 0;
    return baseBudget * template.budgetMultiplier + eliteBonus;
  }

  private pickWeightedEnemy(
    pool: readonly WeightedEnemyPick[],
    wave: number,
    kind: WaveKind,
    spawnCounts: Map<string, number>
  ): WeightedEnemyPick | null {
    const weighted: Array<{ pick: WeightedEnemyPick; weight: number }> = [];

    pool.forEach((pick) => {
      if (pick.minWave !== undefined && wave < pick.minWave) {
        return;
      }

      const variant = pick.variant ?? "normal";
      const count = this.getSpawnCount(spawnCounts, pick.archetype, variant);
      if (!this.canAddMoreOfType(wave, pick.archetype, variant, count)) {
        return;
      }

      const weightBonus = kind === "elite" ? (ELITE_WAVE_WEIGHT_BONUS[pick.archetype] ?? 1) : 1;
      weighted.push({ pick, weight: pick.weight * weightBonus });
    });

    if (weighted.length === 0) {
      return null;
    }

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let threshold = Math.random() * totalWeight;

    for (const entry of weighted) {
      threshold -= entry.weight;
      if (threshold <= 0) {
        return entry.pick;
      }
    }

    return weighted[weighted.length - 1]?.pick ?? null;
  }

  private resolveVariant(
    archetype: EnemyArchetypeId,
    wave: number,
    kind: WaveKind,
    stageConfig: ProgressionStageConfig,
    spawnCounts: Map<string, number>,
    preferredVariant: EnemyVariant = "normal"
  ): EnemyVariant {
    if (preferredVariant !== "normal") {
      return preferredVariant;
    }

    if (archetype === "sniper" && wave >= 13) {
      const smartCap = wave < 20 ? 1 : 2;
      if (this.getSpawnCount(spawnCounts, archetype, "smart") < smartCap && (kind === "elite" || Math.random() < 0.22)) {
        return "smart";
      }
    }

    if (archetype === "turret" && wave >= 16) {
      const eliteCap = wave < 25 ? 1 : 2;
      if (this.getSpawnCount(spawnCounts, archetype, "elite") < eliteCap && (kind === "elite" || Math.random() < 0.2)) {
        return "elite";
      }
    }

    if (
      kind === "elite" &&
      (archetype === "heavy" || archetype === "kamikaze" || archetype === "tank") &&
      this.countPlannedEliteSpawns(spawnCounts) < stageConfig.caps.maxEliteEnemies
    ) {
      return "elite";
    }

    return "normal";
  }

  private pickLane(usedLanes: Set<number>, laneCursor: number, allowLaneReuse: boolean): number {
    const laneOrder = [laneCursor, (laneCursor + 1) % 5, (laneCursor + 4) % 5, (laneCursor + 2) % 5, (laneCursor + 3) % 5];
    const available = allowLaneReuse ? laneOrder : laneOrder.filter((lane) => !usedLanes.has(lane));
    return available[0] ?? pickRandom([0, 1, 2, 3, 4]);
  }

  private createPlannedSpawn(
    archetype: EnemyArchetypeId,
    variant: EnemyVariant,
    lane: number,
    source: "wave" | "boss"
  ): PlannedEnemySpawn {
    return {
      archetype,
      variant,
      role: getEnemyRole(archetype, variant),
      lane,
      source
    };
  }

  private getSpawnCost(archetype: EnemyArchetypeId, variant: EnemyVariant): number {
    const baseCost = ENEMY_BUDGET_COSTS[archetype];
    return variant === "normal" ? baseCost : baseCost * 1.35;
  }

  private getSpawnCount(spawnCounts: Map<string, number>, archetype: EnemyArchetypeId, variant: EnemyVariant): number {
    return spawnCounts.get(`${archetype}:${variant}`) ?? 0;
  }

  private bumpSpawnCount(spawnCounts: Map<string, number>, archetype: EnemyArchetypeId, variant: EnemyVariant): void {
    const key = `${archetype}:${variant}`;
    spawnCounts.set(key, (spawnCounts.get(key) ?? 0) + 1);
  }

  private countPlannedEliteSpawns(spawnCounts: Map<string, number>): number {
    let total = 0;

    spawnCounts.forEach((count, key) => {
      const [archetype, variant] = key.split(":") as [EnemyArchetypeId, EnemyVariant];
      if (getEnemyRole(archetype, variant) === "elite") {
        total += count;
      }
    });

    return total;
  }

  private canAddMoreOfType(
    wave: number,
    archetype: EnemyArchetypeId,
    variant: EnemyVariant,
    count: number
  ): boolean {
    if (archetype === "sniper") {
      return count < (wave < 20 ? 1 : 2);
    }

    if (archetype === "turret") {
      return count < 2;
    }

    if (archetype === "tank") {
      return count < (wave < 16 ? 1 : 2);
    }

    if (variant === "smart") {
      return count < (wave < 20 ? 1 : 2);
    }

    if (variant === "elite") {
      return count < 3;
    }

    return true;
  }

  private getBossSubtitle(bossId: BossId, bossCycle: number): string {
    const labels: Record<BossId, string> = {
      bulwarkHowitzer: "Bulwark Howitzer",
      blinkReaver: "Blink Reaver",
      broodCarrier: "Brood Carrier",
      prismBeamArray: "Prism Beam Array",
      aegisCoreMatrix: "Aegis Core Matrix"
    };

    if (bossCycle <= 0) {
      return labels[bossId];
    }

    return `${labels[bossId]} • цикл ${bossCycle + 1}`;
  }
}
