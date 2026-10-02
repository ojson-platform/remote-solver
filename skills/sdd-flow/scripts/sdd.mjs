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
var GATE_PHASES = ["proposed", "specified", "designed", "accepted"];
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
function removedPhaseLabels(labels, to) {
  const add = LABEL(to);
  return labels.filter((name) => PHASES.some((phase) => name === LABEL(phase)) && name !== add);
}
function labelsAfterAdvance(labels, to) {
  const kept = labels.filter(
    (name) => name !== "sdd:wait-human" && !PHASES.some((phase) => name === LABEL(phase))
  );
  return [...kept, LABEL(to)];
}

// src/machine/labels.ts
var LABEL2 = (phase) => `sdd:${phase}`;
function setPhase(key, phase, tracker, options) {
  if (!options?.allowGate && GATE_PHASES.includes(phase)) {
    throw new Error(
      `Refusing to set gate label sdd:${phase}. A person changes the phase on the issue, or runs sdd accept ${key}.`
    );
  }
  const names = tracker.labels(key);
  const remove = removedPhaseLabels(names, phase);
  tracker.editLabels(key, [LABEL2(phase)], remove);
}
function setWait(key, waiting, tracker) {
  if (!waiting) {
    const names = tracker.labels(key);
    if (!names.includes("sdd:wait-human")) {
      return;
    }
    tracker.editLabels(key, [], ["sdd:wait-human"]);
    return;
  }
  tracker.editLabels(key, ["sdd:wait-human"], []);
}
function openWait(key, ask, tracker) {
  setWait(key, true, tracker);
  tracker.comment(key, ask);
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
function readReview(threads2, comments) {
  const layers = [];
  const lines = [];
  let unanswered = conversationUnanswered(comments);
  for (const thread2 of threads2) {
    if (thread2.resolved) {
      continue;
    }
    const marker = parseMarker(thread2.body);
    if (!marker) {
      unanswered = true;
    } else if (marker.kind === "layer") {
      layers.push(marker.layer);
    }
    lines.push({
      thread: thread2.id ?? "",
      comment: thread2.comment ?? "",
      file: thread2.path ?? "",
      line: thread2.line ?? null,
      marker: markerOf(thread2.body),
      body: thread2.body
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
function threadsReport(threads2, comments, filter) {
  const reading = readReview(threads2, comments);
  const lines = reading.threads.filter((line) => filter?.layer ? line.marker === filter.layer : true).filter((line) => filter?.unmarked ? line.marker === null : true);
  return { threads: lines, conversation: reading.conversation };
}
function reviewOf(threads2, comments) {
  const reading = readReview(threads2, comments);
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
function publishChoice(openIds) {
  if (openIds.length > 1) {
    return { ok: false, reason: severalOpenReason(openIds) };
  }
  return { ok: true, id: openIds[0] ?? null };
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
function accept(issue, change) {
  if (!issue.labels.includes("sdd:cycle")) {
    return { kind: "wait", issue: issue.key, reason: `#${issue.key} has no sdd:cycle label` };
  }
  const phase = phaseOf(issue.labels);
  const next = phase ? HUMAN_NEXT[phase] : void 0;
  if (!phase || !next) {
    return {
      kind: "wait",
      issue: issue.key,
      reason: `#${issue.key} is ${phase ?? "without a phase"}. Accept closes only proposing, specifying, or designing.`
    };
  }
  const blocker = gateBlocker(issue.key, phase, change);
  if (blocker) {
    return { kind: "wait", issue: issue.key, reason: blocker };
  }
  return { kind: "advance", issue: issue.key, to: next, reason: `${phase} \u2192 ${next}` };
}
function settle(issue, issues, pulls, change) {
  let labels = [...issue.labels];
  const transitions = [];
  for (let step2 = 0; step2 < 12; step2 += 1) {
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
function pullSnapshots(review, key) {
  return review.pulls(key).map((pull) => ({
    ...pull,
    review: pull.state === "OPEN" ? reviewOf(review.threads(pull.id), review.comments(pull.id)) : emptyReview
  }));
}
function loadCycle(tracker, review, filesAt, queueLabel) {
  const issues = tracker.listOpen();
  const cycles = issues.filter((issue) => issue.labels.includes(queueLabel) && issue.labels.includes("sdd:cycle")).sort((a, b) => a.key.localeCompare(b.key, void 0, { numeric: true }));
  const pulls = /* @__PURE__ */ new Map();
  const changes = /* @__PURE__ */ new Map();
  for (const issue of cycles) {
    pulls.set(issue.key, pullSnapshots(review, issue.key));
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
function applyLabels(tracker, key, before, after) {
  const add = after.filter((label) => !before.includes(label));
  const remove = before.filter((label) => !after.includes(label));
  if (add.length || remove.length) {
    tracker.editLabels(key, add, remove);
  }
}
function closeAccepted(tracker, key) {
  tracker.close(key, "SDLC accepted: the pull request is merged and the baseline is in trunk.");
}
function applySettlement(tracker, before, settled, key) {
  applyLabels(tracker, key, before, settled.labels);
  const closing = settled.transitions.find((transition) => transition.to === "accepted");
  for (const transition of settled.transitions) {
    if (transition.comment) {
      tracker.comment(key, transition.comment);
    }
  }
  if (closing) {
    closeAccepted(tracker, key);
  }
  if (settled.decision.kind === "wait" && settled.decision.gate && !before.includes("sdd:wait-human")) {
    openWait(key, gateAsk(key, settled.decision.gate, tracker), tracker);
  }
}
function resolveCycle(snapshot, tracker, queueLabel, busy = /* @__PURE__ */ new Set()) {
  const empty = queueLabelOf(snapshot, queueLabel);
  if (empty.length) {
    return empty;
  }
  return snapshot.cycles.filter((record) => !busy.has(record.key)).map((record) => {
    const change = snapshot.changes.get(record.key);
    if (!change) {
      return { kind: "wait", issue: record.key, reason: "change was not loaded" };
    }
    const settled = settle(record, snapshot.issues, snapshot.pulls.get(record.key) ?? [], change);
    applySettlement(tracker, record.labels, settled, record.key);
    return settled.decision;
  });
}
function resolveIssue(key, options) {
  const issues = options.tracker.listOpen();
  const record = issues.find(
    (issue) => issue.key === key && issue.labels.includes(options.queueLabel) && issue.labels.includes("sdd:cycle")
  );
  if (!record) {
    return { kind: "done", issue: key, reason: "not in the open cycle" };
  }
  const settled = settle(
    record,
    issues,
    pullSnapshots(options.review, key),
    options.change ?? readChange(key, options.files)
  );
  applySettlement(options.tracker, record.labels, settled, key);
  return settled.decision;
}
function performIssue(key, options) {
  const decision = resolveIssue(key, options);
  if (decision.kind !== "merge") {
    return decision;
  }
  options.review.merge(decision.pull);
  const settled = resolveIssue(key, options);
  if (settled.kind === "merge") {
    throw new Error(`merge of PR #${decision.pull} did not settle`);
  }
  return settled;
}
function pick(decisions) {
  return decisions.find((item) => item.kind === "advance") ?? decisions.find((item) => item.kind === "agent") ?? decisions.find((item) => item.kind === "merge") ?? {
    kind: "wait",
    issue: null,
    reason: decisions.map((item) => `#${item.issue}: ${item.reason}`).join("\n")
  };
}

// src/adapters/github.ts
import { execFileSync, spawnSync } from "node:child_process";
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
function gh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input });
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
  const login = () => {
    if (!user) {
      user = gh(["api", "user", "--jq", ".login"]).trim();
    }
    return user;
  };
  const readIssue = (key) => JSON.parse(
    gh(["issue", "view", key, "--repo", repoSlug(), "--json", "number,title,body,state,labels"])
  );
  const tracker = {
    login,
    listOpen() {
      const found = JSON.parse(
        gh([
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
    issue: (key) => asRecord(readIssue(key)),
    labels: (key) => asRecord(readIssue(key)).labels,
    editLabels(key, add, remove) {
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
      gh(args);
    },
    updateBody(key, body) {
      gh(["issue", "edit", key, "--repo", repoSlug(), "--body", body]);
    },
    comment(key, body) {
      gh(["issue", "comment", key, "--repo", repoSlug(), "--body", markRobot(body)]);
    },
    close(key, comment) {
      gh(["issue", "close", key, "--repo", repoSlug(), "--comment", markRobot(comment)]);
    },
    phaseHint: labelHint
  };
  const linked = (key) => {
    const found = JSON.parse(
      gh([
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
    pulls(key) {
      return linked(key).map((pr) => {
        const id = String(pr.number);
        if (pr.state !== "OPEN") {
          return {
            id,
            title: pr.title,
            state: pr.state,
            checks: "none"
          };
        }
        const view = JSON.parse(
          gh(["pr", "view", id, "--repo", repoSlug(), "--json", "statusCheckRollup,state"])
        );
        return {
          id,
          title: pr.title,
          state: pr.state,
          checks: classifyChecks(view)
        };
      });
    },
    threads(pull) {
      return this.threadList(pull).map((thread2) => ({ resolved: thread2.resolved, body: thread2.body }));
    },
    threadList(pull) {
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
        gh([
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
    comments(pull) {
      const comments = JSON.parse(
        gh([
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
    ensurePull(key, title, body) {
      const open = linked(key).filter((pr) => pr.state === "OPEN").map((pr) => String(pr.number));
      if (open[0]) {
        return open[0];
      }
      const url = gh([
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
      ]).trim();
      const id = url.match(/\/(\d+)\s*$/)?.[1];
      if (!id) {
        throw new Error(`gh pr create returned no pull number: ${url}`);
      }
      return id;
    },
    openThread(pull, target) {
      gh([
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
    reply(pull, comment, body) {
      gh([
        "api",
        "--method",
        "POST",
        `repos/${repoSlug()}/pulls/${pull}/comments/${comment}/replies`,
        "-f",
        `body=${markRobot(body)}`
      ]);
    },
    say(pull, body) {
      gh(["issue", "comment", pull, "--repo", repoSlug(), "--body", markRobot(body)]);
    },
    speak(pull, body) {
      gh(["issue", "comment", pull, "--repo", repoSlug(), "--body", body]);
    },
    flag(pull, head, notes) {
      const payload = changesPayload(head, notes);
      const post = () => gh(
        ["api", "--method", "POST", "--input", "-", `repos/${repoSlug()}/pulls/${pull}/reviews`],
        JSON.stringify(payload)
      );
      try {
        post();
      } catch {
        const text = notes.map((note) => note.body).join("\n\n");
        try {
          gh(
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
          this.speak(pull, text);
          return;
        }
        this.speak(pull, text);
        return;
      }
      if (payload.comments.length === 0 && payload.body) {
        this.speak(pull, payload.body);
      }
      const loose = notes.filter((note) => !note.path).map((note) => note.body).join("\n\n");
      if (payload.comments.length > 0 && loose) {
        this.speak(pull, loose);
      }
    },
    range(pull) {
      const view = JSON.parse(
        gh(["pr", "view", pull, "--repo", repoSlug(), "--json", "headRefOid,baseRefOid"])
      );
      return { head: view.headRefOid ?? "", base: view.baseRefOid ?? null };
    },
    resolveThread(thread2) {
      const query = "mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}) { thread { isResolved } } }";
      gh(["api", "graphql", "-f", `query=${query}`, "-f", `id=${thread2}`]);
    },
    checksText(pull) {
      const result = spawnSync("gh", ["pr", "checks", pull, "--repo", repoSlug()], {
        encoding: "utf8"
      });
      return `${result.stdout ?? ""}${result.stderr ?? ""}`;
    },
    merge(pull) {
      try {
        gh(["pr", "merge", pull, "--repo", repoSlug(), "--rebase"]);
      } catch (error) {
        const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
        const message = error instanceof Error ? error.message : String(error);
        if (!/already merged/i.test(`${message}
${stderr}`)) {
          throw error;
        }
      }
      const view = JSON.parse(
        gh(["pr", "view", pull, "--repo", repoSlug(), "--json", "state"])
      );
      if (view.state !== "MERGED") {
        throw new Error(`merge of PR #${pull} left it ${view.state ?? "OPEN"}`);
      }
    }
  };
  return { tracker, review };
}

// src/adapters/vcs.ts
import { execFileSync as execFileSync2 } from "node:child_process";
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
function isAncestor(root, commit, tip) {
  try {
    execFileSync2("git", ["merge-base", "--is-ancestor", commit, tip], { cwd: root, stdio: "ignore" });
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
function prepareCheckout(root, key, config) {
  ensureIssueBranch(root, key, config);
  const leaf = branchName(key, config.branchPrefix).replaceAll("/", "-");
  const dir = path5.join(root, config.worktreesDir, leaf);
  if (!existsSync2(dir)) {
    mkdirSync(path5.dirname(dir), { recursive: true });
    execFileSync2("git", ["worktree", "add", "-q", dir, branchName(key, config.branchPrefix)], {
      cwd: root,
      stdio: "ignore"
    });
  }
  ignorePath(root, `/${config.worktreesDir}/`);
  execFileSync2("sh", ["-c", config.link], { cwd: dir, stdio: "ignore" });
  return dir;
}
function ensureIssueBranch(root, key, config) {
  const branch = branchName(key, config.branchPrefix);
  if (git(root, ["rev-parse", "--verify", "--quiet", branch], true).trim()) {
    return;
  }
  try {
    execFileSync2("git", ["fetch", "origin", `${branch}:${branch}`], { cwd: root, stdio: "ignore" });
  } catch {
    execFileSync2("git", ["branch", branch, config.defaultBranch], { cwd: root, stdio: "inherit" });
  }
}
function gitVcs(root, config = {}) {
  const prefix = config.branchPrefix ?? "sdd";
  const base = config.defaultBranch ?? "origin/master";
  return {
    prepare(key, options) {
      return prepareCheckout(root, key, {
        branchPrefix: prefix,
        defaultBranch: base,
        worktreesDir: options.worktreesDir,
        link: linkCommand(options.links, root)
      });
    },
    tip(key) {
      const found = git(root, ["rev-parse", "--verify", "--quiet", branchName(key, prefix)], true).trim();
      if (!found) {
        throw new Error(`no branch ${branchName(key, prefix)}`);
      }
      return found;
    },
    filesAt: (key) => gitFiles(root, key, prefix),
    compare(base2, head) {
      try {
        const commits = git(root, ["log", "--oneline", `${base2}..${head}`]);
        const diff = git(root, ["diff", `${base2}...${head}`]);
        return { commits, diff };
      } catch {
        return null;
      }
    },
    head() {
      return execFileSync2("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    },
    push(key) {
      execFileSync2("git", ["push", "-u", "origin", branchName(key, prefix)], {
        cwd: root,
        stdio: "inherit"
      });
    },
    published(key, commit) {
      const tip = git(root, ["ls-remote", "origin", `refs/heads/${branchName(key, prefix)}`]).trim().split(/\s+/)[0];
      if (!tip) {
        return false;
      }
      return tip === commit || isAncestor(root, commit, tip);
    },
    dirty() {
      const entries = git(root, ["status", "--porcelain", "-z"]).split("\0");
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

// src/machine/mirror.ts
var BEGIN = "<!-- sdd:begin -->";
var END = "<!-- sdd:end -->";
function updateMirror(body, layer, text) {
  const row = `${layer}: ${text}`;
  const start = body.indexOf(BEGIN);
  const end = body.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    const block = `${BEGIN}
${row}
${END}`;
    const trimmed = body.replace(/\s*$/, "");
    return `${trimmed}${trimmed ? "\n\n" : ""}${block}
`;
  }
  const inner = body.slice(start + BEGIN.length, end).replace(/^\n/, "").replace(/\n$/, "");
  const lines = inner.split("\n").filter((line) => line.trim() !== "");
  const next = lines.some((line) => line.startsWith(`${layer}:`)) ? lines.map((line) => line.startsWith(`${layer}:`) ? row : line) : [...lines, row];
  return `${body.slice(0, start)}${BEGIN}
${next.join("\n")}
${END}${body.slice(end + END.length)}`;
}

// src/sdd.ts
function fail(message) {
  console.error(message);
  process.exit(1);
}
function need(value, usage2) {
  if (!value) {
    fail(usage2);
  }
  return value;
}
var usage = 'Usage: sdd plan | step <key> [--auto-plan] [--auto-spec] [--auto-design] | worktree <key> | set <key> <phase> | wait <key> "<what the person does>" | unwait <key> | accept <key> | publish <key> "<title>" | checks <pull> | threads <pull> [--layer <layer>] [--unmarked] | thread open|reply|say|resolve ... | thread fix <key> <pull> <thread>|--conversation | mirror <key> <Layer> <text>';
var AUTO_LABEL = {
  "--auto-plan": "sdd:auto-plan",
  "--auto-spec": "sdd:auto-spec",
  "--auto-design": "sdd:auto-design"
};
var SESSION_WORKTREES = ".worktrees";
function stepArgs(rest) {
  const [key, ...flags] = rest;
  if (!key || key.startsWith("-")) {
    return null;
  }
  const labels = [];
  for (const flag of flags) {
    const label = AUTO_LABEL[flag];
    if (!label || labels.includes(label)) {
      return null;
    }
    labels.push(label);
  }
  return { key, labels };
}
function threadsArgs(rest) {
  const [pull, ...flags] = rest;
  if (!pull || pull.startsWith("-")) {
    return null;
  }
  let layer;
  let unmarked = false;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--layer") {
      layer = flags[index + 1];
      index += 1;
      if (!layer) {
        return null;
      }
    } else if (flag === "--unmarked") {
      unmarked = true;
    } else {
      return null;
    }
  }
  return { pull, layer, unmarked };
}
function fixArgs(rest) {
  const [key, pull, target, ...extra] = rest;
  if (!key || !pull || !target || extra.length > 0 || key.startsWith("-") || pull.startsWith("-")) {
    return null;
  }
  if (target === "--conversation") {
    return { key, pull, thread: null };
  }
  return target.startsWith("-") ? null : { key, pull, thread: target };
}
function fixThread(args, deps) {
  const head = deps.vcs.head();
  if (!deps.vcs.published(args.key, head)) {
    throw new Error(
      `HEAD ${head} is not on the remote branch of #${args.key}: Publish, then thread fix.`
    );
  }
  const body = `sdd:fixed ${head}`;
  if (args.thread === null) {
    deps.review.say(args.pull, body);
    return body;
  }
  const record = deps.review.threadList(args.pull).find((item) => item.id === args.thread);
  if (!record) {
    throw new Error(`No thread ${args.thread} on pull ${args.pull}.`);
  }
  if (record.resolved) {
    return body;
  }
  if (parseMarker(record.body)?.kind !== "fixed") {
    deps.review.reply(args.pull, record.comment, body);
  }
  deps.review.resolveThread(record.id);
  return body;
}
function publish(args, deps) {
  const dirt = deps.vcs.dirty();
  if (dirt.length > 0) {
    throw new Error(
      [
        `The worktree is not clean, #${args.key} is not published. Remove the cause of each path (ignore a generated directory in the service .gitignore, delete a stray file, or commit a file of this task), then publish again:`,
        ...dirt.map((file) => `  ${file}`)
      ].join("\n")
    );
  }
  const open = deps.review.pulls(args.key).filter((pr) => pr.state === "OPEN").map((pr) => pr.id);
  const choice = publishChoice(open);
  if (!choice.ok) {
    throw new Error(choice.reason);
  }
  deps.vcs.push(args.key);
  const id = deps.review.ensurePull(args.key, args.title, `${changeDir(args.key)}/`);
  return `#${args.key}: pull ${id}`;
}
function runSdd(argv, box = machine()) {
  const [command, ...rest] = argv;
  if (command === "help" || command === "--help" || command === "-h") {
    console.error(usage);
    return;
  }
  try {
    dispatch(box, command, rest);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
function dispatch(box, command, rest) {
  const verb = command === void 0 ? void 0 : verbs[command];
  if (!verb) {
    fail(usage);
  }
  verb(box, rest);
}
var verbs = {
  plan,
  step,
  worktree,
  set,
  wait,
  unwait,
  accept: accept2,
  publish: publishCommand,
  checks,
  threads,
  thread,
  mirror
};
function plan(box) {
  const snapshot = loadCycle(
    box.tracker,
    box.review,
    (key) => box.vcs.filesAt(key),
    box.config.queueLabel
  );
  const decision = pick(resolveCycle(snapshot, box.tracker, box.config.queueLabel));
  console.log(JSON.stringify(decision, null, 2));
}
function step(box, rest) {
  const args = stepArgs(rest);
  if (!args) {
    fail(usage);
  }
  const record = box.tracker.issue(args.key);
  const inCycle = record.labels.includes(box.config.queueLabel) && record.labels.includes("sdd:cycle");
  if (!inCycle) {
    printStep({ kind: "done", issue: args.key, reason: "not in the open cycle" }, box);
    return;
  }
  if (args.labels.length) {
    box.tracker.editLabels(args.key, args.labels, []);
  }
  printStep(turn(box, args.key), box);
}
function printStep(decision, box) {
  console.log(
    JSON.stringify({ ...decision, queue: box.config.queueLabel, base: box.config.prBase }, null, 2)
  );
}
function worktree(box, rest) {
  const key = need(rest[0], usage);
  if (rest.length !== 1) {
    fail(usage);
  }
  const dir = box.vcs.prepare(key, { worktreesDir: SESSION_WORKTREES, links: packageLinks(solverRoot()) });
  console.log(dir);
}
function set(box, rest) {
  const key = need(rest[0], usage);
  const phase = need(rest[1], usage);
  if (!PHASES.includes(phase)) {
    fail(usage);
  }
  setPhase(key, phase, box.tracker);
}
function wait(box, rest) {
  const key = need(rest[0], usage);
  const reason = rest.slice(1).join(" ").trim();
  if (!reason) {
    fail(usage);
  }
  openWait(key, reason, box.tracker);
}
function unwait(box, rest) {
  setWait(need(rest[0], usage), false, box.tracker);
}
function accept2(box, rest) {
  const key = need(rest[0], usage);
  const record = box.tracker.issue(key);
  const decision = accept(record, readChange(key, box.vcs.filesAt(key)));
  if (decision.kind !== "advance") {
    throw new Error(decision.reason);
  }
  applyLabels(box.tracker, key, record.labels, labelsAfterAdvance(record.labels, decision.to));
  const login = box.tracker.login();
  box.tracker.comment(key, `sdd:accept ${decision.reason} by @${login}`);
  console.log(`#${key}: ${decision.reason}`);
}
function publishCommand(box, rest) {
  const key = need(rest[0], usage);
  const title = rest.slice(1).join(" ");
  if (!title) {
    fail(usage);
  }
  console.log(publish({ key, title }, box));
}
function checks(box, rest) {
  const text = box.review.checksText(need(rest[0], usage)).replace(/\n$/, "");
  if (text) {
    console.log(text);
  }
}
function threads(box, rest) {
  const args = threadsArgs(rest);
  if (!args) {
    fail(usage);
  }
  const report = threadsReport(box.review.threadList(args.pull), box.review.comments(args.pull), {
    layer: args.layer,
    unmarked: args.unmarked
  });
  console.log(JSON.stringify(report, null, 2));
}
var threadVerbs = {
  open: threadOpen,
  reply: threadReply,
  say: threadSay,
  resolve: threadResolve,
  fix: threadFix
};
function thread(box, rest) {
  const verb = rest[0] === void 0 ? void 0 : threadVerbs[rest[0]];
  if (!verb) {
    fail(usage);
  }
  verb(box, rest);
}
function threadOpen(box, rest) {
  const pull = need(rest[1], usage);
  const file = need(rest[2], usage);
  const line = Number(need(rest[3], usage));
  const body = rest.slice(4).join(" ");
  if (!Number.isInteger(line) || !body) {
    fail(usage);
  }
  box.review.openThread(pull, { commit: box.vcs.head(), path: file, line, body });
}
function threadReply(box, rest) {
  const pull = need(rest[1], usage);
  const comment = need(rest[2], usage);
  const body = rest.slice(3).join(" ");
  if (!body) {
    fail(usage);
  }
  box.review.reply(pull, comment, body);
}
function threadSay(box, rest) {
  const pull = need(rest[1], usage);
  const body = rest.slice(2).join(" ");
  if (!body) {
    fail(usage);
  }
  box.review.say(pull, body);
}
function threadResolve(box, rest) {
  box.review.resolveThread(need(rest[1], usage));
}
function threadFix(box, rest) {
  const args = fixArgs(rest.slice(1));
  if (!args) {
    fail(usage);
  }
  console.log(fixThread(args, box));
}
function mirror(box, rest) {
  const key = need(rest[0], usage);
  const layer = need(rest[1], usage);
  const text = rest.slice(2).join(" ");
  if (!text) {
    fail(usage);
  }
  const record = box.tracker.issue(key);
  box.tracker.updateBody(key, updateMirror(record.body, layer, text));
}
if (process.argv[1]?.endsWith("sdd.ts") || process.argv[1]?.endsWith("sdd.mjs")) {
  runSdd(process.argv.slice(2), await openMachine(process.cwd()));
}
export {
  fixArgs,
  fixThread,
  publish,
  runSdd,
  threadsArgs
};
