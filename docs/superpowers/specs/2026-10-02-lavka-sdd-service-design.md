# Первый сервис на пресете lavka/sdd

Пресет подключается на одном сервисе Лавки. Этот сервис доказывает доставку, не новый цикл разработки.

## Что видно после подключения

- В `aisuite.yaml` сервиса есть `lavka/sdd`.
- aisuite создаёт симлинк на `ai/artifacts/skills/teams/lavka/sdd/sdd-flow`. По пути `scripts/sdd.mjs` лежит собранная машина и, когда адаптеры уже перенесены, рядом `scripts/adapters/index.mjs`.
- `node <симлинк>/scripts/sdd.mjs` без аргументов печатает `Usage: sdd` и завершается ненулевым кодом.
- В сервисе установлен `@ojson/remote-solver`. Команда `remote-solver` есть в `node_modules/.bin` и печатает справку шпиона (`remote-solver spy`, `issue`, `review`). Это не файл из скила.
- `sandcastle.yaml` сервиса по-прежнему только про этот сервис, в том числе `comments.ignore`. Строки с путём к адаптерам в нём нет. Адаптеры включаются файлом `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs`, который уже лежит в артефактах. Пока этого файла нет, шпион остаётся на GitHub-портах пакета.
- Checkout, который шпион готовит через `arc-wt`, содержит `ai/artifacts/skills/teams/lavka/sdd`: фильтр путей, если он есть у сервиса, этот каталог включает.

Чат дальше вызывает `sdd step` через `sdd.mjs` в каталоге скила. Шпион дальше вызывается как `remote-solver spy` из установленного пакета.
