# hook

## Purpose

A hook is prompt text at the before or after of an action, kept as one string that may span several lines. The service config holds an ordered list. The cycle may append one more string. The window does not write the cycle field.

## Requirements

### Requirement: A service hook is a list of strings at sdd.hooks

In `openspec/config.yaml` a point SHALL be `sdd.hooks.<action>.<point>`. The action SHALL be what the agent decision prints, not the step file name. The points that enter the prompt SHALL be `before` and `after`. The value SHALL be a list of strings as written. A string MAY contain a newline. An empty list and a string of spaces SHALL NOT write the point. A single string SHALL be read as a list of that one string.

On a point that already has a key, the service-config group SHALL show that list in file order. The manager SHALL add a string, edit one, remove one, and change the order. A string of spaces SHALL NOT enter the list. Removing the last string SHALL remove the point. A new string on an existing point SHALL NOT go through the action choice. An empty list SHALL NOT write the point.

A new point SHALL be chosen from the free points of the actions the agent decision prints. A point that already has a key SHALL NOT be in that list. When both points of an action are taken, the action SHALL NOT be in the list. After the choice, the manager SHALL write the first string. An empty first string SHALL NOT create the point.

A point of an unknown action, and a point whose name is not `before` or `after`, SHALL be shown and edited the same way when the key already exists, and SHALL NOT be offered in the add list. A value that is not a string and not a list of strings SHALL have no field, and a save SHALL leave it as it was. One string instead of a list SHALL be shown as one element and written back as a list of that string.

#### Scenario: A blank string does not create a point

- **WHEN** the manager chooses a free point and leaves the first string empty
- **THEN** the file gains no point

#### Scenario: The last string removes the point

- **WHEN** the manager removes the only string of `before` and saves
- **THEN** the file has no `before` key for that action

#### Scenario: A single string is written back as a list

- **WHEN** the file has one string where a list belongs, and the manager saves that element
- **THEN** the file has a list of that one string

#### Scenario: A non-string hook value is left in place

- **WHEN** a point's value is a number and the manager saves the group
- **THEN** that value stays a number

### Requirement: The cycle keeps one sddHooks map

The cycle SHALL have one field, `sddHooks`. On Tracker it SHALL be the queue's local multiline field. On GitHub it SHALL be one organization issue field. The machine SHALL NOT create the field. The value SHALL be a map of non-empty points, the same action and point names. A string of spaces SHALL be an empty point and SHALL NOT be in the map. The window SHALL NOT write the field. A role writes the whole field, and the manager may write it on the queue.

#### Scenario: Spaces are not a point

- **WHEN** a point's text is spaces
- **THEN** the map has no such point

#### Scenario: The window does not write the field

- **WHEN** the manager edits only the service-config group
- **THEN** `sddHooks` is unchanged

### Requirement: The prompt inserts service lines and then the cycle paragraph

`sdd step` SHALL build the prompt with the service paragraphs first, in list order, then the paragraph of the cycle field. One blank line SHALL separate neighboring paragraphs. When the service list is empty, or the cycle paragraph is absent, that extra blank line SHALL be absent. A newline inside a service string SHALL stay inside its paragraph. The insertion SHALL have no heading, and one paragraph SHALL NOT cancel another. An action that is not the step's action, and a point other than `before` or `after`, SHALL NOT enter the prompt. When the field is missing, empty, or not a map, the step SHALL take only the service text.

In a file that has `## Steps`, `before` SHALL stand immediately before that heading, and `after` SHALL stand immediately after that section and before the next heading. Sections between `## Out of this action` and `## Steps`, including `## Slice` and `## Read only`, SHALL stay where they are. In a file that has no `## Steps`, `before` SHALL stand before the action's own section, and `after` SHALL stand after that section and before `## Check`. The `archive` paragraph SHALL NOT enter `unarchive`.

#### Scenario: Service text precedes the cycle paragraph

- **WHEN** the service list has two strings and the cycle field has a paragraph for that point
- **THEN** the prompt has the two service paragraphs, in list order, then the cycle paragraph, with one blank line between neighbors

#### Scenario: A missing cycle paragraph adds no blank line

- **WHEN** the service list has one string and the cycle field has no paragraph for that point
- **THEN** the prompt has that paragraph and no extra blank line

#### Scenario: Steps keeps the slice in place

- **WHEN** the step file has `## Out of this action`, then `## Slice`, then `## Steps`
- **THEN** `before` stands immediately before `## Steps`, and `## Slice` stays between `## Out of this action` and `## Steps`

#### Scenario: Archive does not enter unarchive

- **WHEN** the cycle field has an `archive.before` paragraph and the step is `unarchive`
- **THEN** the `unarchive` prompt does not contain that paragraph

#### Scenario: Without Steps the anchor is the action section

- **WHEN** the file has no `## Steps` and the action section is `## archive`
- **THEN** `before` stands before `## archive` and `after` stands after that section and before `## Check`
