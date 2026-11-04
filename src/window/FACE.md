# Face

The window's look. Control names are in `CONTEXT.md`. Colour values are `FACE` in `face.ts`, repeated by `:root` in `face.css`. Measures live in `face.css`. This file says how the room is built, and what each role is for.

Update this file in the same session as a change to that look: the room, the board, the drawer, the type, the ground, which colour a control wears, or which shape a named control uses.

## Room

The face is dark. The window is one locked room. The bar stays. The board scrolls inside the room. The drawer scrolls inside itself.

The board lies on the ground and has no slab of its own. The drawer is a sheet standing in from the right, under the bar, and the board keeps the full field. Around the drawer the ground stays visible. Settings and a popup are raised solids on a veil. A group inside the settings sheet is a darker solid.

The bar holds the lockup, the lamp, the spy line, and the gear. The lamp is the only sign that steps are running: muted while they stand, green while they run. A row does not grow a step mark.

## Board

The board is a column of keys and then the stations, in one grid. A station name is a small tracked capital on one line, and a long name is cut. The board does not scroll sideways. The phase name row stays over the board while ticket rows scroll. The names have no ground of their own. A row that scrolls up fades out in the header's lower padding under the letters, and at rest the first row starts at the bottom of the header, fully readable.

A column has no frame. An edge on the board is an inset ring on a tile, a plaque, or a circle. The board casts no shadow.

The pool tile is a quiet frame. A key in the pool is muted. A key of a taken cycle is brass. The standing place is the plaque, the only filled brass frame on the board. An open cycle keeps that tile and turns the ring brass. A quiet station is a dot. A door and a gate are circles in the station.

## Drawer

The drawer is one document. Its sections are rows of type, divided by a hairline. A closed section is a row. An open section head is a dark brass band, flush with the sheet, and it stays at the top of the scroll. A frame inside the document is a field, a pill, a chip, or a jump.

## Type

The window speaks in a small grotesque. A key, a file path, and a capability name are monospaced. A station name, a kicker, and the small line of a verb are tracked capitals. The settings sheet title is the only serif.

## Ground

The field is a slant, darker at the key and lighter toward the drawer, with a quiet grain. The slant is fixed to the window, so a translucent layer samples a different ground than the layer beside it.

The top bar is transparent, so the ground shows through it. The drawer is a rounded sheet of haze. The ground tints the sheet, and a short blur keeps the type calm. An open section head is dark brass: brass mixed with ink on brass, at nine tenths. It has no frame and no corner radius. A line scrolling under it fades into that brass. The settings sheet and a popup stay raised solids (`--bg-2`).

## Colour

**Ink** (`--ink`) is text and the lockup.

**Ink on brass** (`--ink-brass`) is text on a brass control.

**Muted** (`--muted`) is secondary text. A pull-request parenthesis is muted, link included, so it is not an action. A project name wears a hairline and stays muted.

**Brass** (`--brass`) is the only action colour. A block has one brass pill. The waiting strip, the standing plaque's hairline, a focused field's hairline, the station ring, and the current layer's dot are brass. A banner and a status line are brass sentences.

**Hairline** (`--line`) is the quiet card's edge. A hairline pill is a secondary name.

**Green** (`--green`) and **red** (`--red`) are marks, not actions.

## Controls

The pool card and a comment field share one quiet frame. A focused field turns its hairline brass. The acceptance control uses the plaque's frame. The set gate sign is larger than the empty circle. A task's open or done mark is a short chip, not a pill.

The edge is a bright line with light inside the shape. A task chip wears it, brass when open and green when done.

The **focus block** is a document row before the spine. The marker line is a monospaced badge; the prose is a quiet pre under it.

**Hammer** (`svg.hammer.mark` on the station plaque): one filled path (`M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`), blunt poll and 45° wedge with the handle through the middle, `viewBox="0 0 32 32"`, ink via `currentColor`. `transform-origin: 43.75% 93.75%` sits on the svg at the handle bottom. The stylesheet swings it about 45° around that origin and repeats (`hammer-knock` on `.plaque svg.hammer.mark` in `face.css`); it does not spin. It mounts on the plaque only while a worker stays on that phase. While the pointer is over a small circle, the circle grows slightly and wears the edge: the take circle, the breakdown circle, a layer door, and the line field's close circle. A broken door wears that edge in red. A close mark, the send mark, the empty gate, and the set gate only grow. The gear grows and keeps its light wash. A wide control wears the edge and keeps its size: the station plaque, a role verb, a hairline pill, and a task jump. The cycle card takes the open card's brass hairline. A brass pill lightens and grows. A document line, a diff row, a capability summary, and a folded-lines bar take a quiet brass wash. A closed section head takes that wash too, and the wash runs flush with the sheet. The waiting strip glows along itself. A green or red mark stays flat: a wash on the diff row, a coloured word in the section head. A disabled take, an open section head, a link, and a settings field stay as they are.

## Settings sheet

The **Дом** group shows the home agent select labeled `агент` above the model fields, the watch list, and the roots. The new-role form under **Роли** carries name, outcome, text, and `Добавить` only.

## Specs

A spec names the control and what it does. The room, the type, the colour, the ground, and the measure stay here and in the stylesheet.
