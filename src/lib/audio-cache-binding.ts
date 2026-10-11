export function shouldKeepAudioCache(status: number, output: string): boolean {
  if (status === 0) return true;
  return /already exists/i.test(output);
}

type R2Bucket = { binding?: string; bucket_name?: string };

type WranglerConfig = {
  r2_buckets?: R2Bucket[];
} & Record<string, unknown>;

/** Drop AUDIO_CACHE when the bucket cannot be created. Leave every other binding. */
export function withoutAudioCache<T extends WranglerConfig>(config: T): T {
  if (!Array.isArray(config.r2_buckets)) return config;
  const kept = config.r2_buckets.filter((bucket) => bucket?.binding !== "AUDIO_CACHE");
  if (kept.length === config.r2_buckets.length) return config;
  const next = { ...config };
  if (kept.length === 0) delete next.r2_buckets;
  else next.r2_buckets = kept;
  return next;
}

/** Keep the original text when the binding stays, so a good create does not rewrite the file. */
export function wranglerConfigForDeploy(configText: string, status: number, output: string): string {
  if (shouldKeepAudioCache(status, output)) return configText;
  const config = JSON.parse(configText) as WranglerConfig;
  const next = withoutAudioCache(config);
  if (next === config) return configText;
  return `${JSON.stringify(next, null, 2)}\n`;
}
