#!/bin/bash
# Poll DC-A1..A5 every 10 min until 21:18 UTC; rebuild when lane files change.
E=/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence
cd "$E" || exit 1
last=$(cat DC-A7/.last_listing 2>/dev/null)
while :; do
  cur=$(find DC-A1 DC-A2 DC-A3 DC-A4 DC-A5 -type f \( -name '*.json' -o -name '*.geojson' \) -not -path '*/raw/*' -printf '%T@ %s %p\n' | sort -k3)
  if [ "$cur" != "$last" ]; then
    python3 DC-A7/poll_summary.py > DC-A7/poll_last.txt 2>&1 && st=ok || st=FAILED
    echo "$(date -u +%H:%M) lanes changed; rebuild $st; $(grep -o '"sites": [0-9]*' DC-A7/poll_last.txt)"
    last=$cur; echo "$cur" > DC-A7/.last_listing
  else
    echo "$(date -u +%H:%M) no lane change"
  fi
  [ "$(date -u +%H%M)" -ge 2108 ] && { echo "deadline reached"; exit 0; }
  sleep 600
done
