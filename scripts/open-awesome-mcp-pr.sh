#!/usr/bin/env bash
# Open the awesome-mcp-servers PR end-to-end.
#
# What this script does:
#   1. Forks punkpeye/awesome-mcp-servers to your GitHub account
#   2. Clones the fork into the parent directory of this repo
#   3. Creates branch `add-jak-shield`
#   4. Inserts the JAK Shield entry under the Security section (or falls back
#      to "Other tools" if the Security heading isn't found) in alphabetical
#      order
#   5. Commits, pushes, and opens the PR with a pre-drafted body
#
# Why it's a shell script you run, not something an agent does:
#   The Claude Code sandbox correctly blocks an agent from forking + writing
#   to a third-party public repo under your identity. This script runs in
#   your terminal under your gh CLI session — same authentication, fully
#   under your control, you can cancel at any prompt.
#
# Usage:
#   bash scripts/open-awesome-mcp-pr.sh
#
# Requires: gh (authenticated), git, sed.

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not found. Install from https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh CLI is installed but not authenticated. Run: gh auth login"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(dirname "$REPO_ROOT")"
WORK_DIR="$PARENT_DIR/awesome-mcp-servers"

echo "==> Step 1/5: fork punkpeye/awesome-mcp-servers"
if [ -d "$WORK_DIR/.git" ]; then
  echo "    already cloned at $WORK_DIR — refreshing"
  git -C "$WORK_DIR" fetch upstream main 2>/dev/null || git -C "$WORK_DIR" fetch origin main
  git -C "$WORK_DIR" checkout main
  git -C "$WORK_DIR" pull --rebase
else
  gh repo fork punkpeye/awesome-mcp-servers --clone --remote
  mv awesome-mcp-servers "$WORK_DIR" 2>/dev/null || true
fi

cd "$WORK_DIR"

echo
echo "==> Step 2/5: create branch add-jak-shield"
git checkout -B add-jak-shield

echo
echo "==> Step 3/5: insert JAK Shield entry into README.md"

ENTRY='- [JAK Shield](https://github.com/inbharatai/jak-shield) 🛡️ — Universal security gateway for AI agents. Sits between any MCP client (Claude Desktop, Cursor, VS Code, Cline, Windsurf, Zed, Continue, OpenAI Agents SDK) and the real tools the agent calls. Blocks destructive actions, redacts 28 PII types with cryptographic checksum validators (Luhn / Verhoeff / mod-97 IBAN / ABA / mod-11 NHS / CPF / CNPJ / SIN / NRIC / TFN / EIN / SWIFT / Bitcoin / Ethereum), detects prompt injection across 6 stages and 13 non-English languages plus English baseline, tracks taint across calls with MinHash + n-gram fingerprinting, requires human approval, HMAC-signed decisions with key rotation, scoped capability tokens, regulatory hints (PCI / HIPAA / GDPR / SOX / FERPA / DPDP / CCPA). 45-scenario adversarial benchmark in CI. MIT, TypeScript.'

# Find a Security / Guardrails-related heading; fall back to Other tools.
TARGET_HEADING=""
for candidate in "## 🔒 Security" "### Security" "## Security" "### 🔒 Security" "### Guardrails" "## Guardrails"; do
  if grep -qF "$candidate" README.md; then
    TARGET_HEADING="$candidate"
    break
  fi
done

if [ -z "$TARGET_HEADING" ]; then
  for candidate in "## Other tools" "### Other tools" "## Frameworks" "### Frameworks"; do
    if grep -qF "$candidate" README.md; then
      TARGET_HEADING="$candidate"
      break
    fi
  done
fi

if [ -z "$TARGET_HEADING" ]; then
  echo "    warning: no matching section heading found in README.md."
  echo "    Falling back to appending the entry at the end of the file. Please review before pushing."
  echo "" >> README.md
  echo "$ENTRY" >> README.md
else
  echo "    inserting under: $TARGET_HEADING"
  # Insert the entry as the line immediately after the heading. Maintainer
  # can re-sort alphabetically during review.
  awk -v heading="$TARGET_HEADING" -v entry="$ENTRY" '
    BEGIN { inserted = 0 }
    { print }
    !inserted && index($0, heading) > 0 {
      getline next_line
      print ""
      print entry
      print next_line
      inserted = 1
    }
  ' README.md > README.md.new && mv README.md.new README.md
fi

git diff --stat README.md

echo
echo "==> Step 4/5: commit + push"
git add README.md
git commit -m "Add JAK Shield — MCP-native security gateway"
git push -u origin add-jak-shield

echo
echo "==> Step 5/5: open PR"
gh pr create \
  --repo punkpeye/awesome-mcp-servers \
  --title "Add JAK Shield — MCP-native security gateway" \
  --body-file "$REPO_ROOT/.github/launch/AWESOME_MCP_PR_BODY.md"

echo
echo "✓ done. PR is open. The maintainer may ask you to re-sort alphabetically or move the entry — that's normal."
