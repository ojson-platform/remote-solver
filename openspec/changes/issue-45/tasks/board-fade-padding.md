The phase header stays at the top of the board while the board scrolls

The seven phase names stay aligned with the station columns under them

A row that scrolls up fades out under the names and the names stay readable

The phase names stay over the board on a transparent header and a row that scrolls up fades out before it covers the letters

The empty band under the names goes away

At rest the first row starts at the bottom edge of the header and stays fully readable

The fade is the header's lower padding and nowhere below it

Content is gone through the letters, fades only across the padding under them, and is fully opaque from the bottom edge of the header

Scrolling a row up fades it inside those 7px and hides it before it reaches the letters

At rest the first row is not inside the fade

The header is 28px tall

The names are 10px type on a 1.35 line, centered in that 28px

The letters run from about 7px to 21px and the padding under them is the last 7px

The fade belongs in that lower padding and nowhere below it

The mask stays on the scrolling board

The names stay outside the mask, transparent, 28px tall, and aligned with the station columns

The mask fades from 20.75px to 28px

padding-top is 28px, the header height

The first row starts on that edge

The only air between the letters and the row is the header's own lower padding

## Source

Pull the fade into the header's lower padding on the board scrollport. Edit `src/window/face.css`: on `.board`, keep `mask-image` and `-webkit-mask-image`, set both to `linear-gradient(to bottom, transparent 0 20.75px, #000 28px, #000 100%)`, and set `padding-top` to `28px` while keeping the existing side inset from the `padding` shorthand. Edit `src/window/FACE.md`: replace clear-band wording in the board paragraph with the fade in the header's lower padding and the first row starting at the bottom of the header at rest. Edit `openspec/specs/phase-header/spec.md`: the purpose and the requirement shall say the same thing instead of a clear band under the names. Extend `src/window/board.test.ts` under `phase-header` so these scenarios are observed on the rendered window page: update the mask and `padding-top` assertions in "A row that scrolls up fades out under the names and the names stay readable", and add or extend scenarios for the rest of this slice.

Seams this slice uses and leaves intact: `.head` in `src/window/client/board.tsx` stays absolute, transparent, 28px tall, and outside `<main class="board">`; `.head` and `.stations` keep the shared column grid; the show path in `src/window/client/main.tsx` is untouched here.

Leave `src/window/client/main.tsx`, `src/window/client/board.tsx`, and the header height, type size, and column grid untouched.

## Proof

Test file: `src/window/board.test.ts`

Observes the rendered window page HTML and the inlined face stylesheet: the board mask and `padding-top`, the phase-name row outside the board scrollport, and where the first row starts at rest.

May read: `src/window/board.test.ts`, the page harness helpers it already imports, rendered HTML from the same paths existing board page tests use, and `src/window/face.css` only as inlined into the page.

Commands that must exit 0:

- `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.

`pnpm run test:types`
