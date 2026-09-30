# publish

## Purpose

`publish` pushes the issue branch only from a clean worktree. The argument is the pull request title.

## Requirements

### Requirement: A dirty worktree is not published

When the worktree lists any path besides a clean status, `publish` SHALL refuse, SHALL name each path, and SHALL NOT push.

#### Scenario: Dirty paths are named and nothing is pushed

- **WHEN** `publish` runs and the worktree lists changed or untracked paths
- **THEN** the command fails, the message lists those paths, and the branch is not pushed

### Requirement: Several open pull requests are refused before the push

When more than one open pull request already belongs to the issue, `publish` SHALL fail, SHALL name them, and SHALL NOT push.

#### Scenario: Two open pull requests reject publish before the push

- **WHEN** `publish` runs on a clean tree and the issue already has two open pull requests
- **THEN** the command fails, the message names both, and the branch is not pushed

### Requirement: The argument is the pull request title

The title passed to `publish` SHALL be the title of a pull request it creates. It SHALL NOT be a commit subject. `publish` SHALL NOT create a commit.

#### Scenario: The new pull request uses the given title

- **WHEN** `publish` creates a pull request
- **THEN** that pull request's title is the argument and no commit is created by the command
