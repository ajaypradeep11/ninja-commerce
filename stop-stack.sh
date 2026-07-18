#!/usr/bin/env bash
# Stops everything start-stack.sh launched (by recorded PID, then by port).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUIET="${1:-}"
say() { [ "$QUIET" = "--quiet" ] || echo "$@"; }

if [ -d "$ROOT/.stack/pids" ]; then
  for pf in "$ROOT"/.stack/pids/*.pid; do
    [ -e "$pf" ] || continue
    pid="$(cat "$pf" 2>/dev/null || true)"; name="$(basename "$pf" .pid)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      say "⏹  stopping $name (pid $pid)"
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pf"
  done
fi

# Fallback: free the dev-server ports in case a child outlived its parent.
for port in 3002 3005 5174; do
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  [ -n "$pids" ] && { say "⏹  freeing port $port"; echo "$pids" | xargs kill 2>/dev/null || true; }
done

say "stack stopped."
