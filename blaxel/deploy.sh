#!/usr/bin/env bash
# Stage the ask agent with the shared module, then deploy that directory.
# bl deploy uploads only the directory it is run from, so the repo imports
# of src/lib are copied in and rewritten here. The OpenAI key stays in the
# environment and is never printed or written to a file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$(mktemp -d)"
cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

mkdir -p "$STAGE"
tar -C "$ROOT/blaxel/ask-agent" \
  --exclude=node_modules \
  --exclude='*.test.ts' \
  -cf - . | tar -C "$STAGE" -xf -

mkdir -p "$STAGE/src/shared"
cp "$ROOT/src/lib/ask-core.ts" "$ROOT/src/lib/openai.ts" "$STAGE/src/shared/"

sed -i 's|../../../src/lib/|./shared/|g' "$STAGE/src/server.ts" "$STAGE/src/index.ts"

if grep -q '../../../src/lib/' "$STAGE/src/server.ts" "$STAGE/src/index.ts"; then
  echo "shared import was not rewritten" >&2
  exit 1
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY is required" >&2
  exit 1
fi

(
  cd "$STAGE"
  bl deploy --yes --wait -s OPENAI_API_KEY="$OPENAI_API_KEY"
)
