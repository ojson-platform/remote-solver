---
status: accepted
---

# One marker grammar, and `thread fix` closes a thread in one call

`src/machine/marker.ts` holds the marker grammar: `parseMarker(body)` returns a layer, `note`, `fixed <commit>`, `begin`, or nothing, and every reader goes through it — `threads`, the machine's review view, the conversation layer, the unanswered check, and the reviewer's forbidden-text filter. Any marker answers a reply; only a layer opens a phase. A thread whose latest reply is `sdd:fixed` is done: not unanswered, not a layer, not in `threads --unmarked`. `threads` prints `conversation.unanswered` from the same rule, and `thread fix` replies `sdd:fixed <HEAD>` and resolves in one call, refusing while HEAD is not on the pushed `sdd/<issue>`.

Before, five readers matched the tokens themselves and disagreed: only the conversation layer knew `sdd:fixed`. Fix thread was two calls, `thread reply … 'sdd:fixed <commit>'` then `thread resolve`. A run that ended between them left an open thread whose latest reply was `sdd:fixed`; the machine read it as unanswered and started `classify-comments`, which found it in `threads --unmarked` and labelled an already fixed thread again, and round it went. The skill prose repeated the token list a third time.

Keeping two calls and teaching only `reviewOf` about `sdd:fixed` was rejected: the next reader to match tokens by hand drifts again, and a reply can still cite a commit that was never pushed.
