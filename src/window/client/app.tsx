import type {ReactNode} from 'react';

import type {SpineLayer} from '../spine.ts';
import type {WindowSnapshot} from '../snapshot.ts';
import type {BusyEdges} from './frame.ts';
import type {LineDraft, OpenFold, SpecOpen} from './gesture.ts';

import {Board} from './board.tsx';
import {BusyEdge} from './busy.tsx';
import {ActForm, Hidden} from './forms.tsx';
import {Cross, Pill} from './marks.tsx';
import {Settings} from './settings.tsx';
import {Sidebar} from './sidebar.tsx';

function Repair({snapshot}: {snapshot: WindowSnapshot}): ReactNode {
  if (snapshot.repair === undefined) {
    return null;
  }
  const row = snapshot.rows.find(item => item.key === snapshot.repair);
  if (row?.alarm !== true) {
    return null;
  }
  const service = snapshot.service[row.key];
  let field: ReactNode = null;
  if (row.reason === 'не назван сервис' && row.choices.length >= 2) {
    field = (
      <ActForm act="choose-service" className="choice">
        <Hidden name="key" value={row.key} />
        <label>сервис</label>
        <select name="service" defaultValue={service ?? ''}>
          <option disabled>—</option>
          {row.choices.map(choice => (
            <option key={choice === '' ? 'root' : choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </ActForm>
    );
  } else if (row.reason === 'конфига сервиса нет') {
    field = (
      <ActForm act="plant-queue">
        <Hidden name="key" value={row.key} />
        <label>очередь</label>
        <input name="name" />
        <Pill label="Создать" />
      </ActForm>
    );
  }
  return (
    <div className="veil popup-veil">
      <div className="popup repair" role="dialog" aria-label="Поломка">
        <header>
          <h2>{row.reason ?? ''}</h2>
          <ActForm act="close-repair">
            <button className="x" type="submit" aria-label="Закрыть">
              <Cross />
            </button>
          </ActForm>
        </header>
        {field}
      </div>
    </div>
  );
}

function Ask({snapshot}: {snapshot: WindowSnapshot}): ReactNode {
  const ask = snapshot.ask;
  if (!ask) {
    return null;
  }
  return (
    <div className="veil popup-veil">
      <div className="popup ask" role="dialog" aria-label="Без контроля">
        <header>
          <h2>Без контроля</h2>
          <ActForm act="close-ask">
            <button className="x" type="submit" aria-label="Закрыть">
              <Cross />
            </button>
          </ActForm>
        </header>
        <p>Снять последний гейт? Тикет останется без контроля.</p>
        <ActForm act="gate">
          <Hidden name="key" value={ask.key} />
          <Hidden name="station" value={ask.station} />
          <Hidden name="sure" value="1" />
          {ask.side ? <Hidden name="where" value="side" /> : null}
          <Pill label="Снять" />
        </ActForm>
      </div>
    </div>
  );
}

function Popup({text}: {text: string | undefined}): ReactNode {
  if (text === undefined) {
    return null;
  }
  const html = text.trimStart().startsWith('<');
  return (
    <div className="veil popup-veil">
      <div className="popup" role="dialog" aria-label="Роль">
        <header>
          <h2>Роль</h2>
          <ActForm act="close-popup">
            <button className="x" type="submit" aria-label="Закрыть">
              <Cross />
            </button>
          </ActForm>
        </header>
        {html ? <iframe sandbox="" srcDoc={text} title="popup" /> : <pre>{text}</pre>}
      </div>
    </div>
  );
}

export function App({
  snapshot,
  layer,
  drafts = [],
  remark = '',
  gaps = [],
  openCaps = [],
  specOpen = [],
  busy,
}: {
  snapshot: WindowSnapshot;
  layer?: SpineLayer | '';
  drafts?: readonly LineDraft[];
  remark?: string;
  gaps?: readonly OpenFold[];
  openCaps?: readonly string[];
  specOpen?: readonly SpecOpen[];
  busy?: BusyEdges;
}): ReactNode {
  const lamp = snapshot.lamp ? (
    <p className="lamp on">шаги идут</p>
  ) : (
    <p className="lamp">шаги стоят</p>
  );
  return (
    <>
      <div className="app">
        <BusyEdge on={busy?.window ?? false} />
        <header className="top">
          <p className="word">ai-factory</p>
          {lamp}
          {snapshot.spy === '' ? null : <p className="spy">{snapshot.spy}</p>}
          <ActForm act="open-settings">
            <Pill label="Настройки" />
          </ActForm>
        </header>
        {snapshot.banners.length === 0 ? null : (
          <div className="banners">
            {snapshot.banners.map(banner => (
              <p key={banner.text}>{banner.text}</p>
            ))}
          </div>
        )}
        {snapshot.status === undefined ? null : (
          <p className="status" role="status">
            {snapshot.status}
          </p>
        )}
        <div className="stage">
          <Board rows={snapshot.rows} opened={snapshot.opened?.key} />
        </div>
      </div>
      <Sidebar
        snapshot={snapshot}
        layer={layer}
        drafts={drafts}
        remark={remark}
        gaps={gaps}
        openCaps={openCaps}
        specOpen={specOpen}
        busy={busy?.drawer}
      />
      <Settings snapshot={snapshot} busy={busy?.settings} />
      <Popup text={snapshot.popup} />
      <Repair snapshot={snapshot} />
      <Ask snapshot={snapshot} />
    </>
  );
}

export function WindowView({
  snapshot,
  css,
  layer,
}: {
  snapshot: WindowSnapshot;
  css: string;
  layer?: SpineLayer | '';
}): ReactNode {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ai-factory</title>
        <style>{css}</style>
      </head>
      <body data-show={snapshot.show}>
        <App snapshot={snapshot} layer={layer} />
      </body>
    </html>
  );
}
