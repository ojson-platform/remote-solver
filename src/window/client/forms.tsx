import type {FormEvent, ReactNode} from 'react';

export function postForm(form: HTMLFormElement): URLSearchParams {
  const body = new URLSearchParams();
  new FormData(form).forEach((value, name) => {
    if (typeof value === 'string') {
      body.append(name, value);
    }
  });
  return body;
}

/** Hidden fields, in the order the string page wrote them. */
export function Hidden({name, value}: {name: string; value: string}): ReactNode {
  return <input type="hidden" name={name} value={value} />;
}

export function ActForm({
  act,
  action = '/act',
  className,
  id,
  children,
  onChangeSubmit,
}: {
  act?: string;
  action?: string;
  className?: string;
  id?: string;
  children: ReactNode;
  onChangeSubmit?: boolean;
}): ReactNode {
  const submit = onChangeSubmit
    ? (event: FormEvent<HTMLFormElement>) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
          target.form?.requestSubmit();
        }
      }
    : undefined;
  return (
    <form className={className} id={id} method="post" action={action} onChange={submit}>
      {act === undefined ? null : <Hidden name="act" value={act} />}
      {children}
    </form>
  );
}
