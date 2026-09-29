#!/bin/sh
# Re-encode the button texture after replacing assets/apply-paint.png:
#   sh tools/encode-texture.sh            (needs cwebp: brew install webp)
# Then run: python3 tools/build-release.py   (regenerates the file:// data copies)
set -e
cd "$(dirname "$0")/.."
command -v cwebp >/dev/null || { echo "cwebp not found — install with: brew install webp"; exit 1; }
cwebp -quiet -q 94 -m 6 assets/apply-paint.png -o assets/apply-paint.webp
echo "assets/apply-paint.webp: $(wc -c < assets/apply-paint.webp | tr -d ' ') bytes (from $(wc -c < assets/apply-paint.png | tr -d ' ') bytes PNG)"
