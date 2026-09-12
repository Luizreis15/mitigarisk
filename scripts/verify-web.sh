#!/bin/sh
set -eu

repository_root="$(git rev-parse --show-toplevel)"
cd "$repository_root/apps/web"

npm run lint -- --ignore-pattern 'components/ui/**' --ignore-pattern 'hooks/use-mobile.ts'
npm run build

echo "Web verification passed."
