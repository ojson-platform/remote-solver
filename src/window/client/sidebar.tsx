import type {ReactNode} from 'react';

import type {SpecEntry, SpecRow} from '../spec-diff.ts';
import type {Spine, SpineLayer, SpineSourceLine} from '../spine.ts';
import type {WindowSnapshot} from '../snapshot.ts';
import type {GateStation, SidebarBlock} from '../types.ts';
import type {LineDraft, OpenFold, SpecOpen} from './gesture.ts';

import {Fragment} from 'react';

import {unchangedLabel} from '../spec-diff.ts';

import {Gate} from './board.tsx';
import {BusyEdge} from './busy.tsx';
import {ActForm, Hidden} from './forms.tsx';
import {capIsOpen} from './gesture.ts';
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

function sentence(
  model: Spine,
  layer: Exclude<SpineLayer, 'Accept'>,
  places: Record<string, string>,
): ReactNode {
  const own = model.lines.filter(line => line.layer === layer);
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
  sentenceNode,
  excerpt,
  control,
  children,
}: {
  layer: SpineLayer;
  model: Spine;
  open: boolean;
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
  const rest =
    sentenceNode == null && preview == null ? null : (
      <label className="rest" htmlFor={`spine-${layer}`}>
        {sentenceNode}
        {preview}
      </label>
    );
  return (
    <section>
      <input
        className="spine-pick"
        type="checkbox"
        id={`spine-${layer}`}
        value={layer}
        checked={open}
        readOnly
      />
      <div className="row">
        <div className="lead">
          <label className="layer" htmlFor={`spine-${layer}`}>
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
}: {
  lines: readonly SpineSourceLine[];
  pull: boolean;
  questions: Spine['proposal']['questions'];
  drafts: readonly LineDraft[];
  keyName: string;
  file: 'proposal.md' | 'design.md';
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
    const path = `openspec/changes/issue-${keyName}/${file}`;
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
      </span>,
    );
  });
  return out;
}

function PlanDocument({
  model,
  keyName,
  drafts,
}: {
  model: Spine;
  keyName: string;
  drafts: readonly LineDraft[];
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
            file="proposal.md"
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
              file="proposal.md"
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

function DesignDocument({
  model,
  keyName,
  drafts,
}: {
  model: Spine;
  keyName: string;
  drafts: readonly LineDraft[];
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
            file="design.md"
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
              file="design.md"
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
): ReactNode {
  if (!model.pull) {
    return null;
  }
  if (!shown && model.reviewGate !== gate) {
    return null;
  }
  return (
    <div className="plan-foot">
      <Remark keyName={keyName} text={remark} />
    </div>
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

function DiffRow({
  row,
  pull,
  drafts,
  keyName,
}: {
  row: SpecRow;
  pull: boolean;
  drafts: readonly LineDraft[];
  keyName: string;
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
  if (!showButton) {
    return (
      <div className={`diff-row ${row.kind}`}>
        {numberCell(row.left)}
        {numberCell(row.right)}
        <div className="diff-text">
          <span className="line" data-scenario={scene}>
            {body}
          </span>
        </div>
      </div>
    );
  }
  const pressed = draft === undefined ? `diff-row ${row.kind}` : `diff-row is-on ${row.kind}`;
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
        {numberCell(row.left)}
        {numberCell(row.right)}
        <span className="diff-text">{body}</span>
      </button>
      {note}
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
}: {
  id: string;
  rows: readonly SpecEntry[];
  pull: boolean;
  gaps: readonly OpenFold[];
  drafts: readonly LineDraft[];
  keyName: string;
}): ReactNode {
  const open = gaps.find(item => item.id === id)?.open ?? [];
  return rows.map((entry, index) => {
    if (entry.kind !== 'gap') {
      return <DiffRow key={index} row={entry} pull={pull} drafts={drafts} keyName={keyName} />;
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
}: {
  snapshot: WindowSnapshot;
  layer: SpineLayer | '' | undefined;
  drafts?: readonly LineDraft[];
  remark?: DocumentRemark;
  gaps?: readonly OpenFold[];
  openCaps?: readonly string[];
  specOpen?: readonly SpecOpen[];
  busy?: boolean;
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
        </div>
        <ActForm act="close-card">
          <button className="x" type="submit" aria-label="Закрыть">
            <Cross />
          </button>
        </ActForm>
      </header>
      <div className="side-scroll">
        <Blocks blocks={opened.blocks} places={places} />
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
            sentenceNode={
              model.proposal.excerpt === '' ? sentence(model, 'Plan', places) : undefined
            }
            excerpt={model.proposal.excerpt}
            control={hereControl('Plan', 'proposing', planAct)}
          >
            {model.proposal.present ? (
              <PlanDocument model={model} keyName={row.key} drafts={drafts} />
            ) : null}
            {reviewFold(model, row.key, 'proposed', model.proposal.present, remark.Plan)}
          </SpineRow>
          <SpineRow
            layer="Specify"
            model={model}
            open={open === 'Specify'}
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
                />
              </details>
            ))}
            {reviewFold(model, row.key, 'specified', model.capabilities.length > 0, remark.Specify)}
          </SpineRow>
          <SpineRow
            layer="Design"
            model={model}
            open={open === 'Design'}
            sentenceNode={sentence(model, 'Design', places)}
            control={hereControl('Design', 'designing', designAct)}
          >
            {model.design.present ? (
              <DesignDocument model={model} keyName={row.key} drafts={drafts} />
            ) : null}
            {reviewFold(model, row.key, 'designed', model.design.present, remark.Design)}
          </SpineRow>
          <SpineRow
            layer="Tasks"
            model={model}
            open={open === 'Tasks'}
            sentenceNode={sentence(model, 'Tasks', places)}
          >
            {model.tasks.map(task => (
              <details className="task" key={task.id}>
                <summary>
                  {task.id} <span className="quiet">{task.done ? 'готово' : 'открыто'}</span>
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
              </details>
            ))}
          </SpineRow>
          <SpineRow
            layer="Code"
            model={model}
            open={open === 'Code'}
            sentenceNode={sentence(model, 'Code', places)}
          >
            {model.checks === undefined ? null : (
              <p
                className={
                  model.checks === 'проверки красные'
                    ? 'wait'
                    : model.checks === 'обязательные проверки зелёные'
                      ? 'ok'
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
            {codeExtra(opened.blocks, places)}
          </SpineRow>
          <SpineRow
            layer="Accept"
            model={model}
            open={open === 'Accept'}
            sentenceNode={<span className="sentence">{model.accept}</span>}
            control={hereControl('Accept', 'accepting', acceptAct)}
          >
            <p>{acceptNote}</p>
          </SpineRow>
        </div>
      </div>
    </aside>
  );
}
