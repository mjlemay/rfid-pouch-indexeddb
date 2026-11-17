#!/usr/bin/env bash
# Packages the static build in out/ as two zips under release/:
# simple-rfid-notekeeper-<version>.zip and a fixed-name copy for the latest link.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f out/index.html ]; then
  echo "out/index.html is missing. Run npm run build first." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
NAME="simple-rfid-notekeeper"

rm -rf release
mkdir -p "release/$NAME"
cp -R out/. "release/$NAME/"

cd release
zip -qr "$NAME-$VERSION.zip" "$NAME"
cp "$NAME-$VERSION.zip" "$NAME.zip"

echo "release/$NAME-$VERSION.zip"
echo "release/$NAME.zip"
