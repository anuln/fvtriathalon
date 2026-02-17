import { shouldUnlockCommit } from "./rhythmSerpentConfig";

export type RhythmPowerUp = "bass-drop" | "encore" | "mosh-burst";

type ScoreListener = (score: number) => void;
type StageEndListener = () => void;

export class RhythmSerpentGame {
  private score = 0;
  private stageEnded = false;
  private scoreListeners: ScoreListener[] = [];
  private stageEndListeners: StageEndListener[] = [];

  onScore(listener: ScoreListener): void {
    this.scoreListeners.push(listener);
  }

  onStageEnd(listener: StageEndListener): void {
    this.stageEndListeners.push(listener);
  }

  activatePowerUp(powerUp: RhythmPowerUp): void {
    if (powerUp === "bass-drop") this.score += 120;
    if (powerUp === "encore") this.score += 90;
    if (powerUp === "mosh-burst") this.score += 70;
    this.emitScore();
  }

  getScore(): number {
    return this.score;
  }

  endStage(): void {
    this.stageEnded = true;
    for (const listener of this.stageEndListeners) {
      listener();
    }
  }

  canCommit(elapsedMs: number): boolean {
    return this.stageEnded || shouldUnlockCommit(elapsedMs);
  }

  private emitScore(): void {
    for (const listener of this.scoreListeners) {
      listener(this.score);
    }
  }
}
