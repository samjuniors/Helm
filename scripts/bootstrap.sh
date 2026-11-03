#!/bin/sh
# Helm first-install bootstrap for macOS/Linux. Node.js 18+, curl and tar required.
# Verify the official release's SHA256SUMS before extracting or executing setup.
set -eu
mode=
client=
install_dir=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) mode=--dry-run ;;
    --dir)
      shift
      [ "$#" -gt 0 ] || { echo "Missing install directory" >&2; exit 1; }
      install_dir=$1
      ;;
    --host)
      shift
      [ "$#" -gt 0 ] || { echo "Missing host argument" >&2; exit 1; }
      case "$1" in all|none|codex|claude) client=$1 ;; *) echo "Unsupported host" >&2; exit 1 ;; esac
      ;;
    *) echo "Usage: sh bootstrap.sh [--dry-run] [--host all|none|codex|claude] [--dir PATH]" >&2; exit 1 ;;
  esac
  shift
done
command -v node >/dev/null 2>&1 || { echo "Node.js 18+ is required" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is required" >&2; exit 1; }
node -e "if(Number(process.versions.node.split('.')[0])<18)process.exit(1)" || {
  echo "Node.js 18+ is required" >&2; exit 1;
}
umask 077
work=$(mktemp -d "/tmp/helm-bootstrap.XXXXXXXX") || exit 1
trap 'rm -rf -- "$work"' EXIT
trap 'exit 1' HUP INT TERM
api='https://api.github.com/repos/samjuniors/Helm/releases/latest'
curl -fsSL --retry 2 -H 'User-Agent: Helm-Bootstrap' "$api" -o "$work/release.json"
tag=$(node -e '
const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(j.draft||j.prerelease||!/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(j.tag_name))process.exit(1);
const names=new Set((j.assets||[]).map(a=>a.name));
if(!names.has("helm-"+j.tag_name+".tgz")||!names.has("SHA256SUMS"))process.exit(1);
process.stdout.write(j.tag_name);
' "$work/release.json") || {
  echo "GitHub did not return an installable stable Helm release" >&2; exit 1;
}
name="helm-$tag.tgz"
base="https://github.com/samjuniors/Helm/releases/download/$tag"
printf 'Helm %s - verified release bootstrap\n' "$tag"
curl -fsSL --retry 2 "$base/SHA256SUMS" -o "$work/SHA256SUMS"
curl -fsSL --retry 2 "$base/$name" -o "$work/$name"
node -e '
const fs=require("fs"),crypto=require("crypto");
const file=process.argv[1],manifest=process.argv[2],name=process.argv[3];
const bytes=fs.readFileSync(file);
if(bytes.length>33554432){console.error("TGZ exceeds safety limit");process.exit(1);}
const matches=fs.readFileSync(manifest,"utf8").split(/\r?\n/)
  .map(x=>x.match(/^([0-9a-f]{64})  \*?(.+)$/)).filter(x=>x&&x[2]===name);
const got=crypto.createHash("sha256").update(bytes).digest("hex");
if(matches.length!==1||matches[0][1]!==got){console.error("SHA-256 mismatch; refusing installation");process.exit(1);}
console.log("Verified SHA-256:",got);
' "$work/$name" "$work/SHA256SUMS" "$name"
# Check archive paths and file types before tar extraction. No symlinks/hardlinks.
tar -tzf "$work/$name" > "$work/entries.txt"
tar -tvzf "$work/$name" > "$work/types.txt"
node -e '
const fs=require("fs");
const names=fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/).filter(Boolean);
const lines=fs.readFileSync(process.argv[2],"utf8").split(/\r?\n/).filter(Boolean);
if(names.length<20||names.length>3000||lines.length!==names.length)process.exit(1);
const seen=new Set();
for(let i=0;i<names.length;i++){
 const n=names[i];
 const segments=n.replace(/\/$/,"").split("/");
 if(!n.startsWith("package/")||n.includes("\\")||segments.some(p=>p==="."||p===".."||p==="node_modules"||p===".git"))process.exit(1);
 if(seen.has(n)||!/^[-d]/.test(lines[i]))process.exit(1);
 seen.add(n);
}
' "$work/entries.txt" "$work/types.txt" || {
  echo "Unsafe or malformed release archive; installation stopped" >&2; exit 1;
}
mkdir -p "$work/staged"
tar -xzf "$work/$name" -C "$work/staged"
test -f "$work/staged/package/setup.mjs" || { echo "Missing setup.mjs" >&2; exit 1; }
node -e '
const p=require(process.argv[1]);
if(p.name!=="@samjuniors/helm"||("v"+p.version)!==process.argv[2])process.exit(1);
' "$work/staged/package/package.json" "$tag" || {
  echo "Release metadata does not match tag" >&2; exit 1;
}
if [ -z "$client" ] && [ -z "$mode" ] && [ -z "$install_dir" ]; then
  if [ -r /dev/tty ]; then
    echo 'Opening guided setup from your terminal; select clients, preview and approve.'
    node "$work/staged/package/wizard.mjs" < /dev/tty
    echo 'Helm setup wizard closed. Restart your coding client if you installed Helm.'
  else
    echo 'Interactive terminal unavailable. Use --host codex, --host claude, --host all or --host none for scripted installs.' >&2
    exit 1
  fi
else
  [ -n "$client" ] || client=all
  if [ "$mode" = "--dry-run" ]; then
    if [ -n "$install_dir" ]; then
      node "$work/staged/package/setup.mjs" install --host "$client" --dir "$install_dir" --dry-run
    else
      node "$work/staged/package/setup.mjs" install --host "$client" --dry-run
    fi
  else
    if [ -n "$install_dir" ]; then
      node "$work/staged/package/setup.mjs" install --host "$client" --dir "$install_dir"
    else
      node "$work/staged/package/setup.mjs" install --host "$client"
    fi
    echo 'Helm installed. Restart your coding assistant, then use helm update or helm uninstall.'
  fi
fi
