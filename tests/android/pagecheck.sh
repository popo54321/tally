#!/usr/bin/env bash
# Tests PageCheck.java (the app-files bundle check) on a computer with real signed bundles: genuine, wrong key,
# unsigned, tampered, extra file, sneaky paths, too new for the shell, not newer, already there.
#   bash tests/android/pagecheck.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../.." && pwd)
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
javac -nowarn -d "$W/cls" "$ROOT/android/app/java/com/bodyandiron/traininglog/PageCheck.java" "$HERE/PageCheckTest.java" || exit 1
key(){ keytool -genkeypair -keystore "$W/$1.ks" -storepass secret1 -keypass secret1 -alias k -dname "CN=$1" -keyalg RSA -keysize 2048 -validity 2 >/dev/null 2>&1; }
key right; key wrong
keytool -exportcert -keystore "$W/right.ks" -storepass secret1 -alias k -file "$W/right.der" >/dev/null 2>&1
bundle(){ # name version shell [extra-file]
  local d="$W/src-$1"; mkdir -p "$d/fonts"; echo "<html>Tally $2</html>" > "$d/index.html"; printf 'font' > "$d/fonts/a.woff2"
  printf '{"version":"%s","shell":%s}\n' "$2" "$3" > "$d/page.json"
  (cd "$d" && jar --create --file "$W/$1.jar" .) ; }
sign(){ jarsigner -keystore "$W/$2.ks" -storepass secret1 "$W/$1.jar" k >/dev/null 2>&1; }
fails=0
t(){ # jar shell current expect label [keep: leave the earlier unpacked folder in place]
  [ "${6:-}" = keep ] || rm -rf "$W/out-$1"
  java -cp "$W/cls" PageCheckTest "$W/$1.jar" "$W/right.der" "$2" "$3" "$4" "$W/out-$1" "$5" ${6:-} || fails=$((fails+1)); }

bundle good 9.9 2; sign good right;            t good 2 9.8 ok:9.9 "genuine bundle, signed with the app's key"
                                                t good 2 9.8 refused:exists "the same version already unpacked" keep
bundle wrongkey 9.9 2; sign wrongkey wrong;    t wrongkey 2 9.8 refused:signature "signed with another key"
bundle unsigned 9.9 2;                         t unsigned 2 9.8 refused:signature "not signed at all"
bundle tamper 9.9 2; sign tamper right
python3 - "$W/tamper.jar" <<'PY'
import sys, zipfile, shutil
src=sys.argv[1]; dst=src+'.new'
with zipfile.ZipFile(src) as a, zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as b:
    for i in a.infolist(): b.writestr(i, b'<html>evil</html>' if i.filename=='index.html' else a.read(i))
shutil.move(dst, src)
PY
                                                t tamper 2 9.8 refused:signature "index.html changed after signing"
bundle extra 9.9 2; sign extra right
python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'a'); z.writestr('evil.js','alert(1)'); z.close()" "$W/extra.jar"
                                                t extra 2 9.8 refused:signature "a file slipped in after signing"
bundle sneaky 9.9 2
python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'a'); z.writestr('../outside.txt','x'); z.close()" "$W/sneaky.jar"
sign sneaky right;                              t sneaky 2 9.8 refused:path "a file aimed outside its folder, even if signed"
bundle newshell 9.9 3; sign newshell right;    t newshell 2 9.8 refused:shell "needs a newer app shell"
bundle old 9.8 2; sign old right;              t old 2 9.8 refused:notnewer "not newer than what runs now"
                                                t good 2 9.10 refused:notnewer "9.9 is older than 9.10"
bundle nojson 9.9 2; rm "$W/nojson.jar"; rm "$W/src-nojson/page.json"; (cd "$W/src-nojson" && jar --create --file "$W/nojson.jar" .); sign nojson right
                                                t nojson 2 9.8 refused:incomplete "no version information"
[ $fails -eq 0 ] && echo "all bundle checks passed" || { echo "$fails bundle check(s) FAILED"; exit 1; }
