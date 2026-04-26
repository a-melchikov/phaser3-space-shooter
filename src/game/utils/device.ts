import Phaser from "phaser";

import { getViewportHeight, getViewportWidth } from "./viewport";

export type Orientation = "portrait" | "landscape";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DeviceProfile {
  isTouchCapable: boolean;
  isCoarsePointer: boolean;
  isMobileViewport: boolean;
  orientation: Orientation;
  safeArea: SafeAreaInsets;
}

const MOBILE_VIEWPORT_MAX_SIDE = 940;

export function getOrientation(width: number, height: number): Orientation {
  return height > width ? "portrait" : "landscape";
}

export function getDeviceProfile(scene?: Phaser.Scene): DeviceProfile {
  const width = scene ? getViewportWidth(scene) : window.innerWidth;
  const height = scene ? getViewportHeight(scene) : window.innerHeight;
  const isTouchCapable = window.navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const isMobileViewport = Math.min(width, height) <= MOBILE_VIEWPORT_MAX_SIDE && Math.max(width, height) <= 1366;

  return {
    isTouchCapable,
    isCoarsePointer,
    isMobileViewport,
    orientation: getOrientation(width, height),
    safeArea: getSafeAreaInsets()
  };
}

export function shouldUseMobileInput(scene: Phaser.Scene): boolean {
  const profile = getDeviceProfile(scene);
  return profile.isTouchCapable && (profile.isCoarsePointer || profile.isMobileViewport);
}

export function isMobileLayout(scene: Phaser.Scene): boolean {
  const profile = getDeviceProfile(scene);
  return shouldUseMobileInput(scene) || (profile.isTouchCapable && profile.isMobileViewport);
}

export function getSafeAreaInsets(): SafeAreaInsets {
  const style = window.getComputedStyle(document.documentElement);

  return {
    top: readCssPixelValue(style, "--safe-area-inset-top"),
    right: readCssPixelValue(style, "--safe-area-inset-right"),
    bottom: readCssPixelValue(style, "--safe-area-inset-bottom"),
    left: readCssPixelValue(style, "--safe-area-inset-left")
  };
}

function readCssPixelValue(style: CSSStyleDeclaration, name: string): number {
  const value = style.getPropertyValue(name).trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
