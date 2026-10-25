import type {ReactNode} from 'react';

import type {Spine, SpineLayer} from '../spine.ts';
import type {GateStation, SidebarBlock} from '../types.ts';
import type {SnapshotRow, WindowSnapshot} from '../snapshot.ts';

import {Gate} from './board.tsx';
import type {LineDraft} from './gesture.ts';
import {ActForm, Hidden} from './forms.tsx';
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
    const token =
      url === undefined || url === '' ? core : <a href={url}>{core}</a>;
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

function sentence(model: Spine, layer: Exclude<SpineLayer, 'Accept'>, places: Record<string, string>): ReactNode {
  const own = model.lines.filter(line => line.layer === layer);
  if (own.length === 0) {
    return null;
  }
  const nodes: ReactNode[] = [];
  own.forEach((line, index) => {
    if (index > 0) {
      nodes.push(<br key={`br-${index}`} />);
    }
    nodes.push(line.layer === 'Code' ? <span key={index}>{codeLine(line.raw, places)}</span> : line.text);
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
  const preview = excerpt === undefined || excerpt === '' ? null : <span className="excerpt">{excerpt}</span>;
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

function Remark({keyName}: {keyName: string}): ReactNode {
  return (
    <ActForm act="answer" className="note">
      <Hidden name="key" value={keyName} />
      <label className="draft">
        Комментарий
        <textarea name="reply" rows={2} placeholder="Замечание ко всему документу" />
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
}: {
  keyName: string;
  line: string;
  question: string;
  text: string;
}): ReactNode {
  return (
    <ActForm act="answer" className="line-note">
      <Hidden name="key" value={keyName} />
      <Hidden name="line" value={line} />
      <Hidden name="question" value={question} />
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

function partsOf(lines: readonly string[]): {heading: string; lines: string[]}[] {
  const parts: {heading: string; lines: string[]}[] = [{heading: '', lines: []}];
  for (const line of lines) {
    const sub = /^###\s+(.+)$/.exec(line.trim());
    if (sub?.[1]) {
      parts.push({heading: sub[1], lines: []});
      continue;
    }
    parts.at(-1)?.lines.push(line);
  }
  return parts.filter(part => part.lines.some(item => item.trim() !== ''));
}

function PlanLines({
  lines,
  pull,
  questions,
  drafts,
  keyName,
}: {
  lines: readonly string[];
  pull: boolean;
  questions: Spine['proposal']['questions'];
  drafts: readonly LineDraft[];
  keyName: string;
}): ReactNode {
  let gap = false;
  const out: ReactNode[] = [];
  lines.forEach((line, index) => {
    if (line.trim() === '') {
      if (!gap) {
        out.push(<span className="gap" key={`gap-${index}`} />);
      }
      gap = true;
      return;
    }
    gap = false;
    const trimmed = line.trim();
    const question = pull ? questions.find(item => item.open && trimmed === `- [ ] ${item.text}`) : undefined;
    if (!pull) {
      out.push(
        <p className="line" key={index}>
          {line.trimEnd()}
        </p>,
      );
      return;
    }
    const draft = drafts.find(item => item.line === line.trimEnd());
    out.push(
      <span key={index}>
        <button
          type="button"
          className={draft ? 'line is-on' : 'line'}
          data-line={line.trimEnd()}
          data-question={question?.text}
        >
          {line.trimEnd()}
        </button>
        {draft ? (
          <LineNote keyName={keyName} line={draft.line} question={draft.question} text={draft.text} />
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
      if (!lines.some(line => line.trim() !== '')) {
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

function reviewFold(model: Spine, keyName: string, gate: NonNullable<Spine['reviewGate']>, shown: boolean): ReactNode {
  if (!model.pull) {
    return null;
  }
  if (!shown && model.reviewGate !== gate) {
    return null;
  }
  return (
    <div className="plan-foot">
      <Remark keyName={keyName} />
    </div>
  );
}

function Blocks({blocks, places}: {blocks: readonly SidebarBlock[]; places: Record<string, string>}): ReactNode {
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

export function Sidebar({
  snapshot,
  layer,
  drafts = [],
}: {
  snapshot: WindowSnapshot;
  layer: SpineLayer | undefined;
  drafts?: readonly LineDraft[];
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
  const hereControl = (name: SpineLayer, station: GateStation, act: 'accept' | 'gate' | 'none'): ReactNode => {
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
      <header>
        <div>
          <p className="kicker">{opened.key}</p>
          <p className="full">{opened.title}</p>
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
          <SpineRow layer="Change" model={model} open={open === 'Change'} sentenceNode={sentence(model, 'Change', places)}>
            <p>Двери читают {model.readPath}.</p>
          </SpineRow>
          <SpineRow
            layer="Plan"
            model={model}
            open={open === 'Plan'}
            sentenceNode={model.proposal.excerpt === '' ? sentence(model, 'Plan', places) : undefined}
            excerpt={model.proposal.excerpt}
            control={hereControl('Plan', 'proposing', planAct)}
          >
            {model.proposal.present ? <PlanDocument model={model} keyName={row.key} drafts={drafts} /> : null}
            {reviewFold(model, row.key, 'proposed', model.proposal.present)}
          </SpineRow>
          <SpineRow
            layer="Specify"
            model={model}
            open={open === 'Specify'}
            sentenceNode={sentence(model, 'Specify', places)}
            control={hereControl('Specify', 'specifying', specifyAct)}
          >
            {model.capabilities.map((item, index) => (
              <details className="cap" id={`cap-${item.id}`} open={index === 0} key={item.id}>
                <summary>{item.id}</summary>
                {item.requirements.map(req => (
                  <div key={req.title}>
                    <p className="crumb">{req.kind}</p>
                    <h3>{req.title}</h3>
                    {req.prose === '' ? null : <p>{req.prose}</p>}
                    {req.added.map(added => (
                      <p className="mark" key={added}>
                        <b>добавлено</b> {added}
                      </p>
                    ))}
                    {req.scenarios.map(scene => (
                      <div key={scene.name}>
                        <p className="scene-name">{scene.name}</p>
                        {scene.when === '' ? null : (
                          <p className="scene">
                            <b>WHEN</b> {scene.when}
                          </p>
                        )}
                        {scene.then === '' ? null : (
                          <p className="scene">
                            <b>THEN</b> {scene.then}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </details>
            ))}
            {reviewFold(model, row.key, 'specified', model.capabilities.length > 0)}
          </SpineRow>
          <SpineRow
            layer="Design"
            model={model}
            open={open === 'Design'}
            sentenceNode={sentence(model, 'Design', places)}
            control={hereControl('Design', 'designing', designAct)}
          >
            {model.design.present ? (
              <>
                {model.design.boundary === '' ? null : (
                  <>
                    <h3>Verification boundary</h3>
                    <p>{model.design.boundary}</p>
                  </>
                )}
                {model.design.approach === '' ? null : (
                  <>
                    <h3>Approach</h3>
                    <p>{model.design.approach}</p>
                  </>
                )}
                {model.design.rejected.map(line => (
                  <p key={line}>{line}</p>
                ))}
                {model.design.decisions === '' ? null : (
                  <>
                    <h3>Open decisions</h3>
                    <p>{model.design.decisions}</p>
                  </>
                )}
              </>
            ) : null}
            {reviewFold(model, row.key, 'designed', model.design.present)}
          </SpineRow>
          <SpineRow layer="Tasks" model={model} open={open === 'Tasks'} sentenceNode={sentence(model, 'Tasks', places)}>
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
          <SpineRow layer="Code" model={model} open={open === 'Code'} sentenceNode={sentence(model, 'Code', places)}>
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
