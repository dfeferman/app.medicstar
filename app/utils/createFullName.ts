export function createFullName(firstName?: string, lastName?: string): string {
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';

  if (first) {
    return `${first} ${last}`.trim();
  }
  return last;
}
