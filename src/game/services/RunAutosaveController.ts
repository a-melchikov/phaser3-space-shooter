import type { RunSnapshot } from "../types/runState";

import type { RunStateStore } from "./RunStateStore";

interface RunAutosaveControllerOptions {
  intervalMs?: number;
  throttleMs?: number;
}

export class RunAutosaveController {
  private readonly intervalMs: number;
  private readonly throttleMs: number;
  private intervalId?: number;
  private pendingTimeoutId?: number;
  private lastSavedAt = 0;
  private destroyed = false;
  private readonly handleVisibilityChange = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      this.flush();
    }
  };
  private readonly handleBeforeUnload = (): void => {
    this.flush();
  };

  public constructor(
    private readonly store: RunStateStore,
    private readonly capture: () => RunSnapshot | null,
    options: RunAutosaveControllerOptions = {}
  ) {
    this.intervalMs = options.intervalMs ?? 8000;
    this.throttleMs = options.throttleMs ?? 1200;
  }

  public start(): void {
    if (this.destroyed || typeof window === "undefined") {
      return;
    }

    this.stop();
    this.intervalId = window.setInterval(() => {
      this.requestSave();
    }, this.intervalMs);

    window.addEventListener("beforeunload", this.handleBeforeUnload);
    window.addEventListener("pagehide", this.handleBeforeUnload);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  public requestSave(immediate = false): void {
    if (this.destroyed) {
      return;
    }

    if (immediate) {
      this.flush();
      return;
    }

    if (this.pendingTimeoutId !== undefined) {
      return;
    }

    const now = Date.now();
    const delay = Math.max(0, this.throttleMs - (now - this.lastSavedAt));
    this.pendingTimeoutId = window.setTimeout(() => {
      this.pendingTimeoutId = undefined;
      this.flush();
    }, delay);
  }

  public flush(): void {
    if (this.destroyed) {
      return;
    }

    if (this.pendingTimeoutId !== undefined) {
      window.clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = undefined;
    }

    const snapshot = this.capture();
    if (!snapshot) {
      return;
    }

    this.store.save(snapshot);
    this.lastSavedAt = Date.now();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.stop();
  }

  private stop(): void {
    if (this.intervalId !== undefined) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.pendingTimeoutId !== undefined) {
      window.clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = undefined;
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.handleBeforeUnload);
      window.removeEventListener("pagehide", this.handleBeforeUnload);
    }

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }
}
