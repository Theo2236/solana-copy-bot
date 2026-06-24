#!/usr/bin/env bash
set -euo pipefail

# Migreer dit project naar een nieuwe GitHub repository.
# Gebruik:
#   1. Maak op https://github.com/new een lege repo aan (bijv. pokemon-card-bulk-scanner)
#   2. Voer uit: ./scripts/migrate-to-new-github.sh JOUW-USERNAME/pokemon-card-bulk-scanner

if [ $# -lt 1 ]; then
  echo "Gebruik: $0 <github-user/repo>"
  echo "Voorbeeld: $0 Theo2236/pokemon-card-bulk-scanner"
  exit 1
fi

TARGET_REPO="$1"
REMOTE_NAME="pokemon-origin"

echo "→ Nieuwe remote: $TARGET_REPO"
git remote remove "$REMOTE_NAME" 2>/dev/null || true
git remote add "$REMOTE_NAME" "https://github.com/${TARGET_REPO}.git"

echo "→ Push master naar nieuwe repo"
git push -u "$REMOTE_NAME" master:main

echo ""
echo "Klaar! Volgende stappen:"
echo "  1. Ga naar https://vercel.com/new en importeer github.com/${TARGET_REPO}"
echo "  2. Voeg environment variables toe: GEMINI_API_KEY, POKEMON_TCG_API_KEY"
echo "  3. Deploy"
