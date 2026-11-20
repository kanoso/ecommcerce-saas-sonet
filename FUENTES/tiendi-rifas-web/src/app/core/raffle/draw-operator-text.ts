import { DrawExecutor } from '../api/api.models';

const DRAW_DATE = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** The date format of the draw pages: "20 nov., 10:40 a. m.". */
export function formatDrawDate(date: Date): string {
  return DRAW_DATE.format(date);
}

export interface DrawOperatorInput {
  /** Who ran the draw; null or absent when not recorded (draws before the migration). */
  executedBy?: DrawExecutor | null;
  /** Who conducted the live session, if any. */
  conductedBy?: string | null;
  /** When it ended; omitted while the session is still live. */
  at?: Date | null;
}

/**
 * The one wording of who ran a draw, on the live page and in the admin:
 * "Sorteo realizado por <nombre>", "Sorteo automático" or, when the executor
 * is not recorded, "Conducido por <nombre>" (the conductor may not be who ran
 * it). Followed by " · <fecha>" when there is a date. Null when nobody is named.
 */
export function drawOperatorText({ executedBy, conductedBy, at }: DrawOperatorInput): string | null {
  let text: string | null = null;
  if (executedBy?.kind === 'SYSTEM') {
    text = 'Sorteo automático';
  } else if (executedBy?.kind === 'ADMIN' && executedBy.name) {
    text = `Sorteo realizado por ${executedBy.name}`;
  } else if (conductedBy) {
    text = `Conducido por ${conductedBy}`;
  }
  if (!text) return null;
  return at ? `${text} · ${formatDrawDate(at)}` : text;
}
