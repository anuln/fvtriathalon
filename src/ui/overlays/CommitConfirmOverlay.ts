export function commitConfirmOverlay(stageLabel: string) {
  return {
    title: `Commit ${stageLabel}?`,
    message: "Bank this stage and move forward. This cannot be undone.",
    primary: "COMMIT",
    secondary: "CANCEL"
  };
}
