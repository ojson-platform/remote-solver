## MODIFIED Requirements

### Requirement: Implementing waits for children and blockers after the tasks

While a task is open, the machine SHALL run that task and SHALL NOT wait on children, unless the open pull request conflicts with its base. A conflict SHALL be rebased first. When no task is open and the pull request does not conflict, it SHALL wait until every child is `accepted`, then wait while any open issue listed as a dependency still exists. A closed issue SHALL NOT hold the parent. After those waits the machine SHALL move to `verifying`.

A finished parent is the finished-cycle exception to that move. The parent is finished when its pull request is merged and its change is archived. While a child is short of `accepted` and an open blocker remains, the machine SHALL wait and SHALL NOT move to `verifying`. Tasks that are all checked SHALL NOT replace that wait.

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

#### Scenario: A finished parent with a child short of accepted and an open blocker waits

- **WHEN** the phase is `implementing`, the parent is finished, the pull request is merged, the change is archived, every task is checked, a child is short of `accepted`, and an open blocker remains
- **THEN** the parent is finished, the pull request is merged, the change is archived, the child is short of `accepted`, the open blocker remains, and the machine waits
