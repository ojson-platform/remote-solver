# Сборка машины sdd и шпиона

`pnpm build` пишет два файла.

`skills/sdd-flow/scripts/sdd.mjs` — машина чата, вход `src/sdd.ts`. После сборки файл запускается через `node` без `node_modules` рядом. `@ai-hero/sandcastle` в него не попадает: `machine()` runtime не строит, а `sdd.ts` не импортирует `runtime.ts`, `agent.ts` и `host-sandbox.ts`. Тест бандла читает собранный файл и проверяет, что строки `@ai-hero/sandcastle` в нём нет.

`bin/remote-solver.mjs` — шпион, вход `src/cli.ts`. `@ai-hero/sandcastle` для него `external`: пакет остаётся dependency и ставится через `npm install`. В файл шпиона библиотека не запекается. Сегодняшний `bin/remote-solver.mjs` (запуск `tsx`) заменяется этим выводом сборки; `bin/sdd.mjs` удаляется.

`package.json` `bin.sdd` указывает на `./skills/sdd-flow/scripts/sdd.mjs`. `bin.remote-solver` указывает на `./bin/remote-solver.mjs`. Скилы вызывают `scripts/sdd.mjs` по относительному пути.

## Файлы

- Формат ESM, целевая платформа `node`, shebang `#!/usr/bin/env node`. Расширение `.mjs`: над копией в `ai/artifacts` нет `package.json`, и `.js` Node прочитал бы как CommonJS.
- Каталог `adapters` рядом со скриптом в бандл не запекается. Загрузка идёт в рантайме по правилу из спеки пакетирования: `import()` файла `adapters/index.mjs`, если он есть.
- `arc` и `ya` в файл не попадают. Они должны быть на машине, когда адаптер их вызывает.
- Условие запуска в конце `sdd.ts` и `cli.ts` принимает и `.ts`, и `.mjs` в `argv[1]`.

`node skills/sdd-flow/scripts/sdd.mjs` без аргументов завершается ненулевым кодом и печатает строку `Usage: sdd`. `node bin/remote-solver.mjs` без аргументов завершается ненулевым кодом и печатает `remote-solver spy`.

Оба файла коммитятся. `prepublishOnly` запускает `pnpm build` перед упаковкой, так что в tar попадают только что собранные файлы. В tar есть `scripts/sdd.mjs` и `bin/remote-solver.mjs`, `src/` в tar нет. Скрипт синхронизации берёт скилы из этого tar и сам пакет не собирает.

## Скрипт сборки

`scripts/build-sdd.mjs` принимает `--outdir <каталог>`. Без него пишет в репозиторий: `skills/sdd-flow/scripts/sdd.mjs` и `bin/remote-solver.mjs`. С ним — `sdd.mjs` и `remote-solver.mjs` в указанный каталог. Тест бандла собирает во временный каталог и рабочее дерево не меняет. Что закоммиченные файлы не отстали, проверяет CI: `pnpm build && git diff --exit-code`.

## solverRoot

`solverRoot()` идёт вверх от выполняемого файла до каталога, чей `package.json` имеет `"name": "@ojson/remote-solver"`. Оба собранных файла и исходники под vitest находят один корень. Копия `sdd.mjs` в `ai/artifacts` такого `package.json` над собой не имеет: там `solverRoot()` возвращает каталог на два уровня выше файла, и `packageLinks` отдаёт пустой список, потому что `skills/`, `prompts/` и `.env` там не лежат.

## Зависимости сборки

`esbuild` — devDependency. В `dependencies` пакета он не появляется. `tsx` из `dependencies` убирается. `@ai-hero/sandcastle` остаётся dependency шпиона.
