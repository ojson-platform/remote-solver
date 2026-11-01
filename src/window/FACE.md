# Face

The window's look. Control names are in `CONTEXT.md`. Colour values are `FACE` in `face.ts`, repeated by `:root` in `face.css`. Measures live in `face.css`. This file says what each role is for.

Update this file in the same session as a change to a role: the ground, which colour a control wears, or which shape a named control uses.

## Ground

The field is a slant, darker at the key and lighter toward the drawer, with a quiet grain. The slant is fixed to the window, so a translucent layer samples a different ground than the layer beside it.

The top bar is transparent, so the ground shows through it. The drawer starts under the bar and stands in from the window edges: a rounded sheet of haze. The ground tints the sheet, and a short blur keeps the type calm. An open section head is dark brass: brass mixed with ink on brass, at nine tenths. It has no frame and no corner radius, and it sits flush with the sheet. A line scrolling under it fades into that brass. The settings sheet and a popup stay raised solids (`--bg-2`). The ground shows in the field around the drawer.

## Colour

**Ink** (`--ink`) is text and the lockup.

**Ink on brass** (`--ink-brass`) is text on a brass control.

**Muted** (`--muted`) is secondary text. A pull-request parenthesis is muted, link included, so it is not an action.

**Brass** (`--brass`) is the only action colour. A block has one brass pill. The waiting strip, the standing plaque's hairline, a focused field's hairline, the station ring, and the current layer's dot are brass.

**Hairline** (`--line`) is the quiet card's edge. A hairline pill is a secondary name.

**Green** (`--green`) and **red** (`--red`) are marks, not actions.

## Controls

The pool card and a comment field share one quiet frame. A focused field turns its hairline brass. The acceptance control uses the plaque's frame. The set gate sign is larger than the empty circle. A task's open or done mark is a short chip, not a pill.

The edge is a bright line with light inside the shape. A task chip wears it, brass when open and green when done. While the pointer is over a small circle, the circle grows slightly and wears the edge: the take circle, the breakdown circle, a layer door, and the line field's close circle. A broken door wears that edge in red. A close mark, the gear, the send mark, the empty gate, and the set gate only grow. A wide control wears the edge and keeps its size: the station plaque, a role verb, a hairline pill, and a task jump. The cycle card takes the open card's brass hairline. A brass pill lightens and grows. A document line, a diff row, a capability summary, and a folded-lines bar take a quiet brass wash. A closed section head takes that wash too, and the wash runs flush with the sheet. The waiting strip glows along itself. A green or red mark stays flat: a wash on the diff row, a coloured word in the section head.

## Specs

A spec names the control and what it does. The colour, the ground, and the measure stay here and in the stylesheet.
