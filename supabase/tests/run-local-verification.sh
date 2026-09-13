#!/usr/bin/env bash
# TASK-002 local verification harness.
#
# Spins up a disposable, local-only Postgres cluster (no Docker, no network,
# no Supabase project, no credentials of any kind), applies the local auth
# shim, every migration under supabase/migrations/, the dev seed data, and
# the RLS/immutability test suite, then tears the cluster down.
#
# This never touches a hosted Supabase project and never requires a secret.
set -euo pipefail

# Homebrew's postgres can crash on macOS with "postmaster became
# multithreaded during startup" under some inherited locale environments;
# forcing C avoids the ICU/CoreFoundation threading path that triggers it.
export LC_ALL=C
export LANG=C

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/mitiga-task002-pg.XXXXXX")"
PGDATA="$WORKDIR/data"
SOCKDIR="$WORKDIR/sock"
LOGFILE="$WORKDIR/postgres.log"

cleanup() {
  pg_ctl -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

mkdir -p "$SOCKDIR"
initdb -D "$PGDATA" -U postgres --auth=trust --no-locale --encoding=UTF8 >/dev/null

pg_ctl -D "$PGDATA" -o "-k $SOCKDIR -h '' -p 5433" -l "$LOGFILE" start

PSQL=(psql -v ON_ERROR_STOP=1 -h "$SOCKDIR" -p 5433 -U postgres -d postgres)

echo "==> applying local auth shim"
"${PSQL[@]}" -f "$ROOT_DIR/supabase/tests/000-local-auth-shim.sql"

echo "==> applying migrations"
for f in "$ROOT_DIR"/supabase/migrations/*.sql; do
  echo "    - $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "==> applying dev seed data"
"${PSQL[@]}" -f "$ROOT_DIR/supabase/seed.sql"

echo "==> running SQL verification suites"
for f in "$ROOT_DIR"/supabase/tests/[0-9][0-9][0-9]-*.sql; do
  if [[ "$(basename "$f")" == 000-* ]]; then
    continue
  fi
  echo "    - $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "==> all checks passed"
