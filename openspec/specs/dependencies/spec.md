# dependencies

## Purpose

A parent cycle waits for its child cycles and for the open issues it depends on.

## Requirements

### Requirement: Tasking waits until every child is specified

A child is an open issue that carries the cycle label and names this issue as its parent. Once `tasking` has a tasks file and an open pull request, the machine SHALL wait until every child is at least `specified`. A child with no phase, or a cancelled child, SHALL NOT count as specified.

#### Scenario: A child still on specifying holds tasking

- **WHEN** the phase is `tasking`, the tasks are published, and a child cycle is `specifying`
- **THEN** the machine waits and names that child

#### Scenario: A specified child lets tasking move on

- **WHEN** the phase is `tasking`, the tasks are published, and every child cycle is at least `specified`
- **THEN** the machine moves the issue to `implementing`

#### Scenario: A cancelled child does not count as specified

- **WHEN** the phase is `tasking`, the tasks are published, and a child cycle is `cancelled`
- **THEN** the machine waits and names that child

### Requirement: Implementing waits for children and blockers after the tasks

While a task is open, the machine SHALL run that task and SHALL NOT wait on children. When no task is open, it SHALL wait until every child is `accepted`, then wait while any open issue listed as a dependency still exists. A closed issue SHALL NOT hold the parent. After those waits the machine SHALL move to `verifying`.

#### Scenario: An open task runs before the children are checked

- **WHEN** `implementing` has an unchecked task and a child that is not accepted
- **THEN** the machine runs the next task and does not wait on the child

#### Scenario: A child that is not accepted holds implementing

- **WHEN** `implementing` has no open task and a child cycle is not `accepted`
- **THEN** the machine waits and names that child

#### Scenario: An open blocker holds implementing

- **WHEN** `implementing` has no open task and an open issue is listed as a dependency
- **THEN** the machine waits and names that issue

#### Scenario: Finished tasks with no children move to verifying

- **WHEN** `implementing` has no open task, no child, and no open dependency
- **THEN** the machine moves the issue to `verifying`

### Requirement: Parent and Depends are body lines

A child SHALL be an open cycle issue whose body contains a line `Parent: #<key>`. A dependency SHALL be an open issue named by a line `Depends: #<key>`.

#### Scenario: A Parent line holds tasking

- **WHEN** `tasking` has its tasks published and an open cycle issue's body says `Parent: #<this issue>` while that child is `specifying`
- **THEN** the machine waits and names that child

#### Scenario: A Depends line holds implementing

- **WHEN** `implementing` has no open task and its body says `Depends: #<issue>` for an issue that is still open
- **THEN** the machine waits and names that issue

### Requirement: A parent rollback does not move a child

Rolling a parent back SHALL change only that parent's phase. The child's phase SHALL stay as it was.

#### Scenario: A spec marker on the parent leaves the child in place

- **WHEN** the parent is `implementing`, an open thread marks `spec`, and a child cycle is `implementing` with an open task
- **THEN** the parent moves to `specifying` and the child's phase stays `implementing`
