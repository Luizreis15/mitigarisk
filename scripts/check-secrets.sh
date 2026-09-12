#!/bin/sh
set -eu

tracked_env_files="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v -E '\.env\.example$' || true)"

if [ -n "$tracked_env_files" ]; then
  echo "Secret check failed: tracked environment files found."
  echo "$tracked_env_files"
  exit 1
fi

secret_patterns='(re_[A-Za-z0-9_]{24,}|sb_secret_[A-Za-z0-9_]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)'

if git grep -nI -E "$secret_patterns" -- . ':!scripts/check-secrets.sh'; then
  echo "Secret check failed: a value resembling a credential was found."
  echo "Rotate the credential before removing it from the repository."
  exit 1
fi

echo "Secret check passed."
