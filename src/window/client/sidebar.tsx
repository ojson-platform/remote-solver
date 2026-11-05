import type {ReactNode} from 'react';

import type {SpecEntry, SpecRow} from '../spec-diff.ts';
import type {Spine, SpineLayer, SpineSourceLine, SpineTask} from '../spine.ts';
import type {WindowSnapshot} from '../snapshot.ts';
import type {GateStation, SidebarBlock} from '../types.ts';
import type {LineDraft, OpenFold, SpecOpen} from './gesture.ts';

import {Fragment} from 'react';

import {unchangedLabel} from '../spec-diff.ts';

import {Gate, LinkMarks} from './board.tsx';
import {BusyEdge} from './busy.tsx';
import {ActForm, Hidden} from './forms.tsx';
import {capIsOpen, layerHasFold} from './gesture.ts';
import {Cross, SendMark} from './marks.tsx';

function codeLine(line: string, places: Record<string, string>): ReactNode {
  const matched = /^(\s*)Code(\s+)(\S.*)$/.exec(line);
  const rest = matched?.[3];
  if (!matched || rest === undefined || rest.trim() === 'solid') {
    return line;
  }
  const gaps = rest.split(';');
  const rendered = gaps.map((gap, index) => {
    const bits = /^(\s*)(.*?)(\s*)$/.exec(gap);
    const lead = bits?.[1] ?? '';
    const core = bits?.[2] ?? '';
    const trail = bits?.[3] ?? '';
    const found = /^(\S+):(\d+)$/.exec(core);
    const prefix = index === 0 ? '' : ';';
    if (!found?.[1] || found[2] === undefined) {
      return (
        <span key={index}>
          {prefix}
          {gap}
        </span>
      );
    }
    const url = places[`${found[1]}:${found[2]}`];
    const token = url === undefined || url === '' ? core : <a href={url}>{core}</a>;
    return (
      <span key={index}>
        {prefix}
        {lead}
        {token}
        {trail}
      </span>
    );
  });
  return (
    <>
      {matched[1]}Code{matched[2]}
      {rendered}
    </>
  );
}

function implTask(tasks: readonly SpineTask[]): SpineTask | undefined {
  return tasks.find(task => !task.done);
}

function tasksSummary(model: Spine, places: Record<string, string>): ReactNode {
  if (model.station !== 'implementing') {
    return sentence(model, 'Tasks', places);
  }
  const task = implTask(model.tasks);
  if (!task) {
    return sentence(model, 'Tasks', places);
  }
  const mirror = sentence(model, 'Tasks', places);
  return (
    <span className="sentence">
      {task.id} <span className="badge">impl</span>
      {mirror == null ? null : (
        <>
          <br />
          {mirror}
        </>
      )}
    </span>
  );
}

function sentence(
  model: Spine,
  layer: Exclude<SpineLayer, 'Accept'>,
  places: Record<string, string>,
): ReactNode {
  const own = model.lines.filter(line => line.layer === layer && line.text.trim() !== 'solid');
  if (own.length === 0) {
    return null;
  }
  const nodes: ReactNode[] = [];
  own.forEach((line, index) => {
    if (index > 0) {
      nodes.push(<br key={`br-${index}`} />);
    }
    nodes.push(
      line.layer === 'Code' ? <span key={index}>{codeLine(line.raw, places)}</span> : line.text,
    );
  });
  return <span className="sentence">{nodes}</span>;
}

function layerForStation(station: string): SpineLayer {
  switch (station) {
    case 'proposing':
    case 'proposed':
      return 'Plan';
    case 'specifying':
    case 'specified':
      return 'Specify';
    case 'designing':
    case 'designed':
      return 'Design';
    case 'tasking':
      return 'Tasks';
    case 'implementing':
    case 'verifying':
      return 'Code';
    case 'accepting':
    case 'accepted':
      return 'Accept';
    default:
      return 'Change';
  }
}

function SpineRow({
  layer,
  model,
  open,
  quiet,
  sentenceNode,
  excerpt,
  control,
  children,
}: {
  layer: SpineLayer;
  model: Spine;
  open: boolean;
  quiet: boolean;
  sentenceNode?: ReactNode;
  excerpt?: string;
  control?: ReactNode;
  children: ReactNode;
}): ReactNode {
  const here =
    model.station !== undefined && layerForStation(model.station) === layer ? (
      <>
        {' '}
        <span className="here">{model.station}</span>
      </>
    ) : null;
  const preview =
    excerpt === undefined || excerpt === '' ? null : <span className="excerpt">{excerpt}</span>;
  const headFor = quiet ? undefined : `spine-${layer}`;
  const rest =
    sentenceNode == null && preview == null ? null : (
      <label className="rest" htmlFor={headFor}>
        {sentenceNode}
        {preview}
      </label>
    );
  return (
    <section className={quiet ? 'is-quiet' : undefined}>
      <input
        className="spine-pick"
        type="checkbox"
        id={`spine-${layer}`}
        value={layer}
        checked={open && !quiet}
        readOnly
      />
      <div className="row">
        <div className="lead">
          <label className="layer" htmlFor={headFor}>
            <span className="name">
              {layer}
              {here}
            </span>
          </label>
          {control == null ? null : <div className="acts">{control}</div>}
        </div>
        {rest}
      </div>
      <div className="fold">{children}</div>
    </section>
  );
}

function Remark({keyName, text}: {keyName: string; text: string}): ReactNode {
  return (
    <ActForm act="answer" className="note">
      <Hidden name="key" value={keyName} />
      <label className="draft">
        Комментарий
        <textarea
          name="reply"
          rows={2}
          placeholder="Замечание ко всему документу"
          defaultValue={text}
        />
        <button className="send" type="submit" aria-label="Записать">
          <SendMark />
        </button>
      </label>
    </ActForm>
  );
}

function LineNote({
  keyName,
  line,
  question,
  text,
  path,
  at,
  side,
}: {
  keyName: string;
  line: string;
  question: string;
  text: string;
  path?: string;
  at?: string;
  side?: string;
}): ReactNode {
  const anchor =
    path === undefined || at === undefined || side === undefined ? null : (
      <>
        <Hidden name="path" value={path} />
        <Hidden name="at" value={at} />
        <Hidden name="side" value={side} />
      </>
    );
  return (
    <ActForm act="answer" className="line-note">
      <Hidden name="key" value={keyName} />
      <Hidden name="line" value={line} />
      <Hidden name="question" value={question} />
      {anchor}
      <div className="draft">
        <textarea
          name="reply"
          rows={2}
          placeholder={question === '' ? 'Комментарий к этой строке' : 'Ответ'}
          aria-label="Комментарий к строке"
          defaultValue={text}
        />
        <button className="send" type="submit" aria-label="Записать">
          <SendMark />
        </button>
      </div>
      <button className="shut" type="button" data-dismiss-line aria-label="Закрыть">
        <Cross />
      </button>
    </ActForm>
  );
}

function lineTemplate(keyName: string): ReactNode {
  return (
    <template className="line-note-template">
      <LineNote keyName={keyName} line="" question="" text="" />
    </template>
  );
}

type PostedLineComment = {body: string; fixedCommit?: string | null};

function commentsOnLine(
  blocks: readonly SidebarBlock[],
  path: string,
  line: number,
): readonly PostedLineComment[] {
  const out: PostedLineComment[] = [];
  for (const block of blocks) {
    if (block.kind !== 'line-thread' || block.file !== path || block.line !== line) {
      continue;
    }
    block.comments.forEach((body, index) => {
      out.push({
        body,
        ...(index === 0 && block.fixedCommit !== undefined
          ? {fixedCommit: block.fixedCommit}
          : {}),
      });
    });
  }
  return out;
}

type PhaseLayer = Exclude<SpineLayer, 'Accept'>;

function layerOfPath(file: string): PhaseLayer {
  const normalized = file.replace(/\\/g, '/');
  const base = normalized.split('/').pop() ?? '';
  if (base === 'proposal.md') {
    return 'Plan';
  }
  if (base === 'design.md') {
    return 'Design';
  }
  if (base === 'tasks.md' || normalized.includes('/tasks/')) {
    return 'Tasks';
  }
  if (normalized.includes('/specs/') && normalized.endsWith('/spec.md')) {
    return 'Specify';
  }
  return 'Code';
}

function drawnLineKeys(model: Spine): Set<string> {
  const keys = new Set<string>();
  const root = model.readPath;
  const markFile = (file: string, line: number): void => {
    keys.add(`${root}/${file}:${line}`);
  };
  const markLines = (file: 'proposal.md' | 'design.md', sections: Spine['proposal']['sections']): void => {
    for (const section of sections) {
      for (const line of section.lines) {
        if (line.text.trim() !== '') {
          markFile(file, line.line);
        }
      }
    }
  };
  markLines('proposal.md', model.proposal.sections);
  markLines('design.md', model.design.sections);
  for (const capability of model.capabilities) {
    for (const entry of capability.rows) {
      if (entry.kind === 'gap') {
        for (const row of entry.hidden) {
          const anchor = row.anchor;
          if (anchor !== undefined) {
            keys.add(`${anchor.path}:${anchor.line}`);
          }
        }
        continue;
      }
      const anchor = entry.anchor;
      if (anchor !== undefined) {
        keys.add(`${anchor.path}:${anchor.line}`);
      }
    }
  }
  return keys;
}

type PhaseCommentEntry = {
  file: string;
  line?: number;
  comments: readonly string[];
  fixedCommit?: string | null;
};

function phaseComments(
  blocks: readonly SidebarBlock[],
  model: Spine,
  layer: PhaseLayer,
): PhaseCommentEntry[] {
  const drawn = drawnLineKeys(model);
  const out: PhaseCommentEntry[] = [];
  for (const block of blocks) {
    if (block.kind === 'phase-thread' && block.layer === layer) {
      out.push({
        file: block.file,
        comments: block.comments,
        ...(block.fixedCommit !== undefined ? {fixedCommit: block.fixedCommit} : {}),
      });
      continue;
    }
    if (block.kind !== 'line-thread' || layerOfPath(block.file) !== layer) {
      continue;
    }
    const key = `${block.file}:${block.line}`;
    if (drawn.has(key)) {
      continue;
    }
    out.push({
      file: block.file,
      line: block.line,
      comments: block.comments,
      ...(block.fixedCommit !== undefined ? {fixedCommit: block.fixedCommit} : {}),
    });
  }
  return out;
}

function FixedStatus({commit}: {commit: string | null}): ReactNode {
  return (
    <p className="thread-fixed">
      {commit === null ? 'исправлено' : `исправлено · ${commit}`}
    </p>
  );
}

function PostedComments({comments}: {comments: readonly PostedLineComment[]}): ReactNode {
  if (comments.length === 0) {
    return null;
  }
  return (
    <>
      {comments.map((comment, index) => (
        <div className="posted-comment" key={index}>
          <pre>{comment.body}</pre>
          {comment.fixedCommit !== undefined ? <FixedStatus commit={comment.fixedCommit} /> : null}
        </div>
      ))}
    </>
  );
}

function PostedPhaseComments({entries}: {entries: readonly PhaseCommentEntry[]}): ReactNode {
  if (entries.length === 0) {
    return null;
  }
  return (
    <>
      {entries.flatMap((entry, entryIndex) =>
        entry.comments.map((body, commentIndex) => (
          <div
            className="posted-comment"
            key={`${entryIndex}-${commentIndex}`}
            data-path={entry.file}
            {...(entry.line === undefined ? {} : {'data-at': String(entry.line)})}
          >
            <pre>{body}</pre>
            {commentIndex === 0 && entry.fixedCommit !== undefined ? (
              <FixedStatus commit={entry.fixedCommit} />
            ) : null}
          </div>
        )),
      )}
    </>
  );
}

function partsOf(lines: readonly SpineSourceLine[]): {heading: string; lines: SpineSourceLine[]}[] {
  const parts: {heading: string; lines: SpineSourceLine[]}[] = [{heading: '', lines: []}];
  for (const line of lines) {
    const sub = /^###\s+(.+)$/.exec(line.text.trim());
    if (sub?.[1]) {
      parts.push({heading: sub[1], lines: []});
      continue;
    }
    parts.at(-1)?.lines.push(line);
  }
  return parts.filter(part => part.lines.some(item => item.text.trim() !== ''));
}

function PlanLines({
  lines,
  pull,
  questions,
  drafts,
  keyName,
  file,
  root,
  blocks,
}: {
  lines: readonly SpineSourceLine[];
  pull: boolean;
  questions: Spine['proposal']['questions'];
  drafts: readonly LineDraft[];
  keyName: string;
  file: 'proposal.md' | 'design.md';
  root: string;
  blocks: readonly SidebarBlock[];
}): ReactNode {
  let gap = false;
  const out: ReactNode[] = [];
  lines.forEach((line, index) => {
    if (line.text.trim() === '') {
      if (!gap) {
        out.push(<span className="gap" key={`gap-${index}`} />);
      }
      gap = true;
      return;
    }
    gap = false;
    const trimmed = line.text.trim();
    const question = pull
      ? questions.find(item => item.open && trimmed === `- [ ] ${item.text}`)
      : undefined;
    if (!pull) {
      out.push(
        <p className="line" key={index}>
          {line.text.trimEnd()}
        </p>,
      );
      return;
    }
    const draft = drafts.find(item => item.line === line.text.trimEnd());
    const path = `${root}/${file}`;
    out.push(
      <span key={index}>
        <button
          type="button"
          className={draft ? 'line is-on' : 'line'}
          data-line={line.text.trimEnd()}
          data-path={path}
          data-at={line.line}
          data-side="right"
          data-question={question?.text}
        >
          {line.text.trimEnd()}
        </button>
        {draft ? (
          <LineNote
            keyName={keyName}
            line={draft.line}
            question={draft.question}
            text={draft.text}
            path={path}
            at={String(line.line)}
            side="right"
          />
        ) : null}
        <PostedComments comments={commentsOnLine(blocks, path, line.line)} />
      </span>,
    );
  });
  return out;
}

function PlanDocument({
  model,
  keyName,
  drafts,
  blocks,
}: {
  model: Spine;
  keyName: string;
  drafts: readonly LineDraft[];
  blocks: readonly SidebarBlock[];
}): ReactNode {
  const body = model.proposal.sections.map(section => {
    const lines = section.lines;
    if (section.heading === 'Open questions') {
      if (!lines.some(line => line.text.trim() !== '')) {
        return null;
      }
      const hold = model.proposal.questions.some(question => question.open) ? (
        <p className="hold">План принимается, когда открытых вопросов не останется.</p>
      ) : null;
      return (
        <section className="plan-section questions" key={section.heading}>
          <h3>{section.heading}</h3>
          {hold}
          <PlanLines
            lines={lines}
            pull={model.pull}
            questions={model.proposal.questions}
            drafts={drafts}
            keyName={keyName}
            root={model.readPath}
            file="proposal.md"
            blocks={blocks}
          />
        </section>
      );
    }
    const parts = partsOf(lines);
    if (parts.length === 0) {
      return null;
    }
    return (
      <section className="plan-section" key={section.heading}>
        <h3>{section.heading}</h3>
        {parts.map(part => (
          <div key={part.heading === '' ? 'body' : part.heading}>
            {part.heading === '' ? null : <h4>{part.heading}</h4>}
            <PlanLines
              lines={part.lines}
              pull={model.pull}
              questions={model.proposal.questions}
              drafts={drafts}
              keyName={keyName}
              root={model.readPath}
              file="proposal.md"
              blocks={blocks}
            />
          </div>
        ))}
      </section>
    );
  });
  return (
    <>
      <div className="doc">{body}</div>
      {model.pull ? lineTemplate(keyName) : null}
    </>
  );
}

function TaskFile({
  task,
  pull,
  root,
  blocks,
}: {
  task: SpineTask;
  pull: boolean;
  root: string;
  blocks: readonly SidebarBlock[];
}): ReactNode {
  const sections = task.sections.filter(section => section.lines.some(line => line.text.trim() !== ''));
  if (sections.length === 0) {
    return null;
  }
  const path = `${root}/tasks/${task.id}.md`;
  return (
    <div className="doc">
      {sections.map(section => (
        <section className="plan-section" key={section.heading}>
          <h3>{section.heading}</h3>
          {section.lines.map(line =>
            line.text.trim() === '' ? (
              <span className="gap" key={line.line} />
            ) : !pull ? (
              <p className="line" key={line.line}>
                {line.text}
              </p>
            ) : (
              <span key={line.line}>
                <button
                  type="button"
                  className="line"
                  data-line={line.text}
                  data-path={path}
                  data-at={line.line}
                  data-side="right"
                >
                  {line.text}
                </button>
                <PostedComments comments={commentsOnLine(blocks, path, line.line)} />
              </span>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

function DesignDocument({
  model,
  keyName,
  drafts,
  blocks,
}: {
  model: Spine;
  keyName: string;
  drafts: readonly LineDraft[];
  blocks: readonly SidebarBlock[];
}): ReactNode {
  const body = model.design.sections.map(section => {
    const lines = section.lines;
    if (section.heading === 'Open questions') {
      if (!lines.some(line => line.text.trim() !== '')) {
        return null;
      }
      return (
        <section className="plan-section questions" key={section.heading}>
          <h3>{section.heading}</h3>
          <PlanLines
            lines={lines}
            pull={model.pull}
            questions={model.design.questions}
            drafts={drafts}
            keyName={keyName}
            root={model.readPath}
            file="design.md"
            blocks={blocks}
          />
        </section>
      );
    }
    const parts = partsOf(lines);
    if (parts.length === 0) {
      return null;
    }
    return (
      <section className="plan-section" key={section.heading}>
        <h3>{section.heading}</h3>
        {parts.map(part => (
          <div key={part.heading === '' ? 'body' : part.heading}>
            {part.heading === '' ? null : <h4>{part.heading}</h4>}
            <PlanLines
              lines={part.lines}
              pull={model.pull}
              questions={[]}
              drafts={drafts}
              keyName={keyName}
              root={model.readPath}
              file="design.md"
              blocks={blocks}
            />
          </div>
        ))}
      </section>
    );
  });
  return (
    <>
      <div className="doc">{body}</div>
      {model.pull ? lineTemplate(keyName) : null}
    </>
  );
}

function reviewFold(
  model: Spine,
  keyName: string,
  gate: NonNullable<Spine['reviewGate']>,
  shown: boolean,
  remark: string,
  layer: 'Plan' | 'Specify' | 'Design',
  blocks: readonly SidebarBlock[],
): ReactNode {
  if (!model.pull) {
    return null;
  }
  if (!shown && model.reviewGate !== gate) {
    return null;
  }
  return (
    <div className="plan-foot">
      <PostedPhaseComments entries={phaseComments(blocks, model, layer)} />
      <Remark keyName={keyName} text={remark} />
    </div>
  );
}

export function clampFocusPageIndex(index: number, pageCount: number): number {
  if (pageCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, index), pageCount - 1);
}

export function focusIndexAfterSnapshot(input: {
  prevKey: string | undefined;
  nextKey: string | undefined;
  prevLatestBody: string | undefined;
  nextLatestBody: string | undefined;
  index: number;
  pageCount: number;
}): number {
  if (input.prevKey !== input.nextKey) {
    return 0;
  }
  if (input.prevLatestBody !== input.nextLatestBody) {
    return 0;
  }
  return clampFocusPageIndex(input.index, input.pageCount);
}

function focusPages(blocks: readonly SidebarBlock[]): Extract<SidebarBlock, {kind: 'focus'}>[] {
  return blocks.filter((block): block is Extract<SidebarBlock, {kind: 'focus'}> => block.kind === 'focus');
}

export function FocusBlocks({
  blocks,
  pageIndex = 0,
}: {
  blocks: readonly SidebarBlock[];
  pageIndex?: number;
}): ReactNode {
  const pages = focusPages(blocks);
  if (pages.length === 0) {
    return null;
  }
  const index = clampFocusPageIndex(pageIndex, pages.length);
  const page = pages[index];
  const showBack = pages.length > 1 && index < pages.length - 1;
  const showForward = pages.length > 1 && index > 0;
  return (
    <section className="block focus-block">
      {showBack || showForward ? (
        <div className="focus-pager">
          {showBack ? (
            <button className="quiet" type="button" data-focus="back">
              назад
            </button>
          ) : null}
          {showForward ? (
            <button className="quiet" type="button" data-focus="forward">
              вперёд
            </button>
          ) : null}
        </div>
      ) : null}
      <span className="badge">{page.marker}</span>
      <pre>{page.display}</pre>
    </section>
  );
}

function Blocks({
  blocks,
  places,
}: {
  blocks: readonly SidebarBlock[];
  places: Record<string, string>;
}): ReactNode {
  return blocks
    .filter(block => block.kind === 'reason' || block.kind === 'ask')
    .map((block, index) => {
      if (block.kind === 'reason') {
        return (
          <section className="block" key={index}>
            <h3>повод</h3>
            <p>{block.line}</p>
          </section>
        );
      }
      return (
        <section className="block" key={index}>
          <h3>ask</h3>
          <pre>{block.body}</pre>
        </section>
      );
    });
}

function codeExtra(blocks: readonly SidebarBlock[], places: Record<string, string>): ReactNode {
  return blocks
    .filter(block => block.kind === 'unanswered' || block.kind === 'hook')
    .map((block, index) => {
      if (block.kind === 'unanswered') {
        return (
          <section className="block" key={index}>
            <h3>ревью</h3>
            {(block.threads ?? []).map((thread, threadIndex) => (
              <pre key={threadIndex}>{thread.lines.join('\n')}</pre>
            ))}
            {block.comment === undefined ? null : <pre>{block.comment}</pre>}
          </section>
        );
      }
      if ('line' in block) {
        return (
          <section className="block" key={index}>
            <h3>хук</h3>
            <p>{block.line}</p>
          </section>
        );
      }
      return (
        <section className="block" key={index}>
          <h3>хук</h3>
          <ol>
            {block.points.map(point => (
              <li key={`${point.action}-${point.point}`}>
                <span className="pair">
                  {point.action} · {point.point}
                </span>
                <pre>{point.paragraph}</pre>
              </li>
            ))}
          </ol>
        </section>
      );
    });
}

function scenarioOf(text: string): string | undefined {
  const trimmed = text.trim();
  const prefix = '#### Scenario: ';
  if (!trimmed.startsWith(prefix)) {
    return undefined;
  }
  const name = trimmed.slice(prefix.length);
  if (name === '') {
    return undefined;
  }
  return name;
}

function lineBody(row: SpecRow): ReactNode {
  const bits = row.bits;
  if (bits === undefined) {
    return row.text;
  }
  return bits.map((bit, index) => {
    if (!bit.changed) {
      return <span key={index}>{bit.text}</span>;
    }
    return (
      <span className="bit" key={index}>
        {bit.text}
      </span>
    );
  });
}

function numberCell(value: number | undefined): ReactNode {
  if (value === undefined) {
    return <span className="num" />;
  }
  return <span className="num">{value}</span>;
}

function noteAnchor(row: SpecRow): {path: string; at: string; side: string} | undefined {
  const anchor = row.anchor;
  if (anchor === undefined) {
    return undefined;
  }
  return {path: anchor.path, at: String(anchor.line), side: 'right'};
}

function specIsPlain(rows: readonly SpecEntry[]): boolean {
  for (const entry of rows) {
    if (entry.kind === 'gap') {
      if (entry.hidden.some(row => row.kind !== 'ctx')) {
        return false;
      }
      continue;
    }
    if (entry.kind !== 'ctx') {
      return false;
    }
  }
  return true;
}

function DiffRow({
  row,
  pull,
  drafts,
  keyName,
  blocks,
  plain = false,
}: {
  row: SpecRow;
  pull: boolean;
  drafts: readonly LineDraft[];
  keyName: string;
  blocks: readonly SidebarBlock[];
  plain?: boolean;
}): ReactNode {
  const scene = scenarioOf(row.text);
  const anchor = noteAnchor(row);
  const showButton = pull && row.text.trim() !== '';
  const draft = drafts.find(item => item.line === row.text);
  const body = lineBody(row);
  const note =
    showButton && draft !== undefined ? (
      <LineNote
        keyName={keyName}
        line={draft.line}
        question={draft.question}
        text={draft.text}
        path={anchor?.path}
        at={anchor?.at}
        side={anchor?.side}
      />
    ) : null;
  const numbers = plain ? (
    numberCell(row.right ?? row.left)
  ) : (
    <>
      {numberCell(row.left)}
      {numberCell(row.right)}
    </>
  );
  const rowClass = `diff-row${plain ? ' plain' : ''} ${row.kind}`;
  if (!showButton) {
    return (
      <div className={rowClass}>
        {numbers}
        <div className="diff-text">
          <span className="line" data-scenario={scene}>
            {body}
          </span>
        </div>
      </div>
    );
  }
  const pressed = draft === undefined ? rowClass : `${rowClass} is-on`;
  return (
    <>
      <button
        type="button"
        className={pressed}
        data-line={row.text}
        data-path={anchor?.path}
        data-at={anchor?.at}
        data-side={anchor?.side}
        data-scenario={scene}
      >
        {numbers}
        <span className="diff-text">{body}</span>
      </button>
      {note}
      {anchor === undefined ? null : (
        <PostedComments
          comments={commentsOnLine(blocks, anchor.path, Number(anchor.at))}
        />
      )}
    </>
  );
}

function SpecRows({
  id,
  rows,
  pull,
  gaps,
  drafts,
  keyName,
  blocks,
}: {
  id: string;
  rows: readonly SpecEntry[];
  pull: boolean;
  gaps: readonly OpenFold[];
  drafts: readonly LineDraft[];
  keyName: string;
  blocks: readonly SidebarBlock[];
}): ReactNode {
  const open = gaps.find(item => item.id === id)?.open ?? [];
  const plain = specIsPlain(rows);
  return rows.map((entry, index) => {
    if (entry.kind !== 'gap') {
      return (
        <DiffRow
          key={index}
          row={entry}
          pull={pull}
          drafts={drafts}
          keyName={keyName}
          blocks={blocks}
          plain={plain}
        />
      );
    }
    const shown = open.includes(index);
    return (
      <Fragment key={index}>
        <button type="button" className="fold-bar" data-cap={id} data-gap={index}>
          {unchangedLabel(entry.count)}
        </button>
        {shown
          ? entry.hidden.map((row, hiddenIndex) => (
              <DiffRow
                key={`${index}-${hiddenIndex}`}
                row={row}
                pull={pull}
                drafts={drafts}
                keyName={keyName}
                blocks={blocks}
                plain={plain}
              />
            ))
          : null}
      </Fragment>
    );
  });
}

export type DocumentRemark = {
  Plan: string;
  Specify: string;
  Design: string;
};

export function Sidebar({
  snapshot,
  layer,
  drafts = [],
  remark = {Plan: '', Specify: '', Design: ''},
  gaps = [],
  openCaps = [],
  specOpen = [],
  busy,
  focusPageIndex = 0,
}: {
  snapshot: WindowSnapshot;
  layer: SpineLayer | '' | undefined;
  drafts?: readonly LineDraft[];
  remark?: DocumentRemark;
  gaps?: readonly OpenFold[];
  openCaps?: readonly string[];
  specOpen?: readonly SpecOpen[];
  busy?: boolean;
  focusPageIndex?: number;
}): ReactNode {
  const opened = snapshot.opened;
  if (!opened) {
    return null;
  }
  const row = snapshot.rows.find(item => item.key === opened.key);
  if (!row) {
    return null;
  }
  const model = opened.spine;
  const places = snapshot.reviewPlaces;
  const open = layer ?? model.open;
  const gate = (name: SpineLayer, station: GateStation): ReactNode =>
    name === 'Plan' || name === 'Specify' || name === 'Design' || name === 'Accept' ? (
      <Gate row={row} name={station} side />
    ) : null;
  const hereControl = (
    name: SpineLayer,
    station: GateStation,
    act: 'accept' | 'gate' | 'none',
  ): ReactNode => {
    if (act === 'accept') {
      return (
        <ActForm act="accept-review" className="accept">
          <Hidden name="key" value={row.key} />
          <button className="cmd" type="submit" aria-label={`Принять ${name}`}>
            Принять
          </button>
        </ActForm>
      );
    }
    if (act === 'none') {
      return null;
    }
    return gate(name, station);
  };
  const specifyAct = opened.layers.find(item => item.layer === 'Specify')?.act ?? 'none';
  const planAct = opened.layers.find(item => item.layer === 'Plan')?.act ?? 'none';
  const designAct = opened.layers.find(item => item.layer === 'Design')?.act ?? 'none';
  const acceptAct = opened.layers.find(item => item.layer === 'Accept')?.act ?? 'gate';
  const unanswered = opened.blocks.some(block => block.kind === 'unanswered');
  const hook = opened.blocks.some(block => block.kind === 'hook');
  const quiet = (name: SpineLayer): boolean => !layerHasFold(name, model, {unanswered, hook});
  const acceptAutoMergeCaption =
    model.accept === 'На приёмке машина мержит сама.' ||
    model.accept === 'На приёмке мерж ждёт человека.';
  const acceptNote = model.accept.startsWith('На приёмке машина')
    ? 'Метка sdd:auto-merge стоит. Машина мержит сама, когда проверки зелёные.'
    : 'Метки sdd:auto-merge нет. Машина мержит только с этой меткой.';
  return (
    <aside className="sidebar" data-key={opened.key}>
      <BusyEdge on={busy ?? false} />
      <header>
        <div>
          <p className="name">
            {row.issue ? (
              <a className="key" href={row.issue}>
                #{opened.key}
              </a>
            ) : (
              <span className="key">#{opened.key}</span>
            )}
            <span className="full">: {opened.title}</span>
            {row.pull ? (
              <span className="pull">
                {' '}
                (PR: <a href={row.pull.href}>#{row.pull.id}</a>)
              </span>
            ) : null}
          </p>
          {row.project ? (
            <a className="project" href={row.project.href}>
              {row.project.name}
            </a>
          ) : null}
          <LinkMarks marks={row.marks} rows={snapshot.rows} />
        </div>
        <ActForm act="close-card">
          <button className="x" type="submit" aria-label="Закрыть">
            <Cross />
          </button>
        </ActForm>
      </header>
      <div className="side-scroll">
        <FocusBlocks blocks={opened.blocks} pageIndex={focusPageIndex} />
        {opened.blocks
          .filter(block => block.kind === 'description')
          .map((block, index) =>
            block.kind === 'description' ? (
              <p className="issue-description" key={index}>
                {block.text}
              </p>
            ) : null,
          )}
        <Blocks blocks={opened.blocks} places={places} />
        {codeExtra(opened.blocks, places)}
        {snapshot.roles.length === 0 ? null : (
          <div className="verbs">
            {snapshot.roles.map(role => (
              <ActForm act="drag" key={role.name}>
                <Hidden name="name" value={role.name} />
                <Hidden name="key" value={row.key} />
                <button className="verb" type="submit">
                  <span>{role.name}</span>
                  <small>{role.outcome}</small>
                </button>
              </ActForm>
            ))}
          </div>
        )}
        <div className="spine">
          <SpineRow
            layer="Plan"
            model={model}
            open={open === 'Plan'}
            quiet={quiet('Plan')}
            sentenceNode={
              model.proposal.excerpt === '' ? sentence(model, 'Plan', places) : undefined
            }
            excerpt={model.proposal.excerpt}
            control={hereControl('Plan', 'proposing', planAct)}
          >
            {model.proposal.present ? (
              <PlanDocument
                model={model}
                keyName={row.key}
                drafts={drafts}
                blocks={opened.blocks}
              />
            ) : null}
            {reviewFold(
              model,
              row.key,
              'proposed',
              model.proposal.present,
              remark.Plan,
              'Plan',
              opened.blocks,
            )}
          </SpineRow>
          <SpineRow
            layer="Specify"
            model={model}
            open={open === 'Specify'}
            quiet={quiet('Specify')}
            sentenceNode={sentence(model, 'Specify', places)}
            control={hereControl('Specify', 'specifying', specifyAct)}
          >
            {model.capabilities.map((item, index) => (
              <details
                className="cap"
                id={`cap-${item.id}`}
                open={capIsOpen(item.id, index, specOpen, openCaps)}
                key={item.id}
              >
                <summary>
                  {item.id}
                  {item.badge === undefined ? null : <span className="badge">{item.badge}</span>}
                </summary>
                <SpecRows
                  id={item.id}
                  rows={item.rows}
                  pull={model.pull}
                  gaps={gaps}
                  drafts={drafts}
                  keyName={row.key}
                  blocks={opened.blocks}
                />
              </details>
            ))}
            {reviewFold(
              model,
              row.key,
              'specified',
              model.capabilities.length > 0,
              remark.Specify,
              'Specify',
              opened.blocks,
            )}
          </SpineRow>
          <SpineRow
            layer="Design"
            model={model}
            open={open === 'Design'}
            quiet={quiet('Design')}
            sentenceNode={sentence(model, 'Design', places)}
            control={hereControl('Design', 'designing', designAct)}
          >
            {model.design.present ? (
              <DesignDocument
                model={model}
                keyName={row.key}
                drafts={drafts}
                blocks={opened.blocks}
              />
            ) : null}
            {reviewFold(
              model,
              row.key,
              'designed',
              model.design.present,
              remark.Design,
              'Design',
              opened.blocks,
            )}
          </SpineRow>
          <SpineRow
            layer="Tasks"
            model={model}
            open={open === 'Tasks'}
            quiet={quiet('Tasks')}
            sentenceNode={tasksSummary(model, places)}
          >
            <PostedPhaseComments entries={phaseComments(opened.blocks, model, 'Tasks')} />
            {model.tasks.map(task => (
              <details className="task" key={task.id}>
                <summary>
                  {task.id}{' '}
                  <span className={task.done ? 'state done' : 'state'}>
                    {task.done ? 'готово' : 'открыто'}
                  </span>
                </summary>
                {task.scenarios.map(scene => (
                  <button
                    type="button"
                    className="jump"
                    data-cap={scene.capability === '' ? undefined : scene.capability}
                    key={scene.name}
                  >
                    {scene.name}
                  </button>
                ))}
                <TaskFile
                  task={task}
                  pull={model.pull}
                  root={model.readPath}
                  blocks={opened.blocks}
                />
              </details>
            ))}
          </SpineRow>
          <SpineRow
            layer="Code"
            model={model}
            open={open === 'Code'}
            quiet={quiet('Code')}
            sentenceNode={sentence(model, 'Code', places)}
          >
            <PostedPhaseComments entries={phaseComments(opened.blocks, model, 'Code')} />
            {model.checks === undefined ? null : (
              <p
                className={
                  model.checks === 'проверки красные'
                    ? 'wait'
                    : model.checks === 'обязательные проверки зелёные'
                      ? 'ok'
                      : model.checks === 'проверок нет'
                        ? 'none'
                        : undefined
                }
              >
                {model.checks}
              </p>
            )}
            {model.diff ? <p>Diff есть</p> : null}
            {model.rest.map(line => (
              <p key={line}>{codeLine(line, places)}</p>
            ))}
            {model.pull && !unanswered ? <p>Открытых тредов нет.</p> : null}
          </SpineRow>
          <SpineRow
            layer="Accept"
            model={model}
            open={open === 'Accept'}
            quiet={quiet('Accept')}
            sentenceNode={<span className="sentence">{model.accept}</span>}
            control={hereControl('Accept', 'accepting', acceptAct)}
          >
            {acceptAutoMergeCaption ? <p>{acceptNote}</p> : null}
          </SpineRow>
        </div>
      </div>
    </aside>
  );
}
