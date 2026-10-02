# Синхронизация в ai/artifacts

Каталог в транке — `ai/artifacts/skills/teams/lavka/sdd`. Пресет — `ai/artifacts/presets/lavka/sdd.yaml`. aisuite линкует в сервис каждый каталог скила из пресета. Отдельной копии нет.

Скрипт `ai/artifacts/skills/teams/lavka/sdd/sync.sh` заполняет этот каталог из опубликованного пакета `@ojson/remote-solver`. Аргумент — версия, например `0.0.1`. Скрипт вызывает `npm pack @ojson/remote-solver@<версия>`, распаковывает tar во временный каталог и копирует оттуда только скилы. Чекаут репозитория и GitHub ему не нужны. `npm install` он не делает: в каталог артефактов не попадают `node_modules` и зависимости шпиона.

`npm pack` ходит в registry, который настроен у `npm` на машине запуска. Скрипт запускается там, где этот registry или его зеркало отдаёт `@ojson/remote-solver`; второй аргумент `--registry <url>` передаётся в `npm pack` как есть.

## Что скрипт копирует

Два скила из каталога `package/` внутри tar.

`skills/sdd-init/SKILL.md` копируется в `sdd-init/SKILL.md`.

Из `skills/sdd-flow` копируются `SKILL.md`, `CONTEXT.md`, каталог `steps/` и файл `scripts/sdd.mjs`. Файла `scripts/sdd.mjs` в tar нет — скрипт завершается с кодом 1 и текстом `published package has no skills/sdd-flow/scripts/sdd.mjs`. В tar есть `src/` — код 1 и текст `published package contains src`. Над `scripts/sdd.mjs` в артефактах нет `package.json`, расширение `.mjs` делает файл ESM без него.

`sdd-flow/scripts/adapters/` скрипт не трогает и не удаляет. Это исходники Аркадии, не публичного пакета.

`bin/remote-solver.mjs` и `prompts/` в tar для шпиона есть. Скрипт их в Аркадию не копирует. `src/` в tar нет.

## Пресет

Скрипт пишет `ai/artifacts/presets/lavka/sdd.yaml`:

```yaml
name: "Lavka SDD"
description: >
  One issue, one review, one change. The chat drives sdd from the sdd-flow
  skill.
skills:
  - teams/lavka/sdd/sdd-flow
  - teams/lavka/sdd/sdd-init
```

Повторный запуск заменяет скопированные `SKILL.md`, `CONTEXT.md`, `steps/`, `scripts/sdd.mjs` и файл пресета. Каталог `sdd-flow/scripts/adapters` остаётся.
