export function stageTransitionOverlay(nextStage: string) {
  return {
    title: "STAGE CLEARED",
    message: `Up next: ${nextStage}`,
    primary: "CONTINUE"
  };
}
