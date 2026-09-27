#!/bin/sh
# Write the GBrain token from the clipboard into .env.local without printing it.
cd "$(dirname "$0")/.." || exit 1
t=$(pbpaste | sed 's/^Authorization: Bearer //' | tr -d '[:space:]')
case "$t" in gbu_*) ;; *) echo "clipboard does not hold a gbu_ token — click Copy in GBrain first"; exit 1 ;; esac
sed -i '' '/^GBRAIN_TOKEN=/d' .env.local
printf 'GBRAIN_TOKEN=%s\n' "$t" >> .env.local
echo "GBRAIN_TOKEN saved (${#t} chars)"
