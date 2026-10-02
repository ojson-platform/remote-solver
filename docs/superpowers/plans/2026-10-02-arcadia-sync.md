# Arcadia Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One script unpacks the two skills from the published `@ojson/remote-solver` tarball into `ai/artifacts` and writes the `lavka/sdd` preset.

**Architecture:** The script lives in Arcadia, not in the public package. It runs `npm pack` for one version, copies the skill allowlist, and refuses to build or `npm install`. The adapter directory already in the destination is left untouched.

**Tech Stack:** bash.

## Global Constraints

- Публичный пакет не импортирует Трекер, Арканум и arc. Ключа `host` нет.
- Машина чата — `skills/sdd-flow/scripts/sdd.mjs`. Шпион — `bin/remote-solver.mjs` пакета `@ojson/remote-solver`.
- `createAdapters(root, config)` возвращает `{config?, tracker, review, vcs}`. Runtime строит пакет.
- Каталог артефактов — `ai/artifacts/skills/teams/lavka/sdd`. Пресет — `ai/artifacts/presets/lavka/sdd.yaml`.
- Коммит в remote-solver — одна фраза, без префикса `feat:`. Скрипт коммитится в Аркадию отдельным изменением.
- Проверка пакета: `pnpm test -- <файл>` из `devops/remote-solver`.

---

### Task 1: sync.sh

**Files:**
- Create: `ai/artifacts/skills/teams/lavka/sdd/sync.sh`
- Create: `ai/artifacts/presets/lavka/sdd.yaml` (the script writes it)

**Interfaces:**
- Consumes: `npm pack @ojson/remote-solver@<version>`. The tarball's `package/` directory contains `skills/sdd-flow/scripts/sdd.mjs` and the two skill trees, and does not contain `src/`.
- Produces: `sdd-flow/` (`SKILL.md`, `CONTEXT.md`, `steps/`, `scripts/sdd.mjs`) and `sdd-init/SKILL.md`, plus the preset file

- [ ] **Step 1: Write the script**

`sync.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

version="${1:-}"
if [[ -z "$version" ]]; then
  echo "usage: sync.sh <version> [--registry <url>]" >&2
  exit 1
fi
shift
registry=()
if [[ "${1:-}" == "--registry" && -n "${2:-}" ]]; then
  registry=(--registry "$2")
fi

dest="$(cd "$(dirname "$0")" && pwd)"
preset="$(cd "$dest/../../../.." && pwd)/presets/lavka/sdd.yaml"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

(
  cd "$work"
  npm pack "${registry[@]}" "@ojson/remote-solver@${version}"
)
tar -xzf "$work"/*.tgz -C "$work"
root="$work/package"

if [[ -e "$root/src" ]]; then
  echo "published package contains src" >&2
  exit 1
fi
if [[ ! -f "$root/skills/sdd-flow/scripts/sdd.mjs" ]]; then
  echo "published package has no skills/sdd-flow/scripts/sdd.mjs" >&2
  exit 1
fi

mkdir -p "$dest/sdd-init" "$dest/sdd-flow/steps" "$dest/sdd-flow/scripts"
rm -f "$dest/sdd-flow/steps/"*.md
cp "$root/skills/sdd-init/SKILL.md" "$dest/sdd-init/SKILL.md"
cp "$root/skills/sdd-flow/SKILL.md" "$dest/sdd-flow/SKILL.md"
cp "$root/skills/sdd-flow/CONTEXT.md" "$dest/sdd-flow/CONTEXT.md"
cp "$root/skills/sdd-flow/steps/"*.md "$dest/sdd-flow/steps/"
cp "$root/skills/sdd-flow/scripts/sdd.mjs" "$dest/sdd-flow/scripts/sdd.mjs"
chmod +x "$dest/sdd-flow/scripts/sdd.mjs"

cat > "$preset" <<'EOF'
name: "Lavka SDD"
description: >
  One issue, one review, one change. The chat drives sdd from the sdd-flow
  skill.
skills:
  - teams/lavka/sdd/sdd-flow
  - teams/lavka/sdd/sdd-init
EOF
```

The four `..` from `skills/teams/lavka/sdd` land on `ai/artifacts`. Check that once on a mount: `dirname` of the script is `.../sdd`, and `$dest/../../../..` is `ai/artifacts`.

- [ ] **Step 2: Run it against a packed fixture**

The script's dest is its own directory. Copy `sync.sh` into a temp directory that mimics `ai/artifacts/skills/teams/lavka/sdd`. Put `sdd-flow/scripts/adapters/index.mjs` there before the run. Put a stub `npm` first on `PATH`: when argv is `pack @ojson/remote-solver@0.0.1`, it writes a `.tgz` in the cwd whose `package/` tree has `skills/sdd-init/SKILL.md`, `skills/sdd-flow/SKILL.md`, `CONTEXT.md`, `steps/plan.md`, `scripts/sdd.mjs`, and decoys `bin/remote-solver.mjs` and `prompts/sdd.md`. It does not contain `src/`.

Run `sync.sh 0.0.1`.

Expected: `sdd-flow` has `SKILL.md`, `CONTEXT.md`, `steps/plan.md`, and `scripts/sdd.mjs`. `sdd-init/SKILL.md` exists. `adapters/index.mjs` is still the planted file. Neither `bin/` nor `prompts/` was copied. The preset lists only `teams/lavka/sdd/sdd-flow` and `teams/lavka/sdd/sdd-init`.

Run again with a stub tarball that also contains `src/sdd.ts`. Expected: exit 1, stderr `published package contains src`.

Run again with a stub tarball that has no `scripts/sdd.mjs` and no `src/`. Expected: exit 1, stderr `published package has no skills/sdd-flow/scripts/sdd.mjs`.

- [ ] **Step 3: Commit in Arcadia**

Commit `sync.sh` and the generated preset in the Arcadia review. Do not commit `node_modules` or a copy of `src/`.
