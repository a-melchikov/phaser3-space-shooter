import { ECONOMY_REWARD_VALUES, estimateRunShardReward } from "../config/upgrades";
import type { EnemyRole, WaveKind, WavePlan } from "../types/combat";
import type { EconomyRunSummary, RunEconomyProgressState } from "../types/economy";

interface WaveEconomyState {
  wave: number;
  kind: WaveKind;
  tookDamage: boolean;
  lostLife: boolean;
  completed: boolean;
}

export class RunEconomyTracker {
  private startedAt: number;
  private readonly waveStates = new Map<number, WaveEconomyState>();
  private commonKills = 0;
  private eliteKills = 0;
  private deathlessStreak = 0;
  private readonly bossKillWaves = new Set<number>();
  private readonly noDamageWaves = new Set<number>();
  private readonly highHpWaves = new Set<number>();
  private readonly bossNoLifeLossWaves = new Set<number>();
  private readonly deathlessStreakMilestones = new Set<number>();

  public constructor(startedAt: number, state?: RunEconomyProgressState) {
    this.startedAt = startedAt;
    if (state) {
      this.restoreState(startedAt, state);
    }
  }

  public restoreState(now: number, state: RunEconomyProgressState): void {
    this.startedAt = now - Math.max(0, state.startedAtOffsetMs);
    this.commonKills = Math.max(0, Math.floor(state.commonKills));
    this.eliteKills = Math.max(0, Math.floor(state.eliteKills));
    this.deathlessStreak = Math.max(0, Math.floor(state.deathlessStreak));
    this.waveStates.clear();
    state.waveStates.forEach((waveState) => {
      this.waveStates.set(waveState.wave, { ...waveState });
    });
    replaceSet(this.bossKillWaves, state.bossKillWaves);
    replaceSet(this.noDamageWaves, state.noDamageWaves);
    replaceSet(this.highHpWaves, state.highHpWaves);
    replaceSet(this.bossNoLifeLossWaves, state.bossNoLifeLossWaves);
    replaceSet(this.deathlessStreakMilestones, state.deathlessStreakMilestones);
  }

  public captureState(now: number): RunEconomyProgressState {
    return {
      startedAtOffsetMs: Math.max(0, Math.floor(now - this.startedAt)),
      commonKills: this.commonKills,
      eliteKills: this.eliteKills,
      deathlessStreak: this.deathlessStreak,
      bossKillWaves: Array.from(this.bossKillWaves).sort(sortNumbers),
      noDamageWaves: Array.from(this.noDamageWaves).sort(sortNumbers),
      highHpWaves: Array.from(this.highHpWaves).sort(sortNumbers),
      bossNoLifeLossWaves: Array.from(this.bossNoLifeLossWaves).sort(sortNumbers),
      deathlessStreakMilestones: Array.from(this.deathlessStreakMilestones).sort(sortNumbers),
      waveStates: Array.from(this.waveStates.values()).map((state) => ({ ...state }))
    };
  }

  public startWave(plan: WavePlan): void {
    if (!this.waveStates.has(plan.wave)) {
      this.waveStates.set(plan.wave, {
        wave: plan.wave,
        kind: plan.kind,
        tookDamage: false,
        lostLife: false,
        completed: false
      });
      return;
    }

    const state = this.waveStates.get(plan.wave);
    if (state) {
      state.kind = plan.kind;
    }
  }

  public recordEnemyKilled(role: EnemyRole): void {
    if (role === "elite") {
      this.eliteKills += 1;
      return;
    }

    this.commonKills += 1;
  }

  public recordBossKilled(wave: number): void {
    this.bossKillWaves.add(wave);
    const state = this.getOrCreateWaveState(wave, "boss");

    if (!state.lostLife) {
      this.bossNoLifeLossWaves.add(wave);
    }
  }

  public recordPlayerDamage(wave: number, lostLife: boolean): void {
    const state = this.getOrCreateWaveState(wave, wave % 5 === 0 ? "boss" : "normal");
    state.tookDamage = true;
    state.lostLife = state.lostLife || lostLife;
  }

  public completeWave(plan: WavePlan, playerHealth: number, playerMaxHealth: number): void {
    const state = this.getOrCreateWaveState(plan.wave, plan.kind);
    if (state.completed) {
      return;
    }

    state.completed = true;
    state.kind = plan.kind;

    if (!state.tookDamage) {
      this.noDamageWaves.add(plan.wave);
    }

    if (playerMaxHealth > 0 && playerHealth / playerMaxHealth >= ECONOMY_REWARD_VALUES.highHpThreshold) {
      this.highHpWaves.add(plan.wave);
    }

    if (state.lostLife) {
      this.deathlessStreak = 0;
      return;
    }

    this.deathlessStreak += 1;
    if (this.deathlessStreak > 0 && this.deathlessStreak % ECONOMY_REWARD_VALUES.deathlessStreakSize === 0) {
      this.deathlessStreakMilestones.add(plan.wave);
    }
  }

  public createSummary(runId: string, score: number, wave: number, now: number): EconomyRunSummary {
    return {
      runId,
      score: Math.max(0, Math.floor(score)),
      wave: Math.max(1, Math.floor(wave)),
      durationMs: Math.max(0, Math.floor(now - this.startedAt)),
      kills: {
        common: this.commonKills,
        elite: this.eliteKills,
        bossWaves: Array.from(this.bossKillWaves).sort(sortNumbers)
      },
      bonuses: {
        noDamageWaves: Array.from(this.noDamageWaves).sort(sortNumbers),
        highHpWaves: Array.from(this.highHpWaves).sort(sortNumbers),
        bossNoLifeLossWaves: Array.from(this.bossNoLifeLossWaves).sort(sortNumbers),
        deathlessStreakMilestones: Array.from(this.deathlessStreakMilestones).sort(sortNumbers)
      }
    };
  }

  public estimateReward(currentWave: number): number {
    return estimateRunShardReward({
      wave: Math.max(1, currentWave),
      kills: {
        common: this.commonKills,
        elite: this.eliteKills,
        bossWaves: Array.from(this.bossKillWaves)
      },
      bonuses: {
        noDamageWaves: Array.from(this.noDamageWaves),
        highHpWaves: Array.from(this.highHpWaves),
        bossNoLifeLossWaves: Array.from(this.bossNoLifeLossWaves),
        deathlessStreakMilestones: Array.from(this.deathlessStreakMilestones)
      }
    });
  }

  private getOrCreateWaveState(wave: number, kind: WaveKind): WaveEconomyState {
    const existing = this.waveStates.get(wave);
    if (existing) {
      return existing;
    }

    const state: WaveEconomyState = {
      wave,
      kind,
      tookDamage: false,
      lostLife: false,
      completed: false
    };
    this.waveStates.set(wave, state);
    return state;
  }
}

function sortNumbers(left: number, right: number): number {
  return left - right;
}

function replaceSet(target: Set<number>, values: readonly number[]): void {
  target.clear();
  values.forEach((value) => {
    target.add(Math.max(1, Math.floor(value)));
  });
}
