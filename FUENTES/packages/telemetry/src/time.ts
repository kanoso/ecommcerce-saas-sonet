/**
 * Acotacion temporal (guia T1): "apagar/flush con timeout. Fallas de
 * telemetria no bloquean pedidos ni el cierre del proceso". La promesa
 * original puede seguir corriendo en background, pero shutdown() resuelve
 * siempre dentro del plazo — nunca rechaza por timeout ni lo supera.
 */
export function withTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([
    promise.then(
      () => undefined,
      () => undefined,
    ),
    limit,
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
