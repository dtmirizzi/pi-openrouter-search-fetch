#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Post-deploy smoke test for @dtmirizzi/pi-openrouter-multimodal
# Runs AFTER semantic-release publishes to npm.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PACKAGE="@dtmirizzi/pi-openrouter-multimodal"
PKG_DIR="node_modules/@dtmirizzi/pi-openrouter-multimodal"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cd "$TMPDIR"
echo "==> Smoke test for $PACKAGE (latest)"

# ── 1. Install the published package ───────────────────────────────────────
echo "==> 1. Installing $PACKAGE@latest"
npm install "$PACKAGE@latest" 2>&1 | tail -3

# Verify expected files exist
for f in src/index.ts CHANGELOG.md README.md package.json; do
  if [ ! -f "$PKG_DIR/$f" ]; then
    echo "FAIL: Expected $f not found"
    exit 1
  fi
  echo "  PASS: $f present"
done

# Verify package.json metadata
node -e "
const pkg = JSON.parse(require('fs').readFileSync('$PKG_DIR/package.json','utf8'));
const asserts = [
  [pkg.name === '@dtmirizzi/pi-openrouter-multimodal', 'name'],
  [Array.isArray(pkg.keywords) && pkg.keywords.includes('pi-package'), 'keyword'],
  [Array.isArray(pkg.files) && pkg.files.length > 0, 'files'],
  [typeof pkg.pi === 'object' && Array.isArray(pkg.pi.extensions), 'pi.extensions'],
];
for (const [ok, desc] of asserts) {
  if (!ok) { console.error('FAIL: ' + desc); process.exit(1); }
  console.log('  PASS: ' + desc);
}
"
echo "PASS: package metadata valid"

# ── 2. Live API test ───────────────────────────────────────────────────────
if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  echo "==> 2. Testing live OpenRouter API"
  API="https://openrouter.ai/api/v1"

  echo "  web_search..."
  RES=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"model":"openrouter/auto","messages":[{"role":"user","content":"capital of France"}],"tools":[{"type":"openrouter:web_search"}],"max_tokens":1024}' \
    "$API/chat/completions")
  CODE=$(echo "$RES" | tail -1)
  [ "$CODE" = "200" ] || { echo "FAIL: search $CODE"; exit 1; }
  echo "  PASS: web_search $CODE"

  echo "  web_fetch..."
  RES=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"model":"openrouter/auto","messages":[{"role":"user","content":"Fetch https://example.com"}],"tools":[{"type":"openrouter:web_fetch"}],"max_tokens":1024}' \
    "$API/chat/completions")
  CODE=$(echo "$RES" | tail -1)
  [ "$CODE" = "200" ] || { echo "FAIL: fetch $CODE"; exit 1; }
  echo "  PASS: web_fetch $CODE"

  echo "PASS: live API calls work"
else
  echo "==> 2. Skipping live API test (no OPENROUTER_API_KEY)"
fi

echo ""
echo "==> All smoke tests passed!"
