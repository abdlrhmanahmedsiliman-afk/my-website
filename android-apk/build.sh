#!/data/data/com.termux/files/usr/bin/bash
# Build the Kashf Android APK entirely on-device with Termux tools.
# Requirements: openjdk-17, aapt2, d8, apksigner, zip/python3.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(cd "$ROOT/.." && pwd)"
ANDROID_JAR="$ROOT/libs/android-29.jar"
BUILD="$ROOT/build"
OUT="$PROJECT/kashf.apk"

if [ ! -f "$ANDROID_JAR" ]; then
  echo "Missing $ANDROID_JAR"
  exit 1
fi

echo "==> 1/7 Preparing web assets"
rm -rf "$ROOT/assets/www" "$BUILD"
mkdir -p "$ROOT/assets/www" "$BUILD/classes" "$BUILD/dex" "$BUILD/gen"
for item in index.html css js vendor assets manifest.webmanifest sw.js; do
  cp -R "$PROJECT/$item" "$ROOT/assets/www/"
done

# A service worker is unnecessary inside the APK (everything is bundled) and
# can keep stale files alive across APK updates, so keep it disabled there.
# window.open() cannot create tabs inside a WebView, so route it to the
# native "open external app" bridge instead.
python3 - "$ROOT/assets/www/index.html" <<'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')
s = s.replace("if ('serviceWorker' in navigator) {",
              "if (false && 'serviceWorker' in navigator) {")
bridge = """<script>
  // Android shell: window.open cannot create tabs inside a WebView.
  if (window.KashfAndroid && typeof window.KashfAndroid.openExternal === 'function') {
    window.open = function (url) {
      if (url) window.KashfAndroid.openExternal(String(url));
      return null;
    };
  }
</script>
</head>"""
s = s.replace("</head>", bridge, 1)
p.write_text(s, encoding='utf-8')
PY

echo "==> 2/7 Compiling Android resources"
aapt2 compile --dir "$ROOT/res" -o "$BUILD/res.zip"
aapt2 link -o "$BUILD/base.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$ROOT/AndroidManifest.xml" \
  -R "$BUILD/res.zip" \
  -A "$ROOT/assets" \
  --java "$BUILD/gen" \
  --auto-add-overlay

echo "==> 3/7 Compiling Java"
find "$ROOT/java" -name '*.java' > "$BUILD/sources.txt"
javac -source 8 -target 8 \
  -bootclasspath "$ANDROID_JAR" \
  -d "$BUILD/classes" \
  @"$BUILD/sources.txt"

echo "==> 4/7 Converting to DEX"
find "$BUILD/classes" -name '*.class' -print0 | \
  xargs -0 d8 --lib "$ANDROID_JAR" --min-api 21 --output "$BUILD/dex"

echo "==> 5/7 Packaging classes.dex"
python3 - "$BUILD/base.apk" "$BUILD/dex/classes.dex" <<'PY'
import sys, zipfile
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(dex, 'classes.dex')
PY

echo "==> 6/7 Signing"
if [ ! -f "$ROOT/kashf.keystore" ]; then
  keytool -genkeypair -v \
    -keystore "$ROOT/kashf.keystore" \
    -alias kashf \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass kashf2026 -keypass kashf2026 \
    -dname "CN=Kashf, OU=Mobile, O=Kashf, L=Cairo, C=EG" >/dev/null 2>&1
  echo "    created $ROOT/kashf.keystore (keep it for future updates)"
fi

apksigner sign \
  --ks "$ROOT/kashf.keystore" \
  --ks-key-alias kashf \
  --ks-pass pass:kashf2026 \
  --key-pass pass:kashf2026 \
  --out "$OUT" \
  "$BUILD/base.apk"

echo "==> 7/7 Verifying"
apksigner verify --verbose "$OUT" | sed -n '1,12p'
aapt dump badging "$OUT" | sed -n '1,4p'
ls -lh "$OUT"
echo "APK ready: $OUT"
