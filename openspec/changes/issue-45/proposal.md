## Problem

Today the fade is a tall empty strip. `.board` has `padding-top: 88px` and this mask:

linear-gradient(to bottom, transparent 0 28px, #000 68px, #000 100%)

The names occupy the top 28px. Content is invisible through that 28px, then fades across the next 40px, and the first row is pushed down to 88px so it sits clear of the fade. That gap is what looks wrong.

## Outcome

The phase names stay over the board, on a transparent header, and a row that scrolls up still fades out before it covers the letters. The empty band under the names goes away. At rest the first row starts at the bottom edge of the header and stays fully readable.

The fade is the header's lower padding and nowhere below it. Content is gone through the letters, fades only across the padding under them, and is fully opaque from the bottom edge of the header. Scrolling a row up fades it inside those 7px and hides it before it reaches the letters. At rest the first row is not inside the fade.

## Scope

The fade under the phase names, and where the first row starts at rest. The words that still describe the tall band follow that: the fade is the header's lower padding, and at rest the first row starts at the bottom of the header, fully readable. The scenario "A row that scrolls up fades out under the names and the names stay readable" follows that.

## Out of scope

A dark bar behind the names. Moving the names back into the scrolling board. A fade that runs down into the first row. Changing the header height, the type size, or the column grid.

## Constraints

The header is 28px tall. The names are 10px type on a 1.35 line, centered in that 28px. Measured on the approved look: the letters run from about 7px to 21px, so the padding under the letters is the last 7px of the header, from 20.75px to 28px. The fade belongs in that lower padding and nowhere below it.

Keep the mask on the scrolling board. Keep the names in the absolute `.head`, outside the mask, transparent, 28px tall, aligned with the station columns. The mask is `linear-gradient(to bottom, transparent 0 20.75px, #000 28px, #000 100%)`, with the `-webkit-mask-image` prefix as well. `padding-top` is `28px`, the header height. The first row then starts on that edge. The only air between the letters and the row is the header's own lower padding.

A shown card clears the fade by the board's computed `padding-top`. That lead stays tied to the padding, so a shown card clears the fade when the padding changes. No second offset.

## Capabilities

### Added

### Modified

- `phase-header` the fade is the header's lower padding, and at rest the first row starts at the bottom of the header, fully readable

## Open questions

none
