export function zoneActive(completed: number, total: number): boolean {
  if (total <= 0) {
    return false;
  }

  return (completed / total) * 100 >= 15;
}
