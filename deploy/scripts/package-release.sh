#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo 'Usage: package-release.sh <release-directory> <artifact-directory> <commit>' >&2
  exit 1
fi

release_directory="$1"
artifact_directory="$2"
commit="$3"

[[ "$commit" =~ ^[a-f0-9]{40}$ ]] || { echo 'Commit must be a 40-character lowercase SHA.' >&2; exit 1; }
[[ -d "$release_directory" ]] || { echo 'Release directory does not exist.' >&2; exit 1; }

mkdir -p "$artifact_directory"
release_directory="$(cd "$release_directory" && pwd -P)"
artifact_directory="$(cd "$artifact_directory" && pwd -P)"

if find "$artifact_directory" -mindepth 1 -print -quit | grep -q .; then
  echo 'Artifact directory must be empty.' >&2
  exit 1
fi

if find "$release_directory" -type l -print -quit | grep -q .; then
  echo 'Release tree must not contain symbolic links.' >&2
  exit 1
fi

archive="$artifact_directory/rylay-$commit.zip"
checksum="$archive.sha256"

(
  cd "$release_directory"
  TZ=UTC find . -exec touch -h -d '@0' {} +
  zip -X -q -r "$archive" .
)

(
  cd "$artifact_directory"
  sha256sum "$(basename "$archive")" > "$(basename "$checksum")"
)

entries="$(unzip -Z1 "$archive")"
[[ "$(printf '%s\n' "$entries" | grep -xc 'release-manifest.json')" -eq 1 ]] || {
  echo 'Archive must contain exactly one release-manifest.json.' >&2
  exit 1
}

if printf '%s\n' "$entries" | grep -Eiq '(^|/)(\.env([^/]*)?|node_modules|test-results|auth\.json|htpasswd|id_rsa|id_ed25519)(/|$)|\.(sqlite|sqlite3|pem|key)$|^/|\.\./'; then
  echo 'Archive contains a forbidden path.' >&2
  exit 1
fi

echo "Release artifact created: $(basename "$archive")"
