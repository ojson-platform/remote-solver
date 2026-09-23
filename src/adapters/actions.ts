export type AnnotationKind = 'error' | 'warning' | 'notice';

function escapeData(value: string): string {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function escapeProperty(value: string): string {
  return escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

/**
 * One GitHub Actions workflow command. The job summary lists it as an
 * annotation. Outside Actions it is an ordinary log line.
 */
export function annotate(kind: AnnotationKind, title: string, message: string): void {
  console.log(`::${kind} title=${escapeProperty(title)}::${escapeData(message)}`);
}
