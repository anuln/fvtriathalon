import { zoneActive } from "./zoneSystem";

type ScoreListener = (score: number) => void;

export class MoshpitPacmanGame {
  private score = 0;
  private backstagePowerChase = false;
  private listeners: ScoreListener[] = [];

  onScore(listener: ScoreListener): void {
    this.listeners.push(listener);
  }

  setBackstagePowerChase(enabled: boolean): void {
    this.backstagePowerChase = enabled;
  }

  isBackstagePowerChaseEnabled(): boolean {
    return this.backstagePowerChase;
  }

  zoneMeterActive(completed: number, total: number): boolean {
    return zoneActive(completed, total);
  }

  scoreGuardChain(chainLength: number): void {
    const multiplier = this.backstagePowerChase ? 2 : 1;
    this.score += chainLength * 40 * multiplier;
    for (const listener of this.listeners) {
      listener(this.score);
    }
  }

  getScore(): number {
    return this.score;
  }
}
