import type {ReactNode} from 'react';

import type {WindowSnapshot} from '../snapshot.ts';
import {FACTORY_AGENTS, ROLE_OUTCOMES, type SkillMode} from '../types.ts';

import {BusyEdge} from './busy.tsx';
import {ActForm, Hidden} from './forms.tsx';
import {Cross, Hairline, Pill} from './marks.tsx';

const FIELD_LABELS = ['sdd:auto-plan', 'sdd:auto-spec', 'sdd:auto-design'] as const;

function options(values: readonly string[], current: string, blank = false): ReactNode {
  const items = blank ? ['', ...values] : [...values];
  return items.map(value => (
    <option key={value === '' ? 'blank' : value} value={value}>
      {value}
    </option>
  ));
}

function ModeFields({
  modelAct,
  effortAct,
  speedAct,
  models,
  effort,
  effortWords,
  speed,
  speedWords,
}: {
  modelAct: string;
  effortAct: string;
  speedAct: string;
  models: WindowSnapshot['settings']['models'];
  effort?: {mechanical: string; judgment: string};
  effortWords?: readonly string[];
  speed?: {mechanical: string; judgment: string};
  speedWords?: readonly string[];
}): ReactNode {
  const model = (mode: SkillMode, field: {value: string; needsValue: boolean}) => (
    <ActForm act={modelAct} key={mode} onChangeSubmit>
      <label className={field.needsValue ? 'warn' : undefined}>
        {mode}
        {field.needsValue ? <span className="note">нужна модель</span> : null}
      </label>
      <Hidden name="mode" value={mode} />
      <input name="value" defaultValue={field.value} />
    </ActForm>
  );
  const word = (fieldAct: string, mode: SkillMode, current: string, words: readonly string[]) => (
    <ActForm act={fieldAct} key={`${fieldAct}-${mode}`} onChangeSubmit>
      <label>
        {fieldAct.endsWith('speed') ? 'скорость' : 'усилие'} {mode}
      </label>
      <Hidden name="mode" value={mode} />
      <select name="value" defaultValue={current}>
        {options(words, current, true)}
      </select>
    </ActForm>
  );
  return (
    <>
      {model('mechanical', models.mechanical)}
      {model('judgment', models.judgment)}
      {effort && effortWords ? (
        <>
          {word(effortAct, 'mechanical', effort.mechanical, effortWords)}
          {word(effortAct, 'judgment', effort.judgment, effortWords)}
        </>
      ) : null}
      {speed && speedWords ? (
        <>
          {word(speedAct, 'mechanical', speed.mechanical, speedWords)}
          {word(speedAct, 'judgment', speed.judgment, speedWords)}
        </>
      ) : null}
    </>
  );
}

function unwritable(group: WindowSnapshot['serviceConfig']): boolean {
  if (group.queues?.warning === true) {
    return true;
  }
  if (group.queues?.items.some(item => item.warning === true) === true) {
    return true;
  }
  return group.ignoreComments?.some(item => item.warning === true) === true;
}

export function Settings({snapshot, busy}: {snapshot: WindowSnapshot; busy?: boolean}): ReactNode {
  if (!snapshot.settings.open) {
    return null;
  }
  const settings = snapshot.settings;
  const service = snapshot.serviceConfig;
  const overlay = snapshot.overlay;
  const dirty = snapshot.serviceDirty;
  const canSave = dirty && service.save && !unwritable(service);
  const choices = service.hookChoices ?? [];
  return (
    <div className="veil">
      <div className="sheet" role="dialog" aria-label="Настройки">
        <BusyEdge on={busy ?? false} />
        <div className="sheet-body">
          <header>
            <h2>Настройки</h2>
            <ActForm act="close-settings">
              <button className="x" type="submit" aria-label={dirty ? 'Закрыть без записи' : 'Закрыть'}>
                <Cross />
              </button>
            </ActForm>
          </header>
          <div className="blocks">
            <section className="group">
              <h3>Дом</h3>
              <ActForm act="choose-agent" onChangeSubmit>
                <label>агент</label>
                <select name="agent" defaultValue={settings.agent}>
                  {options(FACTORY_AGENTS, settings.agent, true)}
                </select>
              </ActForm>
              <ModeFields
                modelAct="leave-model"
                effortAct="leave-effort"
                speedAct="leave-speed"
                models={settings.models}
                effort={settings.effort}
                effortWords={settings.effortWords}
                speed={settings.speed}
                speedWords={settings.speedWords}
              />
              <ActForm act="leave-watch" onChangeSubmit>
                <label>список наблюдения</label>
                <textarea name="names" defaultValue={settings.watch.join('\n')} />
              </ActForm>
              <ActForm act="leave-roots" className="pair">
                <label>arcadia</label>
                <input name="arcadia" defaultValue={settings.roots.arcadia} />
                <label>github</label>
                <input name="github" defaultValue={settings.roots.github} />
              </ActForm>
              <div className="roles">
                <h3>Роли</h3>
                {settings.roles.map(role => (
                  <div className="role" key={role.name}>
                    <ActForm act="rename-role" onChangeSubmit>
                      <Hidden name="name" value={role.name} />
                      <label>имя</label>
                      <input name="next" defaultValue={role.name} />
                    </ActForm>
                    <ActForm act="choose-role-outcome" onChangeSubmit>
                      <Hidden name="name" value={role.name} />
                      <label>исход</label>
                      <select name="outcome" defaultValue={role.outcome}>
                        {options(ROLE_OUTCOMES, role.outcome)}
                      </select>
                    </ActForm>
                    <ActForm act="set-role-text" onChangeSubmit>
                      <Hidden name="name" value={role.name} />
                      <label>текст</label>
                      <textarea name="text" defaultValue={role.text} />
                    </ActForm>
                    {role.outcome === 'ticket-fields' ? (
                      <ActForm act="set-role-labels" onChangeSubmit>
                        <Hidden name="name" value={role.name} />
                        <fieldset>
                          <legend>метки</legend>
                          {FIELD_LABELS.map(label => (
                            <label className="check" key={label}>
                              <input
                                type="checkbox"
                                name="labels"
                                value={label}
                                defaultChecked={role.labels?.includes(label) === true}
                              />
                              {label}
                            </label>
                          ))}
                        </fieldset>
                      </ActForm>
                    ) : null}
                    <ActForm act="remove-role">
                      <Hidden name="name" value={role.name} />
                      <Hairline label="Удалить" />
                    </ActForm>
                  </div>
                ))}
                <ActForm act="add-role" className="add" onChangeSubmit>
                  <label>новая роль</label>
                  <input name="name" placeholder="имя" />
                  <select name="outcome" defaultValue="html">
                    {options(ROLE_OUTCOMES, 'html')}
                  </select>
                  <textarea name="text" placeholder="текст" />
                  <Pill label="Добавить" />
                </ActForm>
              </div>
            </section>
            <div className="stack">
              {overlay.checkout === '' ? (
                <section className="group">
                  <h3>{overlay.file}</h3>
                  <p className="empty">Чекаут ещё не выбран.</p>
                  {snapshot.checkouts.map(checkout => (
                    <ActForm act="choose-checkout" key={checkout}>
                      <Hidden name="checkout" value={checkout} />
                      <Hairline label={checkout} />
                    </ActForm>
                  ))}
                </section>
              ) : (
                <section className="group">
                  <h3>{overlay.file}</h3>
                  <p className="path">{overlay.checkout}</p>
                  <ActForm act="choose-overlay-agent" onChangeSubmit>
                    <label>агент слоя</label>
                    <select name="agent" defaultValue={overlay.agent}>
                      {options(FACTORY_AGENTS, overlay.agent, true)}
                    </select>
                  </ActForm>
                  <ModeFields
                    modelAct="leave-overlay-model"
                    effortAct="leave-overlay-effort"
                    speedAct="leave-overlay-speed"
                    models={overlay.models}
                    effort={overlay.effort}
                    effortWords={overlay.effortWords}
                    speed={overlay.speed}
                    speedWords={overlay.speedWords}
                  />
                  <ActForm act="leave-overlay-watch" onChangeSubmit>
                    <label>watch слоя</label>
                    <textarea name="names" defaultValue={overlay.watch.join('\n')} />
                  </ActForm>
                </section>
              )}
              <ServiceGroup snapshot={snapshot} canSave={canSave} choices={choices} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceGroup({
  snapshot,
  canSave,
  choices,
}: {
  snapshot: WindowSnapshot;
  canSave: boolean;
  choices: readonly {action: string; point: string}[];
}): ReactNode {
  const group = snapshot.serviceConfig;
  const head = (
    <>
      <h3>{group.file}</h3>
      {group.checkout === '' ? null : <p className="path">{group.checkout}</p>}
    </>
  );
  if (group.line) {
    return (
      <section className="group">
        {head}
        <p className="warn">{group.line}</p>
      </section>
    );
  }
  if (group.queues === undefined || group.checkout === '') {
    return (
      <section className="group">
        {head}
        <p className="empty">Группа пуста, пока не выбран чекаут.</p>
      </section>
    );
  }
  const items = group.queues.items;
  return (
    <section className="group">
      {head}
      <h4>очереди</h4>
      {items.map((_, index) => (
        <span key={`shell-${index}`}>
          <ActForm act="move-service-queue" className="shell" id={`up-${index}`}>
            <Hidden name="from" value={String(index)} />
            <Hidden name="to" value={String(index - 1)} />
          </ActForm>
          <ActForm act="move-service-queue" className="shell" id={`down-${index}`}>
            <Hidden name="from" value={String(index)} />
            <Hidden name="to" value={String(index + 1)} />
          </ActForm>
          <ActForm act="remove-service-queue" className="shell" id={`remove-${index}`}>
            <Hidden name="index" value={String(index)} />
          </ActForm>
        </span>
      ))}
      <form className="queue-edit pair" method="post" action="/act" id="queue-edit">
        <Hidden name="act" value="set-service-queue" />
        {items.map((item, index) => (
          <div className={item.warning ? 'row warn' : 'row'} key={item.name}>
            <input name="name" defaultValue={item.name} />
            <input name="description" defaultValue={item.description} />
            <Hairline label="↑" disabled={index === 0} form={`up-${index}`} />
            <Hairline label="↓" disabled={index === items.length - 1} form={`down-${index}`} />
            <Hairline label="×" form={`remove-${index}`} />
          </div>
        ))}
        {choices.length === 0 ? null : (
          <>
            <select name="choice" defaultValue={`${choices[0]?.action}\t${choices[0]?.point}`}>
              {choices.map(choice => (
                <option key={`${choice.action}-${choice.point}`} value={`${choice.action}\t${choice.point}`}>
                  {choice.action} · {choice.point}
                </option>
              ))}
            </select>
            <input name="first" placeholder="первый абзац" />
            <Hairline label="Добавить хук" />
          </>
        )}
      </form>
      <ActForm act="add-service-queue">
        <Hairline label="Очередь" />
      </ActForm>
      <ActForm act="set-service-base" onChangeSubmit>
        <label>base</label>
        <input name="value" defaultValue={group.base ?? ''} />
      </ActForm>
      <ActForm act="set-service-branch" onChangeSubmit>
        <label>branch scope</label>
        <input name="value" defaultValue={group.branchScope ?? ''} />
      </ActForm>
      <h4>ignore-comments</h4>
      {(group.ignoreComments ?? []).map((item, index) => (
        <div className={item.warning ? 'row warn' : 'row'} key={`${item.value}-${index}`}>
          <ActForm act="set-service-ignore" onChangeSubmit>
            <Hidden name="index" value={String(index)} />
            <input name="value" defaultValue={item.value} readOnly={item.removeOnly === true} />
          </ActForm>
          <ActForm act="remove-service-ignore">
            <Hidden name="index" value={String(index)} />
            <Hairline label="×" />
          </ActForm>
        </div>
      ))}
      <ActForm act="add-service-ignore">
        <input name="value" placeholder="строка" />
        <Hairline label="Добавить" />
      </ActForm>
      <h4>хуки</h4>
      {(group.hooks ?? []).map(hook => (
        <ActForm act="set-service-hook" key={`${hook.action}-${hook.point}`} onChangeSubmit>
          <Hidden name="hook-action" value={hook.action} />
          <Hidden name="point" value={hook.point} />
          <label>
            {hook.action} · {hook.point}
          </label>
          {hook.values.map((value, index) => (
            <textarea name="values" key={index} defaultValue={value} />
          ))}
        </ActForm>
      ))}
      {snapshot.serviceDirty ? <p>сервис не записан</p> : null}
      {unwritable(group) ? <p>правку нельзя записать</p> : null}
      <ActForm act="save-service">
        <Pill label="Записать сервис" disabled={!canSave} />
      </ActForm>
    </section>
  );
}
