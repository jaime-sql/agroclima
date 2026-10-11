/** First 7 characters of a git SHA. Missing input is a local build. */
export function shortSha(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "dev";
  return trimmed.slice(0, 7);
}
