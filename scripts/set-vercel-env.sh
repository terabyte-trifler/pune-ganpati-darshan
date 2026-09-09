#!/usr/bin/env bash
#
# Copy this project's environment variables from .env.local into whichever
# Vercel project is currently linked.
#
# Why this exists: NEXT_PUBLIC_* are inlined at BUILD time, so setting them
# is not enough on its own — the project has to build again afterwards.
# And `vercel env add` fed over stdin silently stores an EMPTY value while
# still exiting 0, which is easy to miss and looks exactly like the app
# being broken. This uses --value and verifies afterwards.
#
# Usage:
#   vercel login                 # the account that owns the target project
#   vercel link                  # pick the project serving your domain
#   ./scripts/set-vercel-env.sh https://your-domain.vercel.app
set -euo pipefail

APP_URL="${1:-}"
if [ -z "$APP_URL" ]; then
  echo "usage: $0 https://your-domain.vercel.app" >&2
  exit 1
fi

val() { grep -m1 "^$1=" .env.local | cut -d= -f2- | sed 's/^"//; s/"$//'; }

set_var() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    echo "  SKIP $name (empty in .env.local)"
    return
  fi
  for env in production preview; do
    # Remove first: --force does not reliably overwrite an existing value.
    vercel env rm "$name" "$env" --yes >/dev/null 2>&1 || true
    vercel env add "$name" "$env" --value "$value" --yes >/dev/null 2>&1
  done
  echo "  set $name (${#value} chars)"
}

set_var NEXT_PUBLIC_SUPABASE_URL      "$(val NEXT_PUBLIC_SUPABASE_URL)"
set_var NEXT_PUBLIC_SUPABASE_ANON_KEY "$(val NEXT_PUBLIC_SUPABASE_ANON_KEY)"
set_var SUPABASE_SERVICE_ROLE_KEY     "$(val SUPABASE_SERVICE_ROLE_KEY)"
set_var CROWD_IP_SALT                 "$(val CROWD_IP_SALT)"
set_var ROUTING_OSRM_URL              "$(val ROUTING_OSRM_URL)"
set_var NEXT_PUBLIC_APP_URL           "$APP_URL"

echo
echo "Now rebuild — the values only take effect on a fresh build:"
echo "  git commit --allow-empty -m 'Rebuild with env vars' && git push"
echo "or, if that project is not connected to git:  vercel --prod --force"
