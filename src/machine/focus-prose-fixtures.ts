/** Canonical Russian focus bodies skills pass to the focus verb (marker line + prose). */
export const FOCUS_BODIES = {
  planClean:
    'sdd:focus:plan\nДля читателя тикета появится фокус-комментарий на каждую фазу; отказались от автогенерации прозы из diff.\n',
  planOpenQuestions:
    'sdd:focus:plan\nДля читателя тикета появится фокус-комментарий на каждую фазу; отказались от автогенерации прозы из diff.\n\nВ proposal.md остаётся 2 открытых вопроса.\n',
  spec:
    'sdd:focus:spec\nНовое обещание — проза фазы; изменено обещание о комментарии на issue. Без сценария «The prose is Russian, short, and has no headings» решение непонятно. Обещание про пагинацию комментариев issue не даём.\n',
  design:
    'sdd:focus:design\nПоведение живёт в focus.ts и шагах skills; отвергли генерацию текста из diff. Окно не переписывает прозу — сознательно не строим. Наблюдаем в focus.test.ts и окне.\n',
  tasks:
    'sdd:focus:tasks\nСначала маркеры, затем правила Publish, затем проза комментария; слайс window-focus-display ждёт focus-prose-comment.\n',
  code:
    'sdd:focus:code\nПосле коммита validateFocusBody отвергает diff и выбор фазы; window не трогали. Типы проходят, но не доказывают русскую прозу.\n',
  accept:
    'sdd:focus:accept\nЕсть фокус на issue и правила в CONTEXT; окно и пагинацию намеренно не включали. Одна capability focus, 24 сценария, тесты покрывают.\n',
  whole:
    'sdd:focus\nВесь PR закрывает gap «focus a person reads» без ledger в комментарии.\n',
  specThreadFix:
    'sdd:focus:spec\nДельта фиксирует форму прозы на issue; первый абзац отвечает на вопрос фазы Specify.\n\nЗамечание «нужен русский текст» — добавили проверку кириллицы; сценарий «The prose is Russian, short, and has no headings».\n\nЕщё смотреть window-focus-display.\n',
  planWeak:
    'sdd:focus:plan\nДля читателя тикета scope ясен; отказались от ledger; слабое место — формулировка Outcome для archive.\n',
  tasksClean:
    'sdd:focus:tasks\nТри слайса по порядку: маркеры, проза, окно; window-focus-display ждёт focus-prose-comment.\n',
  planThreadFix:
    'sdd:focus:plan\nДля читателя тикета уточнили отказ от diff; первый абзац отвечает на вопрос Plan.\n\nЗамечание про ledger — убрали из прозы.\n',
  specRefusalSecond:
    'sdd:focus:spec\nНовое обещание — проза; изменено обещание о маркере. Сценарий «The prose is Russian» без него непонятен. Пагинацию не даём.\n\nОтказались включать пагинацию комментариев в этот PR.\n',
  designClean:
    'sdd:focus:design\nПоведение живёт в focus.ts; отвергли ledger в комментарии. Окно не переписывает — сознательно не строим. Наблюдаем в focus.test.ts.\n',
} as const;
