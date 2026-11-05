# Window

What the window draws. Shared words — cycle, phase, gate, layer — stay in the root glossary. The page is one document. These names are the controls it draws. A control with another shape is named here. The room, the type, the colour roles, and the ground are in `FACE.md`.

## Language

**Face**:
The window's drawn surface: one set of colours and the shapes named below.
_Avoid_: Theme, skin, component library

**Card**:
A frame with a hairline. The quiet card is the pool cycle and a comment field. The brass card is the plaque on the station where the cycle stands. A focused field turns that hairline brass.
_Avoid_: Box, panel, tile

**Chip**:
A short mark. A task chip is open or done. A link chip names one issue on the board with a number. The same chips sit on the column card, the pool card, and under the open sidebar title.
_Avoid_: Badge, an edge drawn between cards

**Child**:
An open cycle issue this card parents. The child mark is a light corner, down and then right, with no arrowhead, and it stands only on the parent.
_Avoid_: Parent chip on the child card

**Blocker**:
An issue on the board this card waits on, named by blocked-by or depends-on. The wait mark is a muted arrow to the left. An issue this card holds wears a brass arrow to the right.
_Avoid_: An edge drawn between cards, listing an issue past the direct link

**Pill**:
A named action. A block has one brass pill. A hairline pill is a secondary name. The acceptance control uses the plaque's frame. A word that is not an action stays text.
_Avoid_: Button, link

**Circle**:
An icon control. One takes a cycle. One closes a sheet. One closes a field and sits on that field's corner. The gate has two signs: a small empty circle when the gate can be set, and a larger Gandalf when the gate is on. Those signs stay off the row of the phase the plaque is standing on. One opens a station door.
_Avoid_: Icon button

**Field**:
A quiet card for writing. Choosing a line of a change document opens one. The send mark sits inside the field. The close control is a circle on the field's corner.
_Avoid_: Textarea, input

**Focus block**:
The sidebar block of the latest focus comment. The marker is the badge. The prose sits under it. The window does not recompute the prose. An ask, a role outcome, and a manager's comment are not this block.
_Avoid_: Summary, status

**Hammer**:
The chosen filled mark on the plaque of the phase a worker is in. It leaves when the worker leaves; the `impl` badge stays on the task summary.
_Avoid_: Step mark, pool icon

**Spine sentence**:
The first sentence of that row's latest phase focus. A whole-pull-request focus belongs to the focus block and to no row.
_Avoid_: Layer line, solid
