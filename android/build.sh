set -e
: "${ANDROID_HOME:?set ANDROID_HOME to your Android SDK root}"
VC=${1:?version code required - must be higher than the last release}
VN=${2:?version name required}
BT=$ANDROID_HOME/build-tools/34.0.0
AJ=$ANDROID_HOME/platforms/android-34/android.jar
: "${KEYSTORE:?set KEYSTORE to the keystore file}"
: "${KEYSTORE_PASS:?set KEYSTORE_PASS to the keystore password}"
export KEYSTORE_PASS KEY_PASS="${KEY_PASS:-$KEYSTORE_PASS}"
PAGE=${PAGE:-app/assets/index.html}

bt(){ for e in "" ".exe" ".bat"; do [ -f "$BT/$1$e" ] && { echo "$BT/$1$e"; return; }; done
      echo "missing $1 in $BT" >&2; exit 1; }
AAPT2=$(bt aapt2); D8=$(bt d8); ZIPALIGN=$(bt zipalign); APKSIGNER=$(bt apksigner)

PV=$(sed -n "s/^const APP_VERSION = '\([^']*\)';.*/\1/p" "$PAGE")
[ "$PV" = "$VN" ] || { echo "version name $VN does not match APP_VERSION '$PV' in $PAGE - bump the page first" >&2; exit 1; }

if [ "$PAGE" = app/assets/index.html ]; then node tools/verify.js || { echo "verify failed - not building"; exit 1; }; fi

rm -rf build && mkdir -p build/classes
node tools/stage.js build/stage "$PAGE"
"$AAPT2" compile --dir build/stage/res -o build/res.zip
"$AAPT2" link -o build/base.apk -I "$AJ" \
  --manifest app/AndroidManifest.xml -A build/stage/assets \
  --min-sdk-version 29 --target-sdk-version 34 \
  --version-code "$VC" --version-name "$VN" build/res.zip
node tools/zipsep.js build/base.apk
javac -source 8 -target 8 -nowarn -g:none -bootclasspath "$AJ" -classpath "$AJ" \
  -d build/classes app/java/com/bodyandiron/traininglog/*.java
"$D8" --lib "$AJ" --min-api 29 --release --no-desugaring \
  --output build/ build/classes/com/bodyandiron/traininglog/*.class
if command -v zip >/dev/null 2>&1; then (cd build && zip -q -j base.apk classes.dex)
else node tools/addzip.js build/base.apk build/classes.dex; fi
"$ZIPALIGN" -f -p 4 build/base.apk build/aligned.apk
OUT="build/tally-$VN.apk"
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-key-alias bodyandiron \
  --ks-pass env:KEYSTORE_PASS --key-pass env:KEY_PASS --min-sdk-version 29 \
  --v4-signing-enabled false \
  --out "$OUT" build/aligned.apk
"$APKSIGNER" verify "$OUT"
echo "built $OUT (code $VC)"
