import type { GenreBlock } from "./waveDirector";
import { nextGenreBlock } from "./waveDirector";

type EndRunListener = () => void;

export class AmpInvadersGame {
  private genre: GenreBlock = "jazz";
  private wave = 1;
  private shieldDurability = 100;
  private discoBallBonusTargetActive = false;
  private endRunListeners: EndRunListener[] = [];

  onEndRun(listener: EndRunListener): void {
    this.endRunListeners.push(listener);
  }

  nextWave(): void {
    this.wave += 1;
    this.genre = nextGenreBlock(this.genre);
  }

  takeShieldDamage(amount: number): void {
    this.shieldDurability = Math.max(0, this.shieldDurability - amount);
  }

  setDiscoBallBonusTarget(active: boolean): void {
    this.discoBallBonusTargetActive = active;
  }

  endRun(): void {
    for (const listener of this.endRunListeners) {
      listener();
    }
  }

  getState() {
    return {
      genre: this.genre,
      wave: this.wave,
      shieldDurability: this.shieldDurability,
      discoBallBonusTargetActive: this.discoBallBonusTargetActive
    };
  }
}
