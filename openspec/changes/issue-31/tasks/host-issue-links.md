The machine reads parent, blocks, blocked-by, and depends-on from the host's own issue links

It writes those links when the flow creates a child cycle or a dependency, and it does not write a body line

The flow that opens a child cycle or a dependency writes the host link and does not write a body line

A parent link is a child: an open cycle issue this issue is the parent of

A blocked-by link and a depends-on link are blockers: issues this issue waits on

A blocks link is the other side and does not hold this issue

One issue on two of these links counts once for the wait

## Source

`IssueRecord` keeps `parent` and `dependsOn` and gains `blockedBy` and `blocks`. Delete `linksFrom`. A `Parent:` line or a `Depends:` line does not fill a field, in `asRecord` or in `memoryPorts`.

GitHub's tracker adapter reads and writes parent, blocks, blocked-by, and depends-on from the host's own issue links. GitHub's parent is its parent relationship. GitHub's wait is blocked-by and its hold is blocks. A `depends-on` write on a host that has no separate depends-on kind writes that host's blocked-by link, and the read stores it in the field the host actually returned.

Arcanum's adapter adds the four issue-link kinds beside pull-request comments, through the same fixture HTTP. A host kind the response does not carry is an empty list. A write sends that host kind and does not send a body line.

Add `node scripts/sdd.mjs link <key> <kind> <other>` with `<kind>` one of `parent`, `blocks`, `blocked-by`, and `depends-on`. It calls the port write and does not change the body. Stop writing `Parent:` and `Depends:` in the tasks flow that opens a child or a dependency.

Leave `src/machine/policy.ts`, the window, and rollback behavior to later slices.

## Proof

Test files: `src/adapters/github.test.ts`, `src/adapters/arcanum.test.ts`

Observes reading and writing parent, blocks, blocked-by, and depends-on on each host, that body lines do not substitute for links, and that the link verb writes the host link without a body line.

May read adapter sources, port types, memory fixtures, and the sdd link handler built from `src/`.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/adapters/github.test.ts
pnpm exec vitest --run --reporter=default src/adapters/arcanum.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
