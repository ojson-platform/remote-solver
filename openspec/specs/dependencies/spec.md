# dependencies

## Purpose

A parent cycle waits for its child cycles and for the open issues it depends on.

## Requirements

### Requirement: Tasking waits until every child is specified

A child is an open cycle issue this issue is the parent of, by the host parent link. Once `tasking` has a tasks file and an open pull request, the machine SHALL wait until every child is at least `specified`. A child with no phase, or a cancelled child, SHALL NOT count as specified. A cancelled child SHALL still hold that wait, and the machine SHALL still name that child. When every child is at least `specified`, the machine SHALL move the issue to `implementing`.

#### Scenario: A child still on specifying holds tasking

- **WHEN** the phase is `tasking`, the tasks are published, and a child cycle is `specifying`
- **THEN** the machine waits and names that child

#### Scenario: A specified child lets tasking move on

- **WHEN** the phase is `tasking`, the tasks are published, and every child cycle is at least `specified`
- **THEN** the machine moves the issue to `implementing`

#### Scenario: A cancelled child does not count as specified

- **WHEN** the phase is `tasking`, the tasks are published, and a child cycle is `cancelled`
- **THEN** the machine waits and names that child

#### Scenario: Tasking still waits until every child is at least specified, then moves to implementing

- **WHEN** tasking already waits until every child is at least specified, together with every child at least specified as the limit that replaces that wait and moves the issue to implementing
- **THEN** tasking still waits until every child is at least specified, then moves to implementing

#### Scenario: A cancelled child still holds that wait, and the machine still names that child

- **WHEN** a cancelled child already holds that wait and the machine already names that child, together with a closed issue as the limit that can replace that cancelled child
- **THEN** a cancelled child still holds that wait, and the machine still names that child

#### Scenario: A cancelled child still holds the tasking wait, and the machine still names that child

- **WHEN** a cancelled child already holds the tasking wait and the machine already names that child, together with a closed issue as the limit that can replace that cancelled child
- **THEN** a cancelled child still holds the tasking wait, and the machine still names that child

### Requirement: Implementing waits for children and blockers after the tasks

While a task is open, the machine SHALL run that task before it looks at links and SHALL NOT wait on a link, unless the open pull request conflicts with its base. A conflict SHALL be rebased first. When no task is open and the pull request does not conflict, it SHALL wait until every child is `accepted`, then wait while a blocker is open. A closed issue SHALL NOT hold that wait and SHALL NOT hold the parent. After those waits the machine SHALL move to `verifying`.

A finished parent is the finished-cycle exception to that move. The parent is finished when its pull request is merged and its change is archived. While a child is short of `accepted` and an open blocker remains, the machine SHALL wait and SHALL NOT move to `verifying`. Tasks that are all checked SHALL NOT replace that wait.

#### Scenario: An open task runs before the children are checked

- **WHEN** `implementing` has an unchecked task and a child that is not accepted
- **THEN** the machine runs the next task and does not wait on the child

#### Scenario: A child that is not accepted holds implementing

- **WHEN** `implementing` has no open task and a child cycle is not `accepted`
- **THEN** the machine waits and names that child

#### Scenario: An open blocker holds implementing

- **WHEN** `implementing` has no open task and an open issue is a blocker on a blocked-by link or a depends-on link
- **THEN** the machine waits and names that issue

#### Scenario: Finished tasks with no children move to verifying

- **WHEN** `implementing` has no open task, no child, and no open blocker
- **THEN** the machine moves the issue to `verifying`

#### Scenario: A finished parent with a child short of accepted and an open blocker waits

- **WHEN** the phase is `implementing`, the parent is finished, the pull request is merged, the change is archived, every task is checked, a child is short of `accepted`, and an open blocker remains
- **THEN** the parent is finished, the pull request is merged, the change is archived, the child is short of `accepted`, the open blocker remains, and the machine waits

#### Scenario: Implementing still runs an open task before it looks at links

- **WHEN** implementing already runs an open task before it looks at links, together with waiting on a link while that task is open as the limit that can replace that run
- **THEN** implementing still runs an open task before it looks at links

#### Scenario: With no open task, it waits until every child is accepted, then waits while a blocker is open, then moves to verifying

- **WHEN** with no open task, implementing already waits until every child is accepted, then waits while a blocker is open, then moves to verifying, together with moving to verifying while a child is not accepted as the limit that can replace those waits
- **THEN** with no open task, it waits until every child is accepted, then waits while a blocker is open, then moves to verifying

#### Scenario: A closed issue does not hold that wait

- **WHEN** a closed issue already does not hold that wait, together with an open blocker as the limit that can replace that closed issue
- **THEN** a closed issue does not hold that wait

### Requirement: A rollback does not move a linked issue

Rolling this issue back SHALL change only this issue's phase. The linked issue SHALL stay as it was. Rolling this issue back SHALL NOT move the linked issue.

#### Scenario: A spec marker on the parent leaves the child in place

- **WHEN** the parent is `implementing`, an open thread marks `spec`, and a child cycle is `implementing` with an open task
- **THEN** the parent moves to `specifying` and the child's phase stays `implementing`

#### Scenario: Rolling this issue back does not move the linked issue

- **WHEN** rolling this issue back already does not move the linked issue, together with moving that linked issue as the limit that can replace that
- **THEN** rolling this issue back does not move the linked issue

### Requirement: Host issue links are the child and the blocker

The machine SHALL read parent, blocks, blocked-by, and depends-on from the host's own issue links, on GitHub and on Arcanum. A parent link SHALL be a child: an open cycle issue this issue is the parent of. A blocked-by link and a depends-on link SHALL be blockers: issues this issue waits on. A blocks link SHALL be the other side and SHALL NOT hold this issue. One issue on two of these links SHALL count once for the wait.

The machine SHALL write those links when the flow creates a child cycle or a dependency, and it SHALL NOT write a body line. The flow that opens a child cycle or a dependency SHALL write the host link and SHALL NOT write a body line.

#### Scenario: The machine reads parent, blocks, blocked-by, and depends-on from the host's own issue links

- **WHEN** parent, blocks, blocked-by, and depends-on are already read from the host's own issue links on GitHub and on Arcanum, together with a `Parent:` line or a `Depends:` line in the body as the limit that can replace those links
- **THEN** the machine reads parent, blocks, blocked-by, and depends-on from the host's own issue links, on GitHub and on Arcanum

#### Scenario: It writes those links when the flow creates a child cycle or a dependency, and it does not write a body line

- **WHEN** the flow creating a child cycle already writes those links and does not write a body line, together with a dependency as the limit that can replace that child cycle
- **THEN** it writes those links when the flow creates a child cycle or a dependency, and it does not write a body line

#### Scenario: The flow that opens a child cycle or a dependency writes the host link and does not write a body line

- **WHEN** the flow that opens a child cycle already writes the host link and does not write a body line, together with a dependency as the limit that can replace that child cycle
- **THEN** the flow that opens a child cycle or a dependency writes the host link and does not write a body line

#### Scenario: A parent link is a child: an open cycle issue this issue is the parent of

- **WHEN** a parent link is already a child, an open cycle issue this issue is the parent of, together with a `Parent:` line in the body as the limit that can replace that parent link
- **THEN** a parent link is a child: an open cycle issue this issue is the parent of

#### Scenario: A blocked-by link and a depends-on link are blockers: issues this issue waits on

- **WHEN** a blocked-by link and a depends-on link are already blockers, issues this issue waits on, together with a `Depends:` line in the body as the limit that can replace those links
- **THEN** a blocked-by link and a depends-on link are blockers: issues this issue waits on

#### Scenario: A blocks link is the other side and does not hold this issue

- **WHEN** a blocks link is already the other side and does not hold this issue, together with a blocked-by link as the limit that can replace that blocks link
- **THEN** a blocks link is the other side and does not hold this issue

#### Scenario: One issue on two of these links counts once for the wait

- **WHEN** one issue is already on two of these links and already counts once for the wait, together with counting that issue twice as the limit that can replace that
- **THEN** one issue on two of these links counts once for the wait

### Requirement: No other phase move waits on a link

No phase move other than the tasking wait and the implementing wait SHALL wait on a link.

#### Scenario: No other phase move waits on a link

- **WHEN** no other phase move already waits on a link, together with verifying waiting on a link as the limit that can replace that
- **THEN** no other phase move waits on a link
