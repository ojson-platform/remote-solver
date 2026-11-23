#!/bin/sh
name=$(basename "$0")
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
trace=${EVAL_TRACE:-/dev/null}
code=0

# Act follows the print. Reprinting the decision gives the agent the same wait it was shown.
if [ "$name" = sdd ] && [ "${1:-}" = step ] && [ -f "$root/bin/decision.json" ]; then
  cat "$root/bin/decision.json"
  printf '\n'
fi
# The next message runs step again only when the branch moves. A rebase that leaves HEAD is not that.
if [ "$name" = sdd ] && [ "${1:-}" = rebase ]; then
  if GIT_AUTHOR_NAME=eval GIT_AUTHOR_EMAIL=eval@example.com \
    GIT_COMMITTER_NAME=eval GIT_COMMITTER_EMAIL=eval@example.com \
    git -C "$root" commit --allow-empty -m rebase >/dev/null
  then
    printf '%s\n' rebased
  else
    code=1
  fi
fi
# The chat edits in the directory worktree prints. This checkout is that directory.
if [ "$name" = sdd ] && [ "${1:-}" = worktree ]; then
  printf '%s\n' "$root"
fi

printf '%s' "$name" >> "$trace"
printf ' %s' "$@" >> "$trace"
printf ' exit=%s\n' "$code" >> "$trace"
exit "$code"
