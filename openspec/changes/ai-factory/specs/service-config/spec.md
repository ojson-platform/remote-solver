# service-config

## Purpose

The service config is the service's own machine settings. The service-config group of settings shows and writes the `sdd` fields. An edit that does not read is not written.

## ADDED Requirements

### Requirement: The group writes the sdd fields

The service-config group SHALL show and write the `sdd` fields: queues, `base`, `branch-scope`, `ignore-comments`, and hooks. A save SHALL write those fields and SHALL leave a key inside `sdd` that has no field. `schema`, `context`, and `rules` SHALL stay as they were. The field SHALL show the effective value. A key SHALL NOT be written while the value equals its default: `base` is `trunk`, `branch-scope` is `sdd`, and `ignore-comments` is an empty list. Returning a field to its default SHALL remove the key.

#### Scenario: A default base is omitted

- **WHEN** the manager saves `base` as `trunk`
- **THEN** the file has no `base` key

#### Scenario: A custom base is written

- **WHEN** the manager saves `base` as `main`
- **THEN** the file records `base` `main`, and `schema`, `context`, and `rules` are unchanged

#### Scenario: An unknown sdd key remains

- **WHEN** `sdd` contains a key the group has no field for, and the manager saves
- **THEN** that key remains in the file

### Requirement: Queues are an ordered list of names

A queue SHALL be a name and an optional description. An empty description SHALL NOT be written. The manager SHALL add a queue, remove one, and change the order. A save SHALL write that order. The first queue SHALL be the queue of a new child. Two rows with one name SHALL be written as they stand in the list.

#### Scenario: The first queue is the child's queue

- **WHEN** the saved queues are `alpha` then `beta`, and a new child is created
- **THEN** the child is created on `alpha`

#### Scenario: An empty description is omitted

- **WHEN** the manager saves a queue with a name and an empty description
- **THEN** the file records the name and no description

#### Scenario: Duplicate names stay in order

- **WHEN** the manager saves two rows both named `alpha`
- **THEN** the file lists `alpha` twice, in that order

### Requirement: Ignore-comments is an ordered list of strings

`ignore-comments` SHALL be a list of strings in file order. The manager SHALL add a pattern, edit one, and remove one. An empty list SHALL NOT be written. The order of patterns SHALL NOT change a match.

#### Scenario: An empty list removes the key

- **WHEN** the manager removes the last pattern and saves
- **THEN** the file has no `ignore-comments` key

### Requirement: An unreadable edit is not written

An edit that leaves the file unreadable SHALL NOT be written. The check SHALL run at once. Each such field SHALL warn that the edit cannot be saved. While a warning is present, save SHALL be unavailable, and the spy SHALL read the file on disk. While that file reads, the board SHALL keep the cycles, and the warning SHALL stay in the group. Closing settings SHALL discard the edit, and the readable file SHALL stay readable.

The warning SHALL appear when an `ignore-comments` pattern does not compile, when a queue name is empty, and when no queue remains. A new queue with an empty name SHALL warn until a name is present. When the YAML parses and the `sdd` key is absent, the group SHALL show an empty queue list with that same warning. When the edit reads, the warning SHALL clear and save SHALL write the file.

#### Scenario: A pattern that does not compile blocks save

- **WHEN** the manager enters an `ignore-comments` pattern that does not compile
- **THEN** the field warns that the edit cannot be saved, save is unavailable, and the file on disk is unchanged

#### Scenario: An empty queue name blocks save

- **WHEN** the manager adds a queue and leaves the name empty
- **THEN** the field warns until a name is present, and save is unavailable

#### Scenario: The last queue cannot be removed into an empty list

- **WHEN** the manager removes the last queue
- **THEN** the group warns that the edit cannot be saved and the file still has that queue

#### Scenario: YAML without sdd warns

- **WHEN** the file parses and has no `sdd` key
- **THEN** the group shows an empty queue list and warns that the edit cannot be saved

### Requirement: A non-string ignore-comments value can only be removed

When `ignore-comments` is a number, a map, or a list that is not all strings, the group SHALL show it as a string that can only be removed. While that string remains, save SHALL be unavailable and the warning SHALL say the edit cannot be saved. Removing it SHALL be an edit. When the rest reads, save SHALL write the file without that key. Closing without save SHALL leave the key in the file.

#### Scenario: Removing a number drops the key

- **WHEN** `ignore-comments` is a number, the manager removes that string, and the rest of the edit reads
- **THEN** save writes the file without `ignore-comments`

#### Scenario: Closing keeps the number

- **WHEN** `ignore-comments` is a number and the manager closes settings without saving
- **THEN** the file still has that number

### Requirement: A service config that does not parse hides that checkout

When the YAML of one checkout does not parse, the group SHALL say the file does not read, SHALL show no fields, SHALL offer no save, and SHALL NOT rewrite the file. Cards of that checkout only SHALL disappear. The board row `конфиг сервиса не читается` SHALL name the path. Other checkouts SHALL remain. A board with nothing to show SHALL remain. There SHALL be no `sddService` choice on a vanished card. «Взять» SHALL NOT act, because the card is gone. The window's spy SHALL NOT move that checkout. The broken file SHALL NOT open settings. When the manager has opened settings and the agent does not answer, this group SHALL show the file without fields and without save. A running step SHALL finish with what it started. The next step on that checkout SHALL NOT start until the file reads. When the file reads again, that checkout's cards SHALL return.

#### Scenario: One broken file hides only its cards

- **WHEN** one checkout's `openspec/config.yaml` does not parse and another checkout's file reads
- **THEN** the broken checkout's cards disappear, the row names that path, and the other checkout's cards remain

#### Scenario: The group does not rewrite a file that does not parse

- **WHEN** the manager opens settings on a file that does not parse
- **THEN** the group has no fields and no save, and the file bytes stay

### Requirement: A missing service config keeps the card

When the catalog exists and `openspec/config.yaml` does not, the card SHALL remain with icon reason `конфига сервиса нет`, and «Взять» SHALL NOT act. This SHALL NOT be treated as a file that does not parse, and SHALL NOT be treated as a missing catalog. The service-config group SHALL be empty. Saving SHALL create the file from the group fields. The new file SHALL NOT invent `schema`, `context`, or `rules`.

#### Scenario: A missing file leaves the card

- **WHEN** the checkout catalog exists and `openspec/config.yaml` does not
- **THEN** the card remains, the reason is `конфига сервиса нет`, and «Взять» does not act

#### Scenario: Save creates the file

- **WHEN** the manager saves the empty group for a checkout that has no service config
- **THEN** the file is created from the group fields and has no invented `schema`, `context`, or `rules`
