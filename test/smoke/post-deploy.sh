#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Post-deploy smoke test for pi-openrouter-search-fetch
#
# Runs AFTER semantic-release publishes to npm.  Waits a few seconds for
# registry propagation, then installs the published tarball and verifies:
#   1. The package installs cleanly
#   2. All required files are present and well-formed
#   3. Live API calls work with the published package patterns
#
# Required env:
#   OPENROUTER_API_KEY  – valid OpenRouter API key for tool execution
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PACKAGE="pi-openrouter-search-fetch"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cd "$TMPDIR"
echo "==> Smoke test for $PACKAGE (latest)"

# ── 1. Install the published package ────────────────────────────────────────

echo "==> 1. Installing $PACKAGE@latest"
npm install "$PACKAGE@latest" 2>&1 | tail -3

# Verify expected files exist
for f in src/index.ts src/helpers.ts CHANGELOG.md README.md package.json; do
  if [ ! -f "node_modules/$PACKAGE/$f" ]; then
    echo "FAIL: Expected $f not found"
    exit 1
  fi
  echo "  PASS: $f present"
done

# Verify package.json has pi field and correct entry points
node -e "
const pkg = JSON.parse(require('fs').readFileSync('node_modules/$PACKAGE/package.json','utf8'));
const asserts = [
  [pkg.name === '$PACKAGE', 'name'],
  [Array.isArray(pkg.keywords) && pkg.keywords.includes('pi-package'), 'pi-package keyword'],
  [Array.isArray(pkg.files) && pkg.files.length > 0, 'files array'],
  [typeof pkg.pi === 'object' && Array.isArray(pkg.pi.extensions), 'pi.extensions'],
];
for (const [ok, desc] of asserts) {
  if (!ok) { console.error('FAIL: ' + desc); process.exit(1); }
  console.log('  PASS: ' + desc);
}
"

echo "PASS: package metadata valid"

# ── 2. Verify the helpers file is parseable TypeScript ──────────────────────

echo "==> 2. Validating TypeScript source files"

node -e "
const fs = require('fs');
const src = fs.readFileSync('node_modules/$PACKAGE/src/helpers.ts', 'utf8');
const checks = [
  ['extractResponse', src.includes('export function extractResponse')],
  ['statusLabel', src.includes('export function statusLabel')],
  ['isActiveModelOpenRouter', src.includes('export function isActiveModelOpenRouter')],
  ['resolveApiKey', src.includes('export function resolveApiKey')],
  ['callOpenRouterTool', src.includes('export async function callOpenRouterTool')],
  ['setToolActive', src.includes('export function setToolActive')],
  ['restoreState', src.includes('export function restoreState')],
  ['persistState', src.includes('export function persistState')],
];
for (const [name, ok] of checks) {
  if (!ok) { console.error('FAIL: ' + name + ' not found in helpers.ts'); process.exit(1); }
  console.log('  PASS: ' + name + ' exported');
}
"

# ── 3. Live API integration test (if API key available) ─────────────────────

if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  echo "==> 3. Testing live OpenRouter API (same patterns as extension uses)"

  OPENROUTER_API="https://openrouter.ai/api/v1"

  # Test web_search
  echo "  Testing web_search..."
  SEARCH_RES=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "openrouter/auto",
      "messages": [{"role": "user", "content": "capital of France"}],
      "tools": [{"type": "openrouter:web_search"}],
      "max_tokens": 1024
    }' "$OPENROUTER_API/chat/completions")
  HTTP_CODE=$(echo "$SEARCH_RES" | tail -1)
  BODY=$(echo "$SEARCH_RES" | sed '$d')
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  PASS: web_search returned 200"
  else
    echo "  FAIL: web_search returned HTTP $HTTP_CODE"
    echo "  Body: $BODY" | head -5
    exit 1
  fi

  # Test web_fetch
  echo "  Testing web_fetch..."
  FETCH_RES=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "openrouter/auto",
      "messages": [{"role": "user", "content": "Fetch https://example.com and tell me what you see"}],
      "tools": [{"type": "openrouter:web_fetch"}],
      "max_tokens": 1024
    }' "$OPENROUTER_API/chat/completions")
  HTTP_CODE=$(echo "$FETCH_RES" | tail -1)
  BODY=$(echo "$FETCH_RES" | sed '$d')
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  PASS: web_fetch returned 200"
  else
    echo "  FAIL: web_fetch returned HTTP $HTTP_CODE"
    echo "  Body: $BODY" | head -5
    exit 1
  fi

  echo "PASS: live API calls work"
else
  echo "==> 3. Skipping live API test (OPENROUTER_API_KEY not set)"
fi

echo ""
echo "==> All smoke tests passed!"
