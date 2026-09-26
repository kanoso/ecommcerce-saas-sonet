/**
 * Severidad OTel normalizada (guia §4: severidad OTel, no niveles del
 * logger local). Umbral de la canalizacion nueva separado del nivel del
 * logger existente.
 */
import { SeverityNumber } from '@opentelemetry/api-logs';
import type { OtelLogLevel } from './contract';

export interface Severity {
  number: SeverityNumber;
  text: string;
}

export const SEVERITY_BY_LEVEL: Record<OtelLogLevel, Severity> = {
  DEBUG: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
  INFO: { number: SeverityNumber.INFO, text: 'INFO' },
  WARN: { number: SeverityNumber.WARN, text: 'WARN' },
  ERROR: { number: SeverityNumber.ERROR, text: 'ERROR' },
};

const LEVEL_ORDER: Record<OtelLogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

/** true si `level` alcanza el umbral `threshold`. */
export function levelAtOrAbove(level: OtelLogLevel, threshold: OtelLogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[threshold];
}
