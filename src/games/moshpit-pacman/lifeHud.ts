import { formatAmpLivesHearts } from "../amp-invaders/livesHud";

export function formatMoshPitLifeHeart(crowdSaveCharges: number): string {
  return formatAmpLivesHearts(crowdSaveCharges, 1);
}
