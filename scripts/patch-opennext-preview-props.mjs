/**
 * Next.js 16.4 loads `.next/server/preview-props.json` from the server
 * constructor. @opennextjs/cloudflare inlines manifests at build time, but
 * 1.20.x only globs `*-manifest`, `required-server-files`, and
 * `prefetch-hints`. `preview-props.json` misses that glob, so loadManifest
 * throws on every request.
 *
 * Same one-line glob change as opennextjs-cloudflare pull request 1356.
 * Delete this script once a published release includes that change.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js",
);

const missing =
  "**/{*-manifest,required-server-files,prefetch-hints}.json";
const fixed =
  "**/{*-manifest,required-server-files,prefetch-hints,preview-props}.json";

const source = readFileSync(target, "utf8");

if (source.includes(fixed)) {
  process.stdout.write(
    "OpenNext loadManifest already inlines preview-props.json\n",
  );
  process.exit(0);
}

const occurrences = source.split(missing).length - 1;
if (occurrences !== 1) {
  process.stderr.write(
    "Could not patch OpenNext loadManifest: expected the preview-props glob once, found " +
      occurrences +
      ".\nIf a newer @opennextjs/cloudflare already inlines preview-props.json, update this script.\n",
  );
  process.exit(1);
}

writeFileSync(target, source.replace(missing, fixed));
process.stdout.write("Patched OpenNext loadManifest to inline preview-props.json\n");
