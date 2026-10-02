#!/usr/bin/env node

// src/adapters/compose.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "node:fs";
import path6 from "node:path";
import { fileURLToPath } from "node:url";

// src/machine/change.ts
import path2 from "node:path";

// src/machine/naming.ts
import path from "node:path";
function changeDir(key) {
  return path.join("openspec", "changes", `issue-${key}`);
}
function archiveDir(key) {
  return path.join("openspec", "changes", "archive", `issue-${key}`);
}
function branchName(key, prefix = "sdd") {
  return `${prefix}/${key}`;
}
function pullTitlePrefix(key) {
  return `#${key}:`;
}

// src/machine/change.ts
var HEADINGS = {
  capabilities: "Capabilities",
  modified: "Modified",
  openQuestions: "Open questions",
  openDecisions: "Open decisions"
};
function section(text, heading) {
  const match = new RegExp(`^## ${heading}\\s*$`, "m").exec(text);
  if (!match) {
    return "";
  }
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}
function unchecked(text, heading) {
  return section(text, heading).split("\n").filter((line) => line.trimStart().startsWith("- [ ]")).length;
}
var CHANGE_FILES = ["proposal.md", "design.md", "tasks.md"];
function changeDocuments(dir, files) {
  const named = CHANGE_FILES.map((name) => path2.join(dir, name)).filter((rel) => files.exists(rel));
  const specs = files.list(path2.join(dir, "specs")).filter((rel) => rel.endsWith("spec.md"));
  return [...named, ...specs];
}
function changeBody(dir, files) {
  return changeDocuments(dir, files).flatMap((rel) => {
    const text = files.read(rel).trim();
    return text ? [`# ${rel}
${text}`] : [];
  });
}
function changeText(key, files) {
  const active = changeBody(changeDir(key), files);
  const text = active.length > 0 ? active : changeBody(archiveDir(key), files);
  return text.length > 0 ? text.join("\n\n") : null;
}
function modifiedCapabilities(proposal) {
  const body = section(proposal, HEADINGS.capabilities);
  const subsection = new RegExp(`### ${HEADINGS.modified}\\s*([\\s\\S]*?)(?:\\n### |\\s*$)`);
  const modified = subsection.exec(body);
  if (!modified) {
    return [];
  }
  return modified[1].split("\n").map((line) => line.match(/^-\s+(\S+)/)?.[1]).filter((id) => Boolean(id));
}
function readChange(key, files) {
  const dir = changeDir(key);
  const proposalPath = path2.join(dir, "proposal.md");
  const designPath = path2.join(dir, "design.md");
  const tasksPath = path2.join(dir, "tasks.md");
  const docs = new Set(changeDocuments(dir, files));
  const proposal = files.read(proposalPath);
  const missing = modifiedCapabilities(proposal).filter(
    (id) => !files.exists(path2.join("openspec", "specs", id, "spec.md"))
  );
  return {
    proposal: docs.has(proposalPath),
    delta: [...docs].some((rel) => rel.endsWith("spec.md")),
    design: docs.has(designPath),
    tasks: docs.has(tasksPath),
    archived: files.exists(archiveDir(key)) || files.list(archiveDir(key)).length > 0,
    openQuestions: unchecked(proposal, HEADINGS.openQuestions),
    openDecisions: unchecked(files.read(designPath), HEADINGS.openDecisions),
    openTasks: files.read(tasksPath).split("\n").filter((line) => line.trimStart().startsWith("- [ ]")).length,
    missingBaseline: missing
  };
}

// src/machine/phase.ts
var PHASES = [
  "proposing",
  "proposed",
  "specifying",
  "specified",
  "designing",
  "designed",
  "tasking",
  "implementing",
  "verifying",
  "accepting",
  "accepted",
  "cancelled"
];
var GATE_CLOSES = {
  proposed: "proposing",
  specified: "specifying",
  designed: "designing"
};
var LABEL = (phase) => `sdd:${phase}`;
function phaseOf(labels) {
  const found = PHASES.filter((phase) => labels.includes(LABEL(phase)));
  if (found.includes("accepted")) {
    return "accepted";
  }
  const kept = found.filter((phase) => !found.some((gate) => GATE_CLOSES[gate] === phase));
  return kept[0] ?? null;
}
function phaseRank(phase) {
  return PHASES.indexOf(phase);
}
function labelsAfterAdvance(labels, to) {
  const kept = labels.filter(
    (name) => name !== "sdd:wait-human" && !PHASES.some((phase) => name === LABEL(phase))
  );
  return [...kept, LABEL(to)];
}

// src/machine/labels.ts
async function setWait(key, waiting, tracker) {
  if (!waiting) {
    const names = await tracker.labels(key);
    if (!names.includes("sdd:wait-human")) {
      return;
    }
    await tracker.editLabels(key, [], ["sdd:wait-human"]);
    return;
  }
  await tracker.editLabels(key, ["sdd:wait-human"], []);
}
async function openWait(key, ask, tracker) {
  await setWait(key, true, tracker);
  await tracker.comment(key, ask);
}
function gateAsk(key, gate, tracker) {
  const hint = tracker.phaseHint(gate.from, gate.to);
  return `Review the ${gate.artifact}. To accept it, ${hint} on this issue, or run \`sdd accept ${key}\`.`;
}

// src/machine/policy.ts
import path4 from "node:path";

// src/machine/ignore.ts
import { existsSync, readFileSync } from "node:fs";
import path3 from "node:path";
function parseIgnoredAuthors(text) {
  const patterns = [];
  let section2 = "root";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }
    if (section2 === "root" && line === "comments:") {
      section2 = "comments";
      continue;
    }
    if (section2 === "comments" && line === "  ignore:") {
      section2 = "ignore";
      continue;
    }
    if (section2 === "ignore") {
      const author = /^ {4}- author: (\S+)$/.exec(line);
      if (!author) {
        throw new Error(`sandcastle.yaml: expected an author pattern, saw ${JSON.stringify(line)}`);
      }
      patterns.push(new RegExp(author[1], "i"));
      continue;
    }
    throw new Error(`sandcastle.yaml: unexpected ${JSON.stringify(line)}`);
  }
  if (section2 !== "ignore") {
    throw new Error("sandcastle.yaml: comments.ignore is missing");
  }
  return patterns;
}
function authorIgnored(login, patterns) {
  return patterns.some((pattern) => pattern.test(login));
}
function loadIgnoredAuthors(root) {
  const file = path3.join(root, "sandcastle.yaml");
  if (!existsSync(file)) {
    return [];
  }
  return parseIgnoredAuthors(readFileSync(file, "utf8"));
}

// src/machine/marker.ts
var ROBOT_MARK = "\u{1F916} ";
var TOKENS = ["sdd:fixed", "sdd:note", "sdd:layer=", "sdd:begin"];
function parseMarker(body) {
  if (body.includes("sdd:fixed")) {
    return { kind: "fixed", commit: body.match(/sdd:fixed[ \t]+(\S+)/)?.[1] ?? null };
  }
  if (body.includes("sdd:note")) {
    return { kind: "note" };
  }
  const layer = body.match(/sdd:layer=([a-z]+)/)?.[1];
  if (layer) {
    return { kind: "layer", layer };
  }
  return body.includes("sdd:begin") ? { kind: "begin" } : null;
}
function markerName(marker) {
  if (!marker) {
    return null;
  }
  return marker.kind === "layer" ? marker.layer : marker.kind;
}
function markRobot(body) {
  return body.startsWith("\u{1F916}") ? body : `${ROBOT_MARK}${body}`;
}
function mentionsGrammar(body) {
  return body.includes("\u{1F916}") || TOKENS.some((token) => body.includes(token));
}

// src/machine/review.ts
function spokeByRobot(body, login, ignored) {
  return body.startsWith("\u{1F916}") || authorIgnored(login, ignored);
}
function conversationLayer(comments) {
  let layer = null;
  for (const comment of comments) {
    const marker = parseMarker(comment.body);
    if (marker?.kind === "fixed") {
      layer = null;
    } else if (marker?.kind === "layer") {
      layer = marker.layer;
    }
  }
  return layer;
}
function conversationUnanswered(comments) {
  const last = comments.at(-1);
  return Boolean(last && !last.robot && parseMarker(last.body) === null);
}
var LAYER_PHASE = {
  proposal: "proposing",
  spec: "specifying",
  design: "designing",
  tasks: "tasking",
  code: "implementing"
};
var emptyReview = { unanswered: false, rollback: null, layers: [] };
function phaseOfLayer(layer) {
  return LAYER_PHASE[layer] ?? null;
}
function layerOfPhase(phase) {
  return Object.entries(LAYER_PHASE).find(([, value]) => value === phase)?.[0] ?? null;
}
function markerOf(body) {
  return markerName(parseMarker(body));
}
function readReview(threads, comments) {
  const layers = [];
  const lines = [];
  let unanswered = conversationUnanswered(comments);
  for (const thread of threads) {
    if (thread.resolved) {
      continue;
    }
    const marker = parseMarker(thread.body);
    if (!marker) {
      unanswered = true;
    } else if (marker.kind === "layer") {
      layers.push(marker.layer);
    }
    lines.push({
      thread: thread.id ?? "",
      comment: thread.comment ?? "",
      file: thread.path ?? "",
      line: thread.line ?? null,
      marker: markerOf(thread.body),
      body: thread.body
    });
  }
  const fromConversation = conversationLayer(comments);
  if (fromConversation) {
    layers.push(fromConversation);
  }
  let rollback = null;
  for (const layer of layers) {
    const phase = phaseOfLayer(layer);
    if (phase && (rollback === null || phaseRank(phase) < phaseRank(rollback))) {
      rollback = phase;
    }
  }
  return {
    unanswered,
    rollback,
    layers,
    threads: lines,
    conversation: {
      last: comments.at(-1) ?? null,
      layer: fromConversation,
      unanswered: conversationUnanswered(comments)
    }
  };
}
function reviewOf(threads, comments) {
  const reading = readReview(threads, comments);
  return { unanswered: reading.unanswered, rollback: reading.rollback, layers: reading.layers };
}

// src/machine/route.ts
var ACTION_SKILL = {
  "create-proposal": "plan",
  "improve-proposal": "plan",
  "restore-baseline": "baseline",
  "create-initial-specs": "specify",
  "improve-specs": "specify",
  "create-design": "design",
  "improve-design": "design",
  "create-tasks": "tasks",
  "improve-tasks": "tasks",
  "implement-next-task": "implement",
  "fix-implementation": "fix",
  "classify-failures": "verify",
  "classify-comments": "pr-comments",
  archive: "accept",
  unarchive: "accept"
};
var LAYER_ACTION = {
  proposal: "improve-proposal",
  spec: "improve-specs",
  design: "improve-design",
  tasks: "improve-tasks",
  code: "fix-implementation"
};

// src/machine/policy.ts
function severalOpenReason(ids) {
  return `cycle stopped until one open PR remains: ${ids.join(", ")}`;
}
function writingGate(phase, change) {
  if (phase === "proposing") {
    return { artifact: change.proposal, open: change.openQuestions };
  }
  if (phase === "specifying") {
    return { artifact: change.delta, open: 0 };
  }
  if (phase === "designing") {
    return { artifact: change.design, open: change.openDecisions };
  }
  return { artifact: true, open: 0 };
}
function reviewGate(issue, artifact, from, to) {
  return {
    kind: "wait",
    issue,
    reason: `review the ${artifact}, then a person moves ${from} to ${to}`,
    gate: { artifact, from, to }
  };
}
var HUMAN_NEXT = {
  proposing: "specifying",
  specifying: "designing",
  designing: "tasking"
};
function gateBlocker(key, phase, change) {
  const gate = writingGate(phase, change);
  const required = phase === "proposing" ? "proposal.md" : phase === "specifying" ? "specs" : "design.md";
  const file = path4.join(changeDir(key), required);
  if (!gate.artifact) {
    return `Missing ${file}`;
  }
  if (gate.open) {
    const heading = phase === "designing" ? HEADINGS.openDecisions : HEADINGS.openQuestions;
    return `#${key} still has open items under ## ${heading} in ${file}`;
  }
  return null;
}
function closeGate(key, gate, closed, change) {
  const blocker = gateBlocker(key, closed, change);
  if (blocker) {
    return {
      kind: "advance",
      issue: key,
      to: closed,
      reason: `${gate} refused: ${blocker}`,
      comment: `The phase moved to ${gate}, but ${closed} is not done. ${blocker}. The machine moved the issue back to ${closed}.`
    };
  }
  const next = HUMAN_NEXT[closed];
  return {
    kind: "advance",
    issue: key,
    to: next,
    reason: `${closed} \u2192 ${next}`,
    comment: `sdd:accept ${closed} \u2192 ${next}`
  };
}
function children(parent, issues) {
  return issues.filter((issue) => issue.parent === parent && issue.labels.includes("sdd:cycle"));
}
function blockers(issue, issues) {
  return issue.dependsOn.map((id) => issues.find((item) => item.key === id)).filter((item) => Boolean(item));
}
function atLeast(issue, phase) {
  const current = phaseOf(issue.labels);
  if (!current || current === "cancelled") {
    return false;
  }
  return phaseRank(current) >= phaseRank(phase);
}
function agent(issue, action, phase, pr, reason) {
  return { kind: "agent", issue, action, skill: ACTION_SKILL[action], phase, pr, reason };
}
function mergeOrWait(issueKey, pr, merged, autoMerge) {
  if (merged.length > 0) {
    return { kind: "advance", issue: issueKey, to: "accepted", reason: "pull request merged" };
  }
  if (!pr) {
    return { kind: "wait", issue: issueKey, reason: "accepted needs a merged pull request" };
  }
  if (pr.checks !== "green") {
    return {
      kind: "wait",
      issue: issueKey,
      reason: `wait for green checks before merge of PR #${pr.id}`
    };
  }
  if (!autoMerge) {
    return { kind: "wait", issue: issueKey, reason: `wait for merge of PR #${pr.id}` };
  }
  return { kind: "merge", issue: issueKey, pull: String(pr.id), reason: `merge PR #${pr.id}` };
}
function decide(issue, issues, pulls, change) {
  const names = issue.labels;
  if (names.includes("sdd:cancelled")) {
    return { kind: "done", issue: issue.key, reason: "cancelled" };
  }
  const open = pulls.filter((pr2) => pr2.state === "OPEN");
  if (open.length > 1) {
    return {
      kind: "wait",
      issue: issue.key,
      reason: severalOpenReason(open.map((pr2) => pr2.id))
    };
  }
  const phase = phaseOf(names);
  if (!phase) {
    return { kind: "advance", issue: issue.key, to: "proposing", reason: "enter the cycle" };
  }
  if (phase === "accepted") {
    const acceptedOpen = open;
    const acceptedMerged = pulls.filter((item) => item.state === "MERGED");
    const acceptedPr = acceptedMerged[0] ?? acceptedOpen[0];
    if (!change.archived && (change.proposal || change.delta)) {
      return agent(
        issue.key,
        "archive",
        phase,
        acceptedPr ? String(acceptedPr.id) : "",
        "archive the change"
      );
    }
    return mergeOrWait(issue.key, acceptedOpen[0], acceptedMerged, false);
  }
  const closed = GATE_CLOSES[phase];
  if (closed) {
    return closeGate(issue.key, phase, closed, change);
  }
  const early = phaseRank(phase) <= phaseRank("tasking");
  if (early && change.archived) {
    return agent(issue.key, "unarchive", phase, "", "return the delta to the change");
  }
  const merged = pulls.filter((pr2) => pr2.state === "MERGED");
  const pr = open[0];
  const feedback = pr?.review ?? emptyReview;
  if (feedback.unanswered && pr) {
    return agent(
      issue.key,
      "classify-comments",
      phase,
      String(pr.id),
      "unclassified review threads"
    );
  }
  if (names.includes("sdd:wait-human")) {
    const review = phase === "proposing" ? { artifact: "proposal", to: "proposed" } : phase === "specifying" ? { artifact: "spec", to: "specified" } : phase === "designing" ? { artifact: "design", to: "designed" } : null;
    if (review && !gateBlocker(issue.key, phase, change)) {
      return reviewGate(issue.key, review.artifact, phase, review.to);
    }
    return {
      kind: "wait",
      issue: issue.key,
      reason: `sdd:wait-human is set on ${phase}. Do the ask on the issue.`
    };
  }
  if (phase !== "verifying") {
    const back = feedback.rollback;
    if (back && phaseRank(back) < phaseRank(phase)) {
      return {
        kind: "advance",
        issue: issue.key,
        to: back,
        reason: "review thread sent the change back"
      };
    }
  }
  if (phase === "specifying" && change.missingBaseline.length) {
    return agent(
      issue.key,
      "restore-baseline",
      phase,
      pr ? String(pr.id) : "",
      `no baseline for ${change.missingBaseline.join(", ")}`
    );
  }
  const layer = layerOfPhase(phase);
  if (layer && feedback.layers.includes(layer) && pr) {
    const action = LAYER_ACTION[layer];
    if (!action) {
      return {
        kind: "wait",
        issue: issue.key,
        reason: `threads on ${layer} but no action`
      };
    }
    return agent(issue.key, action, phase, String(pr.id), `threads on ${layer}`);
  }
  const auto = (tag) => names.includes(tag);
  if (phase === "proposing") {
    if (!change.proposal || !pr) {
      return agent(
        issue.key,
        "create-proposal",
        phase,
        pr ? String(pr.id) : "",
        change.proposal ? "publish proposal.md to the pull request" : "write proposal.md and open the pull request"
      );
    }
    if (change.openQuestions) {
      return {
        kind: "wait",
        issue: issue.key,
        reason: `${change.openQuestions} open question(s) in proposal.md`
      };
    }
    if (auto("sdd:auto-plan")) {
      return { kind: "advance", issue: issue.key, to: "specifying", reason: "sdd:auto-plan" };
    }
    return reviewGate(issue.key, "proposal", "proposing", "proposed");
  }
  if (phase === "specifying") {
    if (!change.proposal) {
      return { kind: "advance", issue: issue.key, to: "proposing", reason: "proposal.md is missing" };
    }
    if (!change.delta || !pr) {
      return agent(
        issue.key,
        "create-initial-specs",
        phase,
        pr ? String(pr.id) : "",
        change.delta ? "publish the delta spec to the pull request" : "write the delta spec and publish it"
      );
    }
    if (auto("sdd:auto-spec")) {
      return { kind: "advance", issue: issue.key, to: "designing", reason: "sdd:auto-spec" };
    }
    return reviewGate(issue.key, "spec", "specifying", "specified");
  }
  if (phase === "designing") {
    if (!change.delta) {
      return { kind: "advance", issue: issue.key, to: "specifying", reason: "delta spec is missing" };
    }
    if (!change.design || !pr) {
      return agent(
        issue.key,
        "create-design",
        phase,
        pr ? String(pr.id) : "",
        change.design ? "publish design.md to the pull request" : "write design.md and publish it"
      );
    }
    if (change.openDecisions) {
      return {
        kind: "wait",
        issue: issue.key,
        reason: `${change.openDecisions} open decision(s) in design.md`
      };
    }
    if (auto("sdd:auto-design")) {
      return { kind: "advance", issue: issue.key, to: "tasking", reason: "sdd:auto-design" };
    }
    return reviewGate(issue.key, "design", "designing", "designed");
  }
  if (phase === "tasking") {
    if (!change.design) {
      return { kind: "advance", issue: issue.key, to: "designing", reason: "design.md is missing" };
    }
    if (!change.tasks || !pr) {
      return agent(
        issue.key,
        "create-tasks",
        phase,
        pr ? String(pr.id) : "",
        change.tasks ? "publish tasks.md to the pull request" : "write tasks.md and publish it"
      );
    }
    const kids = children(issue.key, issues);
    const behind = kids.filter((kid) => !atLeast(kid, "specified"));
    if (behind.length) {
      return {
        kind: "wait",
        issue: issue.key,
        reason: `wait for children to reach specified: ${behind.map((kid) => "#" + kid.key).join(", ")}`
      };
    }
    return { kind: "advance", issue: issue.key, to: "implementing", reason: "tasks exist" };
  }
  if (phase === "implementing") {
    if (!change.tasks) {
      return { kind: "advance", issue: issue.key, to: "tasking", reason: "tasks.md is missing" };
    }
    if (change.openTasks > 0) {
      return agent(
        issue.key,
        "implement-next-task",
        phase,
        pr ? String(pr.id) : "",
        "next open task"
      );
    }
    const kids = children(issue.key, issues).filter((kid) => !atLeast(kid, "accepted"));
    if (kids.length) {
      return {
        kind: "wait",
        issue: issue.key,
        reason: `wait for children to be accepted: ${kids.map((kid) => "#" + kid.key).join(", ")}`
      };
    }
    const openBlockers = blockers(issue, issues);
    if (openBlockers.length) {
      return {
        kind: "wait",
        issue: issue.key,
        reason: `wait for blockers: ${openBlockers.map((item) => "#" + item.key).join(", ")}`
      };
    }
    return { kind: "advance", issue: issue.key, to: "verifying", reason: "no open tasks" };
  }
  if (phase === "verifying") {
    if (!pr) {
      return { kind: "wait", issue: issue.key, reason: "verifying needs an open pull request" };
    }
    const back = pr.review.rollback;
    if (pr.checks === "red") {
      if (back) {
        return {
          kind: "advance",
          issue: issue.key,
          to: back,
          reason: "review thread sent the change back"
        };
      }
      return agent(issue.key, "classify-failures", phase, String(pr.id), "red checks");
    }
    if (pr.checks !== "green") {
      return { kind: "wait", issue: issue.key, reason: `checks are ${pr.checks}` };
    }
    if (back) {
      return {
        kind: "advance",
        issue: issue.key,
        to: back,
        reason: "review thread sent the change back"
      };
    }
    return { kind: "advance", issue: issue.key, to: "accepting", reason: "checks are green" };
  }
  if (phase !== "accepting") {
    return { kind: "wait", issue: issue.key, reason: `unknown phase ${phase}` };
  }
  if (!pr && merged.length === 0) {
    return { kind: "wait", issue: issue.key, reason: "accepting needs the pull request" };
  }
  if (!change.archived) {
    return agent(
      issue.key,
      "archive",
      phase,
      pr ? String(pr.id) : String(merged[0].id),
      "archive the change"
    );
  }
  return mergeOrWait(issue.key, pr, merged, names.includes("sdd:auto-merge"));
}
function settle(issue, issues, pulls, change) {
  let labels = [...issue.labels];
  const transitions = [];
  for (let step = 0; step < 12; step += 1) {
    const decision = decide({ ...issue, labels }, issues, pulls, change);
    if (decision.kind !== "advance") {
      return { decision, transitions, labels };
    }
    labels = labelsAfterAdvance(labels, decision.to);
    transitions.push(decision);
    if (decision.to === "accepted") {
      return {
        decision: { kind: "done", issue: issue.key, reason: decision.reason },
        transitions,
        labels
      };
    }
  }
  return {
    decision: { kind: "wait", issue: issue.key, reason: "Too many mechanical transitions" },
    transitions,
    labels
  };
}

// src/machine/snapshot.ts
async function pullSnapshots(review, key) {
  const pulls = await review.pulls(key);
  const snapshots = [];
  for (const pull of pulls) {
    snapshots.push({
      ...pull,
      review: pull.state === "OPEN" ? reviewOf(await review.threads(pull.id), await review.comments(pull.id)) : emptyReview
    });
  }
  return snapshots;
}
async function loadCycle(tracker, review, filesAt, queueLabel) {
  const issues = await tracker.listOpen();
  const cycles = issues.filter((issue) => issue.labels.includes(queueLabel) && issue.labels.includes("sdd:cycle")).sort((a, b) => a.key.localeCompare(b.key, void 0, { numeric: true }));
  const pulls = /* @__PURE__ */ new Map();
  const changes = /* @__PURE__ */ new Map();
  for (const issue of cycles) {
    pulls.set(issue.key, await pullSnapshots(review, issue.key));
    changes.set(issue.key, readChange(issue.key, filesAt(issue.key)));
  }
  return { issues, cycles, pulls, changes };
}

// src/machine/flow.ts
function queueLabelOf(snapshot, queueLabel) {
  if (snapshot.cycles.length > 0) {
    return [];
  }
  const nums = snapshot.issues.filter((issue) => issue.labels.includes(queueLabel)).map((issue) => `#${issue.key}`).join(", ") || "empty";
  return [
    {
      kind: "wait",
      issue: null,
      reason: `No open sdd:cycle issues. ${queueLabel} queue: ${nums}. Add the sdd:cycle label to enter the cycle.`
    }
  ];
}
async function applyLabels(tracker, key, before, after) {
  const add = after.filter((label) => !before.includes(label));
  const remove = before.filter((label) => !after.includes(label));
  if (add.length || remove.length) {
    await tracker.editLabels(key, add, remove);
  }
}
async function closeAccepted(tracker, key) {
  await tracker.close(key, "SDLC accepted: the pull request is merged and the baseline is in trunk.");
}
async function applySettlement(tracker, before, settled, key) {
  await applyLabels(tracker, key, before, settled.labels);
  const closing = settled.transitions.find((transition) => transition.to === "accepted");
  for (const transition of settled.transitions) {
    if (transition.comment) {
      await tracker.comment(key, transition.comment);
    }
  }
  if (closing) {
    await closeAccepted(tracker, key);
  }
  if (settled.decision.kind === "wait" && settled.decision.gate && !before.includes("sdd:wait-human")) {
    await openWait(key, gateAsk(key, settled.decision.gate, tracker), tracker);
  }
}
async function resolveCycle(snapshot, tracker, queueLabel, busy = /* @__PURE__ */ new Set()) {
  const empty = queueLabelOf(snapshot, queueLabel);
  if (empty.length) {
    return empty;
  }
  const decisions = [];
  for (const record of snapshot.cycles.filter((item) => !busy.has(item.key))) {
    const change = snapshot.changes.get(record.key);
    if (!change) {
      decisions.push({ kind: "wait", issue: record.key, reason: "change was not loaded" });
      continue;
    }
    const settled = settle(record, snapshot.issues, snapshot.pulls.get(record.key) ?? [], change);
    await applySettlement(tracker, record.labels, settled, record.key);
    decisions.push(settled.decision);
  }
  return decisions;
}
async function resolveIssue(key, options) {
  const issues = await options.tracker.listOpen();
  const record = issues.find(
    (issue) => issue.key === key && issue.labels.includes(options.queueLabel) && issue.labels.includes("sdd:cycle")
  );
  if (!record) {
    return { kind: "done", issue: key, reason: "not in the open cycle" };
  }
  const settled = settle(
    record,
    issues,
    await pullSnapshots(options.review, key),
    options.change ?? readChange(key, options.files)
  );
  await applySettlement(options.tracker, record.labels, settled, key);
  return settled.decision;
}
async function performIssue(key, options) {
  const decision = await resolveIssue(key, options);
  if (decision.kind !== "merge") {
    return decision;
  }
  await options.review.merge(decision.pull);
  const settled = await resolveIssue(key, options);
  if (settled.kind === "merge") {
    throw new Error(`merge of PR #${decision.pull} did not settle`);
  }
  return settled;
}
async function performCycle(snapshot, options, busy = /* @__PURE__ */ new Set()) {
  const decisions = await resolveCycle(snapshot, options.tracker, options.queueLabel, busy);
  const performed = [];
  for (const decision of decisions) {
    if (decision.kind !== "merge" || decision.issue === null) {
      performed.push(decision);
      continue;
    }
    performed.push(
      await performIssue(decision.issue, {
        tracker: options.tracker,
        review: options.review,
        files: options.filesAt(decision.issue),
        queueLabel: options.queueLabel
      })
    );
  }
  return performed;
}

// src/adapters/github.ts
import { execFileSync, spawn } from "node:child_process";
var FAILED = ["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"];
var PENDING = ["QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED"];
function labelHint(from, to) {
  return `replace the label \`sdd:${from}\` with \`sdd:${to}\``;
}
function repo() {
  const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
  const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(`Cannot parse GitHub repo from origin: ${url}`);
  }
  return { owner: match[1], name: match[2], slug: `${match[1]}/${match[2]}` };
}
function changesPayload(head, notes) {
  const comments = [];
  const loose = [];
  for (const note of notes) {
    if (!note.path) {
      loose.push(note.body);
      continue;
    }
    if (note.line) {
      comments.push({ path: note.path, body: note.body, line: note.line, side: "RIGHT" });
      continue;
    }
    comments.push({ path: note.path, body: note.body, subject_type: "file" });
  }
  const body = comments.length === 0 ? loose.join("\n\n") : "";
  return { commit_id: head, event: "REQUEST_CHANGES", body, comments };
}
function threadRecord(node) {
  const comment = node.comments.nodes[0];
  return {
    id: node.id,
    comment: comment ? String(comment.databaseId) : "",
    path: node.path,
    line: node.line,
    resolved: node.isResolved,
    body: comment?.body ?? ""
  };
}
function command(file, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code) {
        reject(Object.assign(new Error(`${file} exited ${code}`), { stdout, stderr }));
        return;
      }
      resolve({ stdout, stderr });
    });
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}
async function gh(args, input) {
  const { stdout } = await command("gh", args, input);
  return stdout;
}
function classifyChecks(view, name) {
  if (view.state === "MERGED") {
    return "green";
  }
  const rollup = (view.statusCheckRollup ?? []).filter((check) => !name || check.name === name);
  if (rollup.length === 0) {
    return "none";
  }
  const failed = rollup.some((check) => FAILED.includes(check.conclusion ?? check.state ?? ""));
  if (failed) {
    return "red";
  }
  const pending = rollup.some((check) => {
    const status = check.status ?? check.state ?? "";
    return PENDING.includes(status) && !check.conclusion;
  });
  return pending ? "pending" : "green";
}
function linkedTitle(key, title) {
  return title.startsWith(pullTitlePrefix(key)) || title.startsWith(`#${key} `);
}
function linksFrom(body) {
  const parent = /^Parent:\s*#(\S+)/m.exec(body)?.[1];
  const dependsOn = [...body.matchAll(/^Depends:\s*#(\S+)/gm)].map((match) => match[1]);
  return { parent, dependsOn };
}
function asRecord(issue) {
  const body = issue.body ?? "";
  const links = linksFrom(body);
  return {
    key: String(issue.number),
    title: issue.title,
    body,
    state: issue.state,
    labels: issue.labels.map((label) => label.name),
    parent: links.parent,
    dependsOn: links.dependsOn
  };
}
function githubAdapters(options = {}) {
  const prBase = options.prBase ?? "master";
  const ignored = loadIgnoredAuthors(options.root ?? process.cwd());
  let slug = null;
  let user = null;
  const repoSlug = () => {
    if (!slug) {
      slug = repo().slug;
    }
    return slug;
  };
  const login = async () => {
    if (!user) {
      user = (await gh(["api", "user", "--jq", ".login"])).trim();
    }
    return user;
  };
  const readIssue = async (key) => JSON.parse(
    await gh(["issue", "view", key, "--repo", repoSlug(), "--json", "number,title,body,state,labels"])
  );
  const tracker = {
    login,
    async listOpen() {
      const found = JSON.parse(
        await gh([
          "issue",
          "list",
          "--repo",
          repoSlug(),
          "--state",
          "open",
          "--limit",
          "100",
          "--json",
          "number,title,body,state,labels"
        ])
      );
      return found.map(asRecord);
    },
    issue: async (key) => asRecord(await readIssue(key)),
    labels: async (key) => asRecord(await readIssue(key)).labels,
    async editLabels(key, add, remove) {
      if (add.length === 0 && remove.length === 0) {
        return;
      }
      const args = ["issue", "edit", key, "--repo", repoSlug()];
      for (const label of add) {
        args.push("--add-label", label);
      }
      if (remove.length) {
        args.push("--remove-label", remove.join(","));
      }
      await gh(args);
    },
    async updateBody(key, body) {
      await gh(["issue", "edit", key, "--repo", repoSlug(), "--body", body]);
    },
    async comment(key, body) {
      await gh(["issue", "comment", key, "--repo", repoSlug(), "--body", markRobot(body)]);
    },
    async close(key, comment) {
      await gh(["issue", "close", key, "--repo", repoSlug(), "--comment", markRobot(comment)]);
    },
    phaseHint: labelHint
  };
  const linked = async (key) => {
    const found = JSON.parse(
      await gh([
        "pr",
        "list",
        "--repo",
        repoSlug(),
        "--state",
        "all",
        "--search",
        `#${key} in:title`,
        "--json",
        "number,title,state",
        "--limit",
        "20"
      ])
    );
    return found.filter((pr) => linkedTitle(key, pr.title));
  };
  const review = {
    async pulls(key) {
      const found = [];
      for (const pr of await linked(key)) {
        const id = String(pr.number);
        if (pr.state !== "OPEN") {
          found.push({ id, title: pr.title, state: pr.state, checks: "none" });
          continue;
        }
        const view = JSON.parse(
          await gh(["pr", "view", id, "--repo", repoSlug(), "--json", "statusCheckRollup,state"])
        );
        found.push({ id, title: pr.title, state: pr.state, checks: classifyChecks(view) });
      }
      return found;
    },
    async threads(pull) {
      return (await this.threadList(pull)).map((thread) => ({ resolved: thread.resolved, body: thread.body }));
    },
    async threadList(pull) {
      const { owner, name } = repo();
      const query = `query($owner:String!,$name:String!,$number:Int!){
        repository(owner:$owner, name:$name) {
          pullRequest(number:$number) {
            reviewThreads(first:100) {
              nodes {
                id
                isResolved
                path
                line
                comments(last:1) { nodes { databaseId author { login } body } }
              }
            }
          }
        }
      }`;
      const data = JSON.parse(
        await gh([
          "api",
          "graphql",
          "-f",
          `query=${query}`,
          "-f",
          `owner=${owner}`,
          "-f",
          `name=${name}`,
          "-F",
          `number=${pull}`
        ])
      );
      const nodes = data.data.repository.pullRequest?.reviewThreads.nodes ?? [];
      return nodes.flatMap((node) => {
        const record = threadRecord(node);
        return authorIgnored(node.comments.nodes[0]?.author?.login ?? "", ignored) ? [] : [record];
      });
    },
    async comments(pull) {
      const comments = JSON.parse(
        await gh([
          "api",
          `repos/${repoSlug()}/issues/${pull}/comments`,
          "--jq",
          "[.[] | {login: .user.login, body}]"
        ])
      );
      return comments.map((comment) => ({
        body: comment.body,
        robot: spokeByRobot(comment.body, comment.login, ignored)
      }));
    },
    async ensurePull(key, title, body) {
      const open = (await linked(key)).filter((pr) => pr.state === "OPEN").map((pr) => String(pr.number));
      if (open[0]) {
        return open[0];
      }
      const url = (await gh([
        "pr",
        "create",
        "--repo",
        repoSlug(),
        "--base",
        prBase,
        "--title",
        title,
        "--body",
        body
      ])).trim();
      const id = url.match(/\/(\d+)\s*$/)?.[1];
      if (!id) {
        throw new Error(`gh pr create returned no pull number: ${url}`);
      }
      return id;
    },
    async openThread(pull, target) {
      await gh([
        "api",
        "--method",
        "POST",
        `repos/${repoSlug()}/pulls/${pull}/comments`,
        "-f",
        `commit_id=${target.commit}`,
        "-f",
        `path=${target.path}`,
        "-F",
        `line=${target.line}`,
        "-f",
        `body=${markRobot(target.body)}`
      ]);
    },
    async reply(pull, comment, body) {
      await gh([
        "api",
        "--method",
        "POST",
        `repos/${repoSlug()}/pulls/${pull}/comments/${comment}/replies`,
        "-f",
        `body=${markRobot(body)}`
      ]);
    },
    async say(pull, body) {
      await gh(["issue", "comment", pull, "--repo", repoSlug(), "--body", markRobot(body)]);
    },
    async speak(pull, body) {
      await gh(["issue", "comment", pull, "--repo", repoSlug(), "--body", body]);
    },
    async flag(pull, head, notes) {
      const payload = changesPayload(head, notes);
      const post = () => gh(
        ["api", "--method", "POST", "--input", "-", `repos/${repoSlug()}/pulls/${pull}/reviews`],
        JSON.stringify(payload)
      );
      try {
        await post();
      } catch {
        const text = notes.map((note) => note.body).join("\n\n");
        try {
          await gh(
            [
              "api",
              "--method",
              "POST",
              "--input",
              "-",
              `repos/${repoSlug()}/pulls/${pull}/reviews`
            ],
            JSON.stringify(
              changesPayload(
                head,
                notes.map((note) => ({ body: note.body }))
              )
            )
          );
        } catch {
          await this.speak(pull, text);
          return;
        }
        await this.speak(pull, text);
        return;
      }
      if (payload.comments.length === 0 && payload.body) {
        await this.speak(pull, payload.body);
      }
      const loose = notes.filter((note) => !note.path).map((note) => note.body).join("\n\n");
      if (payload.comments.length > 0 && loose) {
        await this.speak(pull, loose);
      }
    },
    async range(pull) {
      const view = JSON.parse(
        await gh(["pr", "view", pull, "--repo", repoSlug(), "--json", "headRefOid,baseRefOid"])
      );
      return { head: view.headRefOid ?? "", base: view.baseRefOid ?? null };
    },
    async resolveThread(thread) {
      const query = "mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}) { thread { isResolved } } }";
      await gh(["api", "graphql", "-f", `query=${query}`, "-f", `id=${thread}`]);
    },
    async checksText(pull) {
      try {
        const { stdout, stderr } = await command("gh", ["pr", "checks", pull, "--repo", repoSlug()]);
        return `${stdout}${stderr}`;
      } catch (error) {
        const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
        const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
        return `${stdout}${stderr}`;
      }
    },
    async merge(pull) {
      try {
        await gh(["pr", "merge", pull, "--repo", repoSlug(), "--rebase"]);
      } catch (error) {
        const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
        const message = error instanceof Error ? error.message : String(error);
        if (!/already merged/i.test(`${message}
${stderr}`)) {
          throw error;
        }
      }
      const view = JSON.parse(
        await gh(["pr", "view", pull, "--repo", repoSlug(), "--json", "state"])
      );
      if (view.state !== "MERGED") {
        throw new Error(`merge of PR #${pull} left it ${view.state ?? "OPEN"}`);
      }
    }
  };
  return { tracker, review };
}

// src/adapters/vcs.ts
import { execFile, execFileSync as execFileSync2 } from "node:child_process";
import { promisify } from "node:util";
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, writeFileSync } from "node:fs";
import path5 from "node:path";
function shQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
function linkCommand(links, serviceRoot) {
  const steps = ["mkdir -p .sandcastle"];
  const excluded = ["/.sandcastle/"];
  for (const link of links) {
    steps.push(`ln -sfn ${shQuote(link.from)} .sandcastle/${link.to}`);
  }
  const modules = path5.join(serviceRoot, "node_modules");
  if (existsSync2(modules)) {
    steps.push(`ln -sfn ${shQuote(modules)} node_modules`);
    excluded.push("/node_modules");
  }
  steps.push('exclude="$(git rev-parse --git-path info/exclude)"', 'mkdir -p "$(dirname "$exclude")"');
  for (const rule of excluded) {
    steps.push(`{ grep -qxF ${shQuote(rule)} "$exclude" 2>/dev/null || echo ${shQuote(rule)} >> "$exclude"; }`);
  }
  return steps.join(" && ");
}
function packageLinks(solverRoot2) {
  return ["skills", "prompts", ".env"].filter((name) => existsSync2(path5.join(solverRoot2, name))).map((name) => ({ from: path5.join(solverRoot2, name), to: name }));
}
var run = promisify(execFile);
async function gitAsync(root, args, allowFail = false) {
  try {
    const { stdout } = await run("git", args, { cwd: root, encoding: "utf8" });
    return stdout;
  } catch (error) {
    if (allowFail) {
      return "";
    }
    throw error;
  }
}
function git(root, args, allowFail = false) {
  try {
    return execFileSync2("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch (error) {
    if (allowFail) {
      return "";
    }
    throw error;
  }
}
function issueRef(root, key, prefix) {
  for (const ref of [branchName(key, prefix), `origin/${branchName(key, prefix)}`]) {
    const found = git(root, ["rev-parse", "--verify", "--quiet", ref], true).trim();
    if (found) {
      return ref;
    }
  }
  return null;
}
function gitFiles(root, key, prefix) {
  const ref = issueRef(root, key, prefix);
  return {
    exists(rel) {
      return ref !== null && existsOnRef(root, ref, rel);
    },
    read(rel) {
      if (!ref) {
        return "";
      }
      return git(root, ["show", `${ref}:${rel}`], true);
    },
    list(rel) {
      if (!ref) {
        return [];
      }
      return git(root, ["ls-tree", "-r", "--name-only", ref, rel], true).split("\n").filter((line) => line.length > 0);
    }
  };
}
function existsOnRef(root, ref, rel) {
  try {
    execFileSync2("git", ["cat-file", "-e", `${ref}:${rel}`], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function isAncestor(root, commit, tip) {
  try {
    await run("git", ["merge-base", "--is-ancestor", commit, tip], { cwd: root, encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}
function ignorePath(root, rule) {
  const rel = git(root, ["rev-parse", "--git-path", "info/exclude"]).trim();
  const file = path5.resolve(root, rel);
  mkdirSync(path5.dirname(file), { recursive: true });
  const text = existsSync2(file) ? readFileSync2(file, "utf8") : "";
  if (text.split("\n").includes(rule)) {
    return;
  }
  const body = text.length === 0 || text.endsWith("\n") ? text : `${text}
`;
  writeFileSync(file, `${body}${rule}
`);
}
async function prepareCheckout(root, key, config) {
  await ensureIssueBranch(root, key, config);
  const leaf = branchName(key, config.branchPrefix).replaceAll("/", "-");
  const dir = path5.join(root, config.worktreesDir, leaf);
  if (!existsSync2(dir)) {
    mkdirSync(path5.dirname(dir), { recursive: true });
    await run("git", ["worktree", "add", "-q", dir, branchName(key, config.branchPrefix)], {
      cwd: root,
      encoding: "utf8"
    });
  }
  ignorePath(root, `/${config.worktreesDir}/`);
  await run("sh", ["-c", config.link], { cwd: dir, encoding: "utf8" });
  return dir;
}
async function ensureIssueBranch(root, key, config) {
  const branch = branchName(key, config.branchPrefix);
  if ((await gitAsync(root, ["rev-parse", "--verify", "--quiet", branch], true)).trim()) {
    return;
  }
  try {
    await run("git", ["fetch", "origin", `${branch}:${branch}`], { cwd: root, encoding: "utf8" });
  } catch {
    await run("git", ["branch", branch, config.defaultBranch], { cwd: root, encoding: "utf8" });
  }
}
function gitVcs(root, config = {}) {
  const prefix = config.branchPrefix ?? "sdd";
  const base = config.defaultBranch ?? "origin/master";
  return {
    async prepare(key, options) {
      return prepareCheckout(root, key, {
        branchPrefix: prefix,
        defaultBranch: base,
        worktreesDir: options.worktreesDir,
        link: linkCommand(options.links, root)
      });
    },
    async tip(key) {
      const found = (await gitAsync(root, ["rev-parse", "--verify", "--quiet", branchName(key, prefix)], true)).trim();
      if (!found) {
        throw new Error(`no branch ${branchName(key, prefix)}`);
      }
      return found;
    },
    filesAt: (key) => gitFiles(root, key, prefix),
    async compare(base2, head) {
      try {
        const commits = await gitAsync(root, ["log", "--oneline", `${base2}..${head}`]);
        const diff = await gitAsync(root, ["diff", `${base2}...${head}`]);
        return { commits, diff };
      } catch {
        return null;
      }
    },
    async head() {
      return (await gitAsync(root, ["rev-parse", "HEAD"])).trim();
    },
    async push(key) {
      await run("git", ["push", "-u", "origin", branchName(key, prefix)], {
        cwd: root,
        encoding: "utf8"
      });
    },
    async published(key, commit) {
      const tip = (await gitAsync(root, ["ls-remote", "origin", `refs/heads/${branchName(key, prefix)}`])).trim().split(/\s+/)[0];
      if (!tip) {
        return false;
      }
      return tip === commit || await isAncestor(root, commit, tip);
    },
    async dirty() {
      const entries = (await gitAsync(root, ["status", "--porcelain", "-z"])).split("\0");
      const paths = [];
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (!entry) {
          continue;
        }
        paths.push(entry.slice(3));
        if (entry[0] === "R" || entry[0] === "C") {
          index += 1;
        }
      }
      return paths;
    }
  };
}

// src/adapters/compose.ts
function solverRoot() {
  const here = path6.dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (; ; ) {
    const pkg = path6.join(dir, "package.json");
    if (existsSync3(pkg)) {
      const name = JSON.parse(readFileSync3(pkg, "utf8")).name;
      if (name === "@ojson/remote-solver") {
        return dir;
      }
    }
    const parent = path6.dirname(dir);
    if (parent === dir) {
      return path6.resolve(here, "../..");
    }
    dir = parent;
  }
}
function machine(root = process.cwd(), options = {}) {
  const config = {
    queueLabel: "Sandcastle",
    branchPrefix: "sdd",
    defaultBranch: "origin/master",
    prBase: "master",
    ...options.config
  };
  const github = options.tracker && options.review ? void 0 : githubAdapters({ prBase: config.prBase, root });
  return {
    root,
    config,
    tracker: options.tracker ?? github.tracker,
    review: options.review ?? github.review,
    vcs: options.vcs ?? gitVcs(root, { branchPrefix: config.branchPrefix, defaultBranch: config.defaultBranch }),
    runtime: options.runtime
  };
}
function turn(box, key) {
  return performIssue(key, {
    tracker: box.tracker,
    review: box.review,
    files: box.vcs.filesAt(key),
    queueLabel: box.config.queueLabel
  });
}

// src/adapters/load.ts
import { pathToFileURL } from "node:url";

// src/adapters/locate.ts
import { existsSync as existsSync4 } from "node:fs";
import path7 from "node:path";
var ARCADIA = "ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs";
function adapterFile(scriptPath, root) {
  const beside = path7.join(path7.dirname(scriptPath), "adapters", "index.mjs");
  if (existsSync4(beside)) {
    return beside;
  }
  let dir = path7.resolve(root);
  for (; ; ) {
    const candidate = path7.join(dir, ARCADIA);
    if (existsSync4(candidate)) {
      return candidate;
    }
    const parent = path7.dirname(dir);
    if (parent === dir) {
      return void 0;
    }
    dir = parent;
  }
}

// src/adapters/load.ts
async function openMachine(root, options = {}) {
  const file = adapterFile(process.argv[1] ?? "", root);
  let built = machine(root);
  if (file) {
    const loaded = await import(pathToFileURL(file).href);
    const made = loaded.createAdapters(root, built.config);
    built = machine(root, {
      config: made.config,
      tracker: made.tracker,
      review: made.review,
      vcs: made.vcs
    });
  }
  return { ...built, runtime: options.runtime?.(built) };
}

// src/adapters/runtime.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync3, symlinkSync } from "node:fs";
import path10 from "node:path";

// src/machine/skill.ts
import { readFileSync as readFileSync4 } from "node:fs";
import path8 from "node:path";
import { cursor } from "@ai-hero/sandcastle";
function skillMode(text) {
  const front = /^---\n([\s\S]*?)\n---/.exec(text);
  const mode = front?.[1].match(/^mode:\s*(\S+)/m)?.[1] ?? text.match(/^mode:\s*(\S+)/m)?.[1];
  return mode === "mechanical" ? "mechanical" : "judgment";
}
function modeOfSkill(stepsDir, skill) {
  return skillMode(readFileSync4(path8.join(stepsDir, `${skill}.md`), "utf8"));
}
function modelFor(mode) {
  return mode === "mechanical" ? "composer-2.5-fast" : "grok-4.7-high-fast";
}
function agentFor(mode) {
  return cursor(modelFor(mode));
}

// src/adapters/agent.ts
import { spawn as spawn3 } from "node:child_process";
import { appendFileSync, existsSync as existsSync5, mkdirSync as mkdirSync2, readFileSync as readFileSync5 } from "node:fs";
import path9 from "node:path";

// src/adapters/host-sandbox.ts
import { spawn as spawn2 } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { createInterface } from "node:readline";
function openHostHandle(worktreePath, env = {}) {
  const processEnv = { ...process.env, ...env };
  const handle = {
    worktreePath,
    exec(command2, opts) {
      return spawnShell(command2, opts?.cwd ?? worktreePath, processEnv, opts);
    },
    copyFileIn: (hostPath, sandboxPath) => copyFile(hostPath, sandboxPath),
    copyFileOut: (sandboxPath, hostPath) => copyFile(sandboxPath, hostPath),
    close: async () => {
    }
  };
  return Promise.resolve(handle);
}
function spawnShell(command2, cwd, env, opts) {
  const isWindows = process.platform === "win32";
  const shell = isWindows ? "cmd.exe" : "sh";
  const args = isWindows ? ["/d", "/s", "/c", command2] : ["-c", command2];
  return new Promise((resolve, reject) => {
    const child = spawn2(shell, args, {
      cwd,
      env,
      stdio: [opts?.stdin !== void 0 ? "pipe" : "ignore", "pipe", "pipe"],
      windowsVerbatimArguments: isWindows
    });
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };
    child.on("error", (error) => fail(new Error(`exec failed: ${error.message}`)));
    if (!child.stdout || !child.stderr) {
      fail(new Error("exec failed: missing pipes"));
      return;
    }
    if (opts?.stdin !== void 0 && child.stdin) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    }
    if (opts?.onLine) {
      const onLine = opts.onLine;
      const stdout2 = [];
      const stderr2 = [];
      const lines = createInterface({ input: child.stdout });
      lines.on("line", (line) => {
        stdout2.push(line);
        onLine(line);
      });
      child.stderr.on("data", (chunk) => {
        stderr2.push(chunk.toString());
      });
      child.on("close", (code) => finish({ stdout: stdout2.join("\n"), stderr: stderr2.join(""), exitCode: code ?? 0 }));
      return;
    }
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk.toString()));
    child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
    child.on("close", (code) => finish({ stdout: stdout.join(""), stderr: stderr.join(""), exitCode: code ?? 0 }));
  });
}

// src/adapters/agent.ts
function substitute(template, args) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => args[key] ?? "");
}
function envFile(hostCwd) {
  const file = path9.join(hostCwd, ".sandcastle", ".env");
  if (!existsSync5(file)) {
    return {};
  }
  const values = {};
  for (const line of readFileSync5(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      values[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
  return values;
}
function tagged(text, tag) {
  if (!tag) {
    return text;
  }
  const found = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text);
  return found?.[1] ?? text;
}
function runProcess(command2, stdin, cwd, env, provider, logPath, idleMs, graceMs) {
  mkdirSync2(path9.dirname(logPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn3("sh", ["-c", command2], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    if (stdin !== void 0 && child.stdin) {
      child.stdin.write(stdin);
    }
    child.stdin?.end();
    let stderr = "";
    let text = "";
    let sessionId;
    let buffer = "";
    let settled = false;
    let sawResult = false;
    let grace;
    const idle = setTimeout(() => stop(false), idleMs);
    const resetIdle = () => {
      idle.refresh();
    };
    const stop = (ok, code = 1) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(idle);
      if (grace) {
        clearTimeout(grace);
      }
      if (ok) {
        resolve({ text, sessionId });
        return;
      }
      reject(new Error(`agent exited ${code}: ${stderr.slice(-500)}`));
    };
    child.stdout?.on("data", (chunk) => {
      resetIdle();
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        appendFileSync(logPath, `${line}
`);
        for (const event of provider.parseStreamLine(line)) {
          if (event.type === "text") {
            text += event.text;
          }
          if (event.type === "session_id") {
            sessionId = event.sessionId;
          }
          if (event.type === "result" && !sawResult) {
            sawResult = true;
            grace = setTimeout(() => {
              child.kill();
              stop(true);
            }, graceMs);
          }
        }
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", () => stop(false, 1));
    child.on("close", (code) => {
      if (buffer) {
        appendFileSync(logPath, `${buffer}
`);
      }
      stop(code === 0 || sawResult, code ?? 1);
    });
  });
}
async function runAgent(run2) {
  const prompt = substitute(readFileSync5(run2.promptFile, "utf8"), run2.promptArgs);
  const handle = await openHostHandle(run2.cwd);
  if (run2.resumeSession && run2.provider.sessionStorage) {
    await run2.provider.sessionStorage.resumeIntoSandbox({
      hostCwd: run2.hostCwd,
      sandboxCwd: run2.cwd,
      sessionId: run2.resumeSession,
      handle
    });
  }
  const printed = run2.provider.buildPrintCommand({
    prompt,
    dangerouslySkipPermissions: true,
    resumeSession: run2.resumeSession,
    forkSession: run2.forkSession
  });
  const captured = await runProcess(
    printed.command,
    printed.stdin,
    run2.cwd,
    { ...process.env, ...envFile(run2.hostCwd), ...run2.provider.env },
    run2.provider,
    run2.logPath,
    (run2.idleTimeoutSeconds ?? 600) * 1e3,
    run2.resultGraceMs ?? 6e4
  );
  const storage = run2.provider.sessionStorage;
  let sessionFilePath;
  let usage2 = void 0;
  if (run2.provider.captureSessions && storage && captured.sessionId) {
    await storage.captureToHost({
      hostCwd: run2.hostCwd,
      sandboxCwd: run2.cwd,
      sessionId: captured.sessionId,
      handle
    });
    sessionFilePath = storage.hostSessionFilePath(run2.hostCwd, captured.sessionId);
    if (run2.provider.parseSessionUsage) {
      const content = await storage.readHostSession(run2.hostCwd, captured.sessionId);
      if (content) {
        usage2 = run2.provider.parseSessionUsage(content);
      }
    }
  }
  return {
    text: tagged(captured.text, run2.outputTag),
    sessionId: captured.sessionId,
    sessionFilePath,
    usage: usage2
  };
}

// src/adapters/runtime.ts
function agentLogPath(root, branch, name) {
  const safeBranch = branch.replace(/[/\\:*?"<>|]/g, "-");
  const suffix = name.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
  return path10.join(root, ".sandcastle", "logs", `${safeBranch}-${suffix}.log`);
}
function ensureServiceEnv(serviceRoot, solverRoot2) {
  const from = path10.join(solverRoot2, ".env");
  if (!existsSync6(from)) {
    return;
  }
  const dir = path10.join(serviceRoot, ".sandcastle");
  mkdirSync3(dir, { recursive: true });
  const to = path10.join(dir, ".env");
  if (existsSync6(to)) {
    return;
  }
  symlinkSync(from, to);
}
var WORKTREES = ".sandcastle/worktrees";
function keyFromBranch(branch, prefix) {
  const head = `${prefix}/`;
  return branch.startsWith(head) ? branch.slice(head.length) : branch.slice(branch.indexOf("/") + 1);
}
async function commitCount(vcs, before, after) {
  if (before === after) {
    return 0;
  }
  const range = await vcs.compare(before, after);
  if (!range?.commits.trim()) {
    return 0;
  }
  return range.commits.split("\n").filter((line) => line.trim()).length;
}
function agentRuntime(config) {
  const checkout = (key) => config.vcs.prepare(key, { worktreesDir: WORKTREES, links: packageLinks(config.solverRoot) });
  return {
    async run(skill) {
      const dir = await checkout(skill.key);
      const before = await config.vcs.tip(skill.key);
      ensureServiceEnv(config.root, config.solverRoot);
      const answer = await runAgent({
        cwd: dir,
        hostCwd: config.root,
        provider: agentFor(skill.mode),
        name: skill.action,
        promptFile: path10.join(config.solverRoot, "prompts", "sdd.md"),
        promptArgs: {
          ISSUE: skill.key,
          ACTION: skill.action,
          PHASE: skill.phase,
          PR: skill.pull,
          SKILL: skill.skill,
          QUEUE: config.queueLabel,
          BASE: config.prBase
        },
        logPath: agentLogPath(config.root, branchName(skill.key, config.branchPrefix), skill.action),
        resumeSession: skill.resumeSession
      });
      return {
        commits: await commitCount(config.vcs, before, await config.vcs.tip(skill.key)),
        sessionId: answer.sessionId,
        usage: answer.usage
      };
    },
    async ask(request) {
      const key = keyFromBranch(request.branch, config.branchPrefix);
      const dir = await checkout(key);
      ensureServiceEnv(config.root, config.solverRoot);
      return runAgent({
        cwd: dir,
        hostCwd: config.root,
        provider: agentFor(request.mode),
        name: request.name,
        promptFile: request.promptFile,
        promptArgs: request.promptArgs,
        logPath: agentLogPath(config.root, request.branch, request.name),
        outputTag: request.outputTag
      });
    }
  };
}

// src/main.ts
import path11 from "node:path";

// src/machine/scheduler.ts
function signature(decision) {
  return `${decision.phase}\0${decision.action}\0${decision.reason}`;
}
function tick(state, decisions, parallel) {
  const idle = { ...state.idle };
  const reported = { ...state.reported };
  const report = [];
  const ready = [];
  const say = (issue, reason) => {
    const slot = issue ?? "";
    if (reported[slot] === reason) {
      return;
    }
    reported[slot] = reason;
    report.push({ issue, reason });
  };
  for (const decision of decisions) {
    if (decision.issue !== null && state.running.includes(decision.issue)) {
      continue;
    }
    if (decision.kind !== "agent") {
      if (decision.issue !== null) {
        delete idle[decision.issue];
      }
      say(decision.issue, decision.reason);
      continue;
    }
    ready.push(decision);
  }
  const start = [];
  for (const decision of ready) {
    if (state.running.length + start.length >= parallel) {
      break;
    }
    const sig = signature(decision);
    if (idle[decision.issue] === sig) {
      say(decision.issue, `idle ${decision.action}: ${decision.reason}`);
      continue;
    }
    start.push(decision);
  }
  return { state: { running: state.running, idle, reported }, start, report };
}
function exited(state, issue, code, sig) {
  const idle = { ...state.idle };
  if (code === 2) {
    idle[issue] = sig;
  } else {
    delete idle[issue];
  }
  return { running: state.running.filter((item) => item !== issue), idle, reported: state.reported };
}

// src/main.ts
function flag(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = Number(argv[index + 1]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
async function runIssue(box, key) {
  return driveIssue(box, key);
}
async function driveIssue(box, key) {
  const runtime = box.runtime;
  if (!runtime) {
    throw new Error("runtime is not configured");
  }
  for (let step = 1; step <= 40; step += 1) {
    const decision = await turn(box, key);
    if (decision.kind !== "agent") {
      console.log(`#${key} ${decision.kind}: ${decision.reason}`);
      return 0;
    }
    console.log(`
#${key} ${decision.phase} \u2192 ${decision.action} (${decision.skill})`);
    const outcome = await runtime.run({
      skill: decision.skill,
      action: decision.action,
      key,
      phase: decision.phase,
      pull: decision.pr,
      mode: modeOfSkill(path11.join(solverRoot(), "skills/sdd-flow/steps"), decision.skill)
    });
    if (outcome.sessionId) {
      console.log(`#${key} session ${outcome.sessionId}`);
    }
    if (outcome.usage) {
      console.log(`#${key} tokens in ${outcome.usage.inputTokens} out ${outcome.usage.outputTokens}`);
    }
    if (outcome.commits === 0) {
      console.error(
        `Stopped: ${decision.action} made no commit, so the next poll would repeat it.`
      );
      return 2;
    }
  }
  console.error(`Stopped #${key} after 40 steps.`);
  return 3;
}
async function runSpy(box, argv) {
  const parallel = flag(argv, "--parallel", 2);
  const intervalMs = flag(argv, "--interval", 20) * 1e3;
  let state = { running: [], idle: {}, reported: {} };
  const sigs = /* @__PURE__ */ new Map();
  let wake = null;
  let woke = false;
  const finish = (issue, code, sig) => {
    state = exited(state, issue, code, sigs.get(issue) ?? sig);
    console.log(`#${issue} worker exited ${code}`);
    if (wake) {
      wake();
    } else {
      woke = true;
    }
  };
  console.log(`Spy polling every ${intervalMs / 1e3}s, parallel ${parallel}.`);
  for (; ; ) {
    try {
      const snapshot = await loadCycle(
        box.tracker,
        box.review,
        (key) => box.vcs.filesAt(key),
        box.config.queueLabel
      );
      const decisions = await performCycle(
        snapshot,
        {
          tracker: box.tracker,
          review: box.review,
          filesAt: (key) => box.vcs.filesAt(key),
          queueLabel: box.config.queueLabel
        },
        new Set(state.running)
      );
      const turned = tick(state, decisions, parallel);
      state = turned.state;
      for (const line of turned.report) {
        console.log(line.issue === null ? line.reason : `#${line.issue}: ${line.reason}`);
      }
      for (const decision of turned.start) {
        console.log(`#${decision.issue} start ${decision.phase} \u2192 ${decision.action}`);
        const sig = signature(decision);
        state = { ...state, running: [...state.running, decision.issue] };
        sigs.set(decision.issue, sig);
        void driveIssue(box, decision.issue).then(
          (code) => finish(decision.issue, code, sig),
          (error) => {
            console.error(error instanceof Error ? error.message : String(error));
            finish(decision.issue, 1, sig);
          }
        );
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
    await new Promise((resolve) => {
      if (woke) {
        woke = false;
        resolve();
        return;
      }
      const timer = setTimeout(resolve, intervalMs);
      wake = () => {
        clearTimeout(timer);
        wake = null;
        resolve();
      };
    });
  }
}

// src/adapters/actions.ts
function escapeData(value) {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}
function escapeProperty(value) {
  return escapeData(value).replaceAll(":", "%3A").replaceAll(",", "%2C");
}
function annotate(kind, title, message) {
  console.log(`::${kind} title=${escapeProperty(title)}::${escapeData(message)}`);
}

// src/reviewer/place.ts
function commentableLines(diff) {
  const files = /* @__PURE__ */ new Map();
  let path13 = null;
  let next = 0;
  for (const line of diff.split("\n")) {
    const plus = line.match(/^\+\+\+ b\/(.+)$/);
    if (plus) {
      path13 = plus[1] === "/dev/null" ? null : plus[1];
      if (path13 && !files.has(path13)) {
        files.set(path13, /* @__PURE__ */ new Set());
      }
      next = 0;
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk && path13) {
      next = Number(hunk[1]);
      continue;
    }
    if (!path13 || next === 0) {
      continue;
    }
    if (line.startsWith("-") || line.startsWith("\\")) {
      continue;
    }
    files.get(path13)?.add(next);
    next += 1;
  }
  return files;
}
function placeOnDiff(diff, remark) {
  if (!remark.path) {
    return remark;
  }
  const lines = commentableLines(diff).get(remark.path);
  if (!lines) {
    return { body: remark.body };
  }
  if (remark.line && lines.has(remark.line)) {
    return remark;
  }
  return { body: remark.body, path: remark.path };
}

// src/reviewer/dossier.ts
var STANDARD_FILES = ["CODING_STANDARDS.md", "CONTRIBUTING.md", "AGENTS.md"];
function standardsText(files) {
  return STANDARD_FILES.flatMap((name) => {
    if (!files.exists(name)) {
      return [];
    }
    const text = files.read(name).trim();
    return text ? [`# ${name}
${text}`] : [];
  }).join("\n\n");
}
function assembleDossier(input) {
  if (!input.base) {
    return { kind: "wait", reason: "base does not resolve" };
  }
  if (!input.diff.trim()) {
    return { kind: "wait", reason: "diff is empty" };
  }
  const change = changeText(input.issue, input.files);
  if (!change) {
    return { kind: "wait", reason: "change has no files" };
  }
  return {
    kind: "ready",
    dossier: {
      issue: input.issue,
      pull: input.pull,
      head: input.head,
      base: input.base,
      commits: input.commits,
      diff: input.diff,
      change,
      standards: standardsText(input.files)
    }
  };
}

// src/reviewer/act.ts
function reviewedNote(head) {
  return `sdd:note reviewed ${head}`;
}
function reviewStep(input) {
  if (input.checks !== "green") {
    return { kind: "wait", reason: `checks are ${input.checks}` };
  }
  const view = reviewOf(input.threads, input.comments);
  if (view.unanswered) {
    return { kind: "wait", reason: "unanswered comment" };
  }
  if (view.layers.length > 0) {
    return { kind: "wait", reason: "open layer" };
  }
  if (!input.head) {
    return { kind: "wait", reason: "head does not resolve" };
  }
  const note = reviewedNote(input.head);
  if (input.comments.some((comment) => comment.body.includes(note))) {
    return { kind: "merge" };
  }
  return { kind: "judge" };
}
function spokenRemarks(items) {
  return items.map((item) => ({ ...item, body: item.body.trim() })).filter((item) => item.body.length > 0);
}
async function applyReview(verdict, pull, head, review) {
  if (verdict.kind === "unjudged") {
    return;
  }
  if (verdict.kind === "clean") {
    await review.say(pull, reviewedNote(head));
    await review.merge(pull);
    return;
  }
  const notes = spokenRemarks(verdict.items);
  if (notes.length > 0) {
    await review.flag(pull, head, notes);
  }
}
async function passReview(deps, item) {
  const pulls = await deps.review.pulls(item.issue);
  const range = await deps.review.range(item.pull);
  const step = reviewStep({
    checks: pulls.find((pull) => pull.id === item.pull)?.checks ?? "none",
    threads: await deps.review.threads(item.pull),
    comments: await deps.review.comments(item.pull),
    head: range.head
  });
  if (step.kind === "wait") {
    return { action: "wait", reason: step.reason };
  }
  if (step.kind === "merge") {
    await deps.review.merge(item.pull);
    return { action: "clean" };
  }
  const span = range.base ? await deps.vcs.compare(range.base, range.head) : null;
  if (range.base && !span) {
    return { action: "wait", reason: "range does not resolve" };
  }
  const built = assembleDossier({
    issue: item.issue,
    pull: item.pull,
    head: range.head,
    base: span ? range.base : null,
    commits: span?.commits ?? "",
    diff: span?.diff ?? "",
    files: deps.vcs.filesAt(item.issue)
  });
  if (built.kind === "wait") {
    return { action: "wait", reason: built.reason };
  }
  const verdict = await deps.judge(built.dossier);
  const placed = verdict.kind === "remarks" ? { kind: "remarks", items: verdict.items.map((item2) => placeOnDiff(span?.diff ?? "", item2)) } : verdict;
  await applyReview(placed, item.pull, range.head, deps.review);
  if (placed.kind === "remarks") {
    return { action: "remarks", items: spokenRemarks(placed.items) };
  }
  if (placed.kind === "clean") {
    return { action: "clean" };
  }
  return { action: "unjudged", reason: placed.reason };
}

// src/reviewer/judge.ts
import path12 from "node:path";

// src/reviewer/verdict.ts
function excerpt(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}...` : flat;
}
function parseVerdict(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 1 && lines[0] === "clean") {
    return { kind: "clean" };
  }
  const items = lines.filter((line) => line.startsWith("remark:")).map((line) => parseRemark(line.slice("remark:".length).trim())).filter((item) => item.body.length > 0 && !mentionsGrammar(item.body)).slice(0, 5);
  if (items.length === 0) {
    const sample = excerpt(text);
    return {
      kind: "unjudged",
      reason: sample ? `answer is not a verdict: ${sample}` : "empty answer"
    };
  }
  return { kind: "remarks", items };
}
function parseRemark(text) {
  const placed = text.match(/^@(\S+?)(?::(\d+))?\s+(\S[\s\S]*)$/);
  if (!placed) {
    return { body: text };
  }
  const line = placed[2] ? Number(placed[2]) : void 0;
  return { body: placed[3], path: placed[1], ...line ? { line } : {} };
}

// src/reviewer/judge.ts
function failureReason(error) {
  return error instanceof Error ? error.message : String(error);
}
async function sandcastleJudge(runtime, dossier) {
  try {
    const answer = await runtime.ask({
      name: "review",
      mode: "judgment",
      promptFile: path12.join(solverRoot(), "prompts", "review.md"),
      promptArgs: {
        COMMITS: dossier.commits,
        DIFF: dossier.diff,
        CHANGE: dossier.change,
        STANDARDS: dossier.standards
      },
      branch: `reviewer/${dossier.head.slice(0, 12)}`,
      outputTag: "verdict"
    });
    return parseVerdict(answer.text);
  } catch (error) {
    return { kind: "unjudged", reason: failureReason(error) };
  }
}

// src/reviewer/plan.ts
function reviewQueue(issues, pullsOf) {
  const items = [];
  for (const issue of issues) {
    if (!issue.labels.includes("sdd:auto-review")) {
      continue;
    }
    if (!issue.labels.includes("sdd:accepting")) {
      items.push({ kind: "skip", issue: issue.key, reason: "sdd:auto-review waits for accepting" });
      continue;
    }
    if (issue.labels.includes("sdd:auto-merge")) {
      items.push({
        kind: "skip",
        issue: issue.key,
        reason: "sdd:auto-merge merges without this review"
      });
      continue;
    }
    const open = pullsOf(issue.key).filter((pull) => pull.state === "OPEN");
    if (open.length !== 1) {
      items.push({
        kind: "wait",
        issue: issue.key,
        reason: open.length === 0 ? "accepting needs the pull request" : "several open pull requests"
      });
      continue;
    }
    items.push({ kind: "ready", issue: issue.key, pull: open[0].id });
  }
  return items;
}
function describe(item, pass) {
  if (pass) {
    if (pass.action === "wait" || pass.action === "unjudged") {
      return `#${item.issue} ${pass.action}: ${pass.reason}`;
    }
    return `#${item.issue} ${pass.action}`;
  }
  if (item.kind === "ready") {
    return `#${item.issue} review pull ${item.pull}`;
  }
  return `#${item.issue} ${item.kind}: ${item.reason}`;
}
function describeQueue(items) {
  if (items.length === 0) {
    return ["no sdd:auto-review issues"];
  }
  return items.map((item) => describe(item));
}

// src/reviewer/run.ts
async function runReview(box, judge) {
  const chosen = judge ?? ((dossier) => {
    if (!box.runtime) {
      throw new Error("runtime is not configured");
    }
    return sandcastleJudge(box.runtime, dossier);
  });
  const issues = await box.tracker.listOpen();
  const pulls = /* @__PURE__ */ new Map();
  for (const issue of issues) {
    pulls.set(issue.key, await box.review.pulls(issue.key));
  }
  const items = reviewQueue(issues, (key) => pulls.get(key) ?? []);
  if (items.length === 0) {
    console.log(describeQueue(items)[0]);
    return 0;
  }
  let code = 0;
  for (const item of items) {
    if (item.kind !== "ready") {
      console.log(describe(item));
      continue;
    }
    const result = await passReview({ review: box.review, vcs: box.vcs, judge: chosen }, item);
    console.log(describe(item, result));
    if (result.action === "unjudged") {
      annotate("error", `#${item.issue} unjudged`, result.reason);
      code = 1;
    }
    if (result.action === "remarks") {
      for (const remark of result.items) {
        annotate("error", `#${item.issue} remark`, remark.body);
      }
    }
    if (result.action === "wait") {
      annotate("warning", `#${item.issue} wait`, result.reason);
    }
  }
  return code;
}

// src/cli.ts
var usage = `Usage:
  remote-solver spy [--parallel N] [--interval S]
  remote-solver review
  remote-solver issue <key>

Cycle verbs are the sdd bin.`;
function route(argv) {
  const [command2, ...rest] = argv;
  if (!command2 || command2 === "help" || command2 === "--help" || command2 === "-h") {
    return { kind: "help" };
  }
  if (command2 === "spy") {
    return { kind: "spy", argv: rest };
  }
  if (command2 === "review") {
    return { kind: "review" };
  }
  if (command2 === "issue") {
    const key = rest[0];
    if (!key || key.startsWith("-")) {
      return { kind: "help" };
    }
    return { kind: "issue", key };
  }
  return { kind: "help" };
}
async function runCli(argv) {
  const chosen = route(argv);
  if (chosen.kind === "help") {
    console.error(usage);
    const asked = argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h";
    return asked ? 0 : 1;
  }
  const box = await openMachine(process.cwd(), {
    runtime: (built) => agentRuntime({
      root: built.root,
      vcs: built.vcs,
      branchPrefix: built.config.branchPrefix,
      queueLabel: built.config.queueLabel,
      prBase: built.config.prBase,
      solverRoot: solverRoot()
    })
  });
  if (chosen.kind === "spy") {
    await runSpy(box, chosen.argv);
    return 0;
  }
  if (chosen.kind === "review") {
    return runReview(box);
  }
  return runIssue(box, chosen.key);
}
if (process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("remote-solver.mjs")) {
  process.exit(await runCli(process.argv.slice(2)));
}
export {
  route,
  runCli
};
