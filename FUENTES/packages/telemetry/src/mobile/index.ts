/**
 * Adaptador mobile (React Native / Expo) — SIN SDK OTel.
 *
 * RN no garantiza AsyncLocalStorage ni el stack DOM del SDK browser. Hasta
 * que exista un adaptador OTel probado en el runtime real (T5), este modulo
 * es un buffer manual acotado: cola con TTL y descarte, flush por lotes
 * contra el gateway. Sin dependencias OTel — compatible con Metro.
 *
 * Contrato compartido: misma redaccion/umbral (el caller pasa por
 * sanitizeLogFields del nucleo o equivalentes) y mismo formato de evento.
 */
import {
  sanitizeLogFields,
  truncate,
  MAX_MESSAGE_LENGTH,
  MAX_STACK_LENGTH,
} from '../redact';
import type { OtelLogLevel } from '../contract';

export interface MobileLogEvent {
  level: OtelLogLevel;
  message: string;
  eventName?: string;
  attributes?: Record<string, unknown>;
  error?: unknown;
}

export interface MobileBufferOptions {
  /** Tamano maximo de la cola; se descarta lo mas viejo (buffer acotado). */
  maxSize?: number;
  /** Antiguedad maxima de un evento en la cola (ms). */
  ttlMs?: number;
  /** Endpoint gateway HTTPS para flush. */
  flushUrl?: string;
  /** Maximo de eventos por lote de envio. */
  batchSize?: number;
  /**
   * service.name del recurso (contrato del gateway ClientLogsBody):
   * SIN este campo el gateway responde 400 y el lote se pierde. Es
   * declaracion del emisor, no confianza: el gateway filtra por allowlist.
   */
  service?: string;
  /** service.version del build (opcional, va al resource del gateway). */
  version?: string;
}

const DEFAULTS = { maxSize: 100, ttlMs: 30 * 60_000, batchSize: 20 };

export class MobileLogBuffer {
  private readonly queue: Array<{ event: MobileLogEvent; queuedAt: number }> = [];
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly flushUrl?: string;
  private readonly batchSize: number;
  private readonly service?: string;
  private readonly version?: string;

  constructor(options: MobileBufferOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULTS.maxSize;
    this.ttlMs = options.ttlMs ?? DEFAULTS.ttlMs;
    this.flushUrl = options.flushUrl;
    this.batchSize = options.batchSize ?? DEFAULTS.batchSize;
    this.service = options.service;
    this.version = options.version;
  }

  size(): number {
    return this.queue.length;
  }

  /** Encola un evento ya saneado. Descarta el mas viejo si excede el tope. */
  push(event: MobileLogEvent, now = Date.now()): void {
    const fields = sanitizeLogFields(event);
    this.queue.push({
      event: { ...event, message: fields.message, attributes: fields.attributes },
      queuedAt: now,
    });
    while (this.queue.length > this.maxSize) this.queue.shift();
    while (this.queue.length > 0 && now - this.queue[0].queuedAt > this.ttlMs) {
      this.queue.shift();
    }
  }

  /** Vacio la cola expirada y devuelvo el resto como lotes listos para envio. */
  drain(now = Date.now()): MobileLogEvent[][] {
    while (this.queue.length > 0 && now - this.queue[0].queuedAt > this.ttlMs) {
      this.queue.shift();
    }
    const batches: MobileLogEvent[][] = [];
    for (let i = 0; i < this.queue.length; i += this.batchSize) {
      batches.push(this.queue.slice(i, i + this.batchSize).map((item) => item.event));
    }
    this.queue.length = 0;
    return batches;
  }

  /**
   * Flush contra el gateway. Failures de red NO se reintentan en bucle:
   * los eventos se pierden (telemetria no es entrega transaccional).
   * Retorna la cantidad de eventos enviados (0 si no hay URL).
   */
  async flush(fetchImpl: typeof fetch, now = Date.now()): Promise<number> {
    if (!this.flushUrl) return 0;
    const batches = this.drain(now);
    let sent = 0;
    for (const batch of batches) {
      try {
        const res = await fetchImpl(this.flushUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Contrato ClientLogsBody del gateway: service (allowlist) + events.
          body: JSON.stringify({
            ...(this.service ? { service: this.service } : {}),
            ...(this.version ? { version: this.version } : {}),
            events: batch,
          }),
        });
        if (!res.ok) continue;
        sent += batch.length;
      } catch {
        continue;
      }
    }
    return sent;
  }

  /** Mensaje de prueba/truncado reutilizable por adaptadores externos. */
  static truncateForTransport(message: string, max = MAX_MESSAGE_LENGTH): string {
    return truncate(message, max);
  }

  static readonly MAX_STACK = MAX_STACK_LENGTH;
}
