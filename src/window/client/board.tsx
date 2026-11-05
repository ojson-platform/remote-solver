import type {ReactNode} from 'react';

import type {ColumnName, GateStation, LinkMark, PhaseRow} from '../types.ts';
import {COLUMN_NAMES, isGateStation} from '../types.ts';
import type {SnapshotRow} from '../snapshot.ts';

import {ActForm, Hidden} from './forms.tsx';
import {Glyph, HammerMark, Wizard} from './marks.tsx';

function phaseStat(row: PhaseRow): ReactNode {
  if (typeof row === 'number') {
    return <div className="stat">{row}</div>;
  }
  if (typeof row === 'string') {
    return <div className={`stat ${row}`}>{row}</div>;
  }
  if ('waits' in row) {
    return <div className="stat">{`Waits for ${row.waits.join(', ')}`}</div>;
  }
  return <div className="stat">{`Done ${row.done}/${row.done + row.open}`}</div>;
}

function linkMarkTitle(rows: readonly SnapshotRow[], key: string): string | undefined {
  return rows.find(row => row.key === key)?.title;
}

export function LinkMarks({
  marks,
  rows,
}: {
  marks: readonly LinkMark[] | undefined;
  rows: readonly SnapshotRow[];
}): ReactNode {
  if (marks === undefined || marks.length === 0) {
    return null;
  }
  return (
    <ul className="link-marks">
      {marks.map(mark => {
        const title = linkMarkTitle(rows, mark.key);
        return (
          <li className="link-mark" data-kind={mark.kind} key={`${mark.kind}-${mark.key}`}>
            <ActForm act="open" className="open link-mark-open">
              <Hidden name="key" value={mark.key} />
              <button className="link-mark-key" type="submit" title={title}>
                {mark.key}
              </button>
            </ActForm>
          </li>
        );
      })}
    </ul>
  );
}

function phaseText(row: PhaseRow): string {
  if (typeof row === 'number' || typeof row === 'string') {
    return String(row);
  }
  if ('waits' in row) {
    return `Waits for ${row.waits.join(', ')}`;
  }
  return `Done ${row.done}/${row.done + row.open}`;
}

function Plaque({row}: {row: SnapshotRow}): ReactNode {
  const lines = row.plaque;
  const top =
    lines.top === undefined ? null : (
      <span className={lines.top === 'red' ? 'kicker red' : 'kicker'}>{lines.top}</span>
    );
  const bottomIsPhase =
    lines.bottom !== undefined && row.phaseRow !== undefined && lines.bottom === phaseText(row.phaseRow);
  let bottom: ReactNode = null;
  if (lines.bottom !== undefined) {
    bottom = bottomIsPhase ? phaseStat(row.phaseRow as PhaseRow) : <span className="reason">{lines.bottom}</span>;
  }
  const body = top === null && bottom === null ? <span className="reason">&nbsp;</span> : <>{top}{bottom}</>;
  return (
    <ActForm act="open" className="open">
      <Hidden name="key" value={row.key} />
      <button className="plaque" type="submit">
        {row.running === true ? <HammerMark /> : null}
        {body}
      </button>
    </ActForm>
  );
}

function Door({row, name}: {row: SnapshotRow; name: ColumnName}): ReactNode {
  const door = row.doors?.[name];
  if (!door) {
    return null;
  }
  const className = door.bad === true ? 'big bad' : 'big';
  const body = (
    <>
      <Glyph name={door.kind} />
      {door.dot === true ? <span className="pip" aria-hidden="true" /> : null}
    </>
  );
  if (door.many === true) {
    return (
      <ActForm act="open" className="open">
        <Hidden name="key" value={row.key} />
        <button className={className} type="submit" aria-label={door.kind}>
          {body}
        </button>
      </ActForm>
    );
  }
  if (door.href === undefined) {
    return (
      <button className={className} type="button" aria-label={door.kind}>
        {body}
      </button>
    );
  }
  return (
    <a className={className} href={door.href} aria-label={door.kind}>
      {body}
    </a>
  );
}

function ahead(row: SnapshotRow, name: ColumnName): boolean {
  if (row.station === undefined) {
    return false;
  }
  return COLUMN_NAMES.indexOf(name) > COLUMN_NAMES.indexOf(row.station);
}

function Gate({row, name, side}: {row: SnapshotRow; name: GateStation; side: boolean}): ReactNode {
  const off = row.gateOff?.[name] === true;
  return (
    <form className="gate" data-gate={name} method="post" action="/act">
      <Hidden name="act" value="gate" />
      <Hidden name="key" value={row.key} />
      <Hidden name="station" value={name} />
      {side ? <Hidden name="where" value="side" /> : null}
      <button className={off ? 'tick' : 'stop'} type="submit" aria-label={`${off ? 'Поставить' : 'Снять'} гейт ${name}`}>
        {off ? null : <Wizard />}
      </button>
    </form>
  );
}

function Stations({row}: {row: SnapshotRow}): ReactNode {
  return COLUMN_NAMES.map(name => {
    let body: ReactNode;
    if (row.station === name) {
      body = <Plaque row={row} />;
    } else if (row.doors?.[name]) {
      body = <Door row={row} name={name} />;
    } else if (isGateStation(name) && (row.station === undefined || ahead(row, name))) {
      body = <Gate row={row} name={name} side={false} />;
    } else {
      body = <span className="dot" aria-hidden="true" />;
    }
    return (
      <div className="station" data-station={name} key={name}>
        {body}
      </div>
    );
  });
}

function Corner({row}: {row: SnapshotRow}): ReactNode {
  if (row.alarm === true) {
    return (
      <div className="corner">
        <ActForm act="repair">
          <Hidden name="key" value={row.key} />
          <button className="round bang" type="submit" aria-label="Поломка">
            <Glyph name="bang" />
          </button>
        </ActForm>
      </div>
    );
  }
  return (
    <div className="corner">
      <form className="take" method="post" action="/take">
        <Hidden name="key" value={row.key} />
        <button
          className={row.takeDisabled === true ? 'round play off' : 'round play'}
          type="submit"
          disabled={row.takeDisabled === true}
          aria-label="Взять"
        >
          <Glyph name="play" />
        </button>
      </form>
    </div>
  );
}

export function Ticket({
  row,
  open,
  rows,
}: {
  row: SnapshotRow;
  open: boolean;
  rows: readonly SnapshotRow[];
}): ReactNode {
  const className = `ticket${row.pool ? ' pool' : ''}${open ? ' is-open' : ''}`;
  return (
    <article
      className={className}
      data-key={row.key}
      draggable={row.pool && row.takeDisabled !== true ? true : undefined}
    >
      <div className="stations">
        <div className={row.pool ? 'gutter pool' : 'gutter'}>
          <div className="ident">
            <div className="name">
              {row.issue ? (
                <a className="key" href={row.issue}>
                  #{row.key}
                </a>
              ) : (
                <span className="key">#{row.key}</span>
              )}
              <ActForm act="open" className="open">
                <Hidden name="key" value={row.key} />
                <button className="face" type="submit">
                  <h2 className="title">: {row.title}</h2>
                </button>
              </ActForm>
            </div>
            <LinkMarks marks={row.marks} rows={rows} />
          </div>
          {row.pool ? <Corner row={row} /> : null}
        </div>
        <Stations row={row} />
      </div>
    </article>
  );
}

export function Board({rows, opened}: {rows: readonly SnapshotRow[]; opened?: string}): ReactNode {
  const names = COLUMN_NAMES.map(name => (
    <span className="phase" key={name}>
      {name}
    </span>
  ));
  return (
    <div className="board-frame">
      <div className="head">
        <span />
        {names}
      </div>
      <main className="board">
        {rows.map(row => (
          <Ticket key={row.key} row={row} open={row.key === opened} rows={rows} />
        ))}
      </main>
    </div>
  );
}

export {Gate};
