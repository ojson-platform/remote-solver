#!/bin/sh
name=$(basename "$0")
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
mode=$(cat "$root/bin/mode" 2>/dev/null || printf '%s' 'threads-only')
trace=${EVAL_TRACE:-/dev/null}

layer_code() {
  case "$mode" in
    repair-foreign) printf '%s' 1 ;;
    repair-card)
      n=$(grep -c '^layer ' "$trace" 2>/dev/null || true)
      if [ "$n" = 0 ]; then printf '%s' 1; else printf '%s' 0; fi
      ;;
    *) printf '%s' 0 ;;
  esac
}

tree_clean() {
  list="$root/bin/keep.list"
  [ -f "$list" ] || return 0
  flag="$trace.dirty"
  rm -f "$flag"
  find "$root/src" "$root/openspec" -type f 2>/dev/null | while IFS= read -r f; do
    rel=${f#"$root/"}
    case "$rel" in
      src/paint.ts|src/paint.test.ts) continue ;;
    esac
    if ! grep -qx "$rel" "$list" || ! cmp -s "$f" "$root/bin/orig/$rel"; then
      printf '%s' 1 > "$flag"
    fi
  done
  if [ -f "$flag" ]; then
    rm -f "$flag"
    return 1
  fi
  return 0
}

test_code() {
  case "$mode" in
    fix-always-red) printf '%s' 1; return ;;
    fix-example) ;;
    *) printf '%s' 0; return ;;
  esac
  phrase='вторая покрытая строка'
  if grep -q "$phrase" "$root/src/paint.test.ts" && ! cmp -s "$root/src/paint.ts" "$root/bin/paint.orig" && tree_clean; then
    printf '%s' 0
  else
    printf '%s' 1
  fi
}

code=0
if [ "$name" = layer ]; then
  code=$(layer_code)
fi
if [ "$name" = sdd ] && [ "${1:-}" = test ]; then
  code=$(test_code)
fi

if [ "$name" = layer ]; then
  case "$mode" in
    repair-near) printf '%s\n' 'near paint A covered line shows the node value' ;;
    repair-foreign) printf '%s\n' 'fail src/other.ts' ;;
    repair-card)
      if [ "$code" = 1 ]; then printf '%s\n' 'fail src/paint.ts'; else printf '%s\n' ok; fi
      ;;
    *) printf '%s\n' ok ;;
  esac
fi
if [ "$name" = typecheck ]; then
  printf '%s\n' ok
fi
if [ "$name" = sdd ] && [ "${1:-}" = threads ]; then
  if [ -f "$root/threads.md" ]; then
    cat "$root/threads.md"
  elif [ -f "$root/inbox.md" ]; then
    cat "$root/inbox.md"
  fi
fi
if [ "$name" = sdd ] && [ "${1:-}" = conversation ] && [ -f "$root/inbox.md" ]; then
  cat "$root/inbox.md"
fi

printf '%s' "$name" >> "$trace"
printf ' %s' "$@" >> "$trace"
printf ' exit=%s\n' "$code" >> "$trace"
exit "$code"
