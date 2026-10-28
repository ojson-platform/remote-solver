## Verification boundary

plaque-key is observed on the drawn board row: the key as a link or as text, and activation of the key and of the title.

One file: `pnpm test -- <test-file>`
Layer: `pnpm test`
Fast suite: none
`pnpm run test:types`
Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The spec id is the capability id, and the scenario name is the scenario title.

## External contracts

none

## Technical prerequisites

none

## Approach

When the ticket names a repository, the row's key is a link to `https://github.com/<repo>/issues/<key>` and stands outside the title's open control. The title stays the control that opens and closes the sidebar. A ticket with no repository keeps the key as text inside that control. The link is present whenever the repository is named.

`WindowTicket.repo` is already the repository, `owner/repo`. The board builds the issue href from that repository and the key, and copies it onto the cycle card and the pool card. The snapshot carries the href on the row. The client draws it on the key in the gutter. The station plaque and the station door stay as they are. The key link keeps the `.key` face.

The key and the title are two controls when a repository is named. The key is an anchor beside the title button, so activation follows the issue page. The title button still posts open. The take control stays the corner circle. A pool row stays draggable.

Отклонено: оставить ключ внутри кнопки заголовка. Это один контрол, и активация открывает или закрывает сайдбар.
Отклонено: просить URL у порта ревью. Репозиторий уже назван на тикете, и изменение ничего не ждёт от другого сервиса.
Отклонено: ссылка на pull request. Дверь станции уже открывает файл изменения.

## Open decisions

none
