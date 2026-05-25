/**
 * UX Utilities for Gamification & Dopamine Layer
 * Provides haptic feedback and celebration effects
 */

import confetti from "canvas-confetti";
import { alertRestTimerEnd } from "@/lib/audioFeedback";

// ============================================
// HAPTIC FEEDBACK
// ============================================

type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error";

const hapticPatterns: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 50,
  heavy: 100,
  success: [50, 50, 100],
  warning: [100, 50, 100],
  error: [200, 100, 200],
};

/**
 * Trigger haptic feedback on supported devices
 */
function triggerHaptic(type: HapticType = "light"): boolean {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return false;
  }

  try {
    const pattern = hapticPatterns[type];
    navigator.vibrate(pattern);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// CONFETTI CELEBRATIONS
// ============================================

const celebrationColors = ["#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#3b82f6"];
const goldColors = ["#ffd700", "#ffb347", "#ff8c00", "#ffa500", "#ffcc00"];

/**
 * Trigger a celebration confetti cannon from bottom of screen
 */
export function triggerConfetti(): void {
  // Big initial burst from center-bottom
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { x: 0.5, y: 0.9 },
    colors: celebrationColors,
    startVelocity: 45,
    gravity: 0.8,
  });

  // Follow-up bursts from sides
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 80,
      origin: { x: 0, y: 0.85 },
      colors: celebrationColors,
    });
  }, 150);

  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 80,
      origin: { x: 1, y: 0.85 },
      colors: celebrationColors,
    });
  }, 300);
}

/**
 * Trigger gold/trophy confetti for Personal Records
 */
function triggerPRConfetti(): void {
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
    colors: goldColors,
    shapes: ["circle", "square"],
    scalar: 1.3,
    startVelocity: 35,
  });

  // Sparkle effect
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 360,
      origin: { x: 0.5, y: 0.5 },
      colors: goldColors,
      ticks: 60,
      gravity: 0.5,
      scalar: 0.8,
      drift: 0,
    });
  }, 200);
}

/**
 * Trigger a mini celebration for smaller achievements
 */
function triggerMiniCelebration(): void {
  confetti({
    particleCount: 40,
    spread: 50,
    origin: { x: 0.5, y: 0.7 },
    colors: celebrationColors,
    scalar: 0.8,
    ticks: 50,
  });
}

// ============================================
// COMBINED EFFECTS
// ============================================

/**
 * Trigger workout completion celebration
 * Combines confetti + haptic feedback
 */
function celebrateWorkoutComplete(): void {
  triggerConfetti();
  triggerHaptic("success");
}

/**
 * Trigger PR achievement celebration
 * Combines gold confetti + haptic feedback
 */
function celebratePR(): void {
  triggerPRConfetti();
  triggerHaptic("heavy");
}

/**
 * Trigger set completion feedback
 */
function onSetComplete(): void {
  triggerHaptic("light");
}

/**
 * Trigger rest timer end feedback (audio beep + haptic vibration)
 */
function onRestTimerEnd(): void {
  alertRestTimerEnd();
}
