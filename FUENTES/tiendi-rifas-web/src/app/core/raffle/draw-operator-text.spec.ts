import { drawOperatorText, formatDrawDate } from './draw-operator-text';

describe('formatDrawDate', () => {
  it('formats like the rest of the draw pages (es-PE, day, short month, time)', () => {
    const date = new Date('2026-11-20T15:40:00Z');
    expect(formatDrawDate(date)).toBe(
      new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date),
    );
  });
});

describe('drawOperatorText', () => {
  const at = new Date('2026-11-20T15:40:00Z');
  const when = formatDrawDate(at);

  it('names the admin who ran the draw', () => {
    expect(drawOperatorText({ executedBy: { kind: 'ADMIN', name: 'Luis' }, conductedBy: 'Ana', at })).toBe(
      `Sorteo realizado por Luis · ${when}`,
    );
  });

  it('says a system draw was automatic', () => {
    expect(drawOperatorText({ executedBy: { kind: 'SYSTEM', name: null }, at })).toBe(`Sorteo automático · ${when}`);
  });

  it('only says who conducted it when the executor is not recorded', () => {
    // Draws recorded before the migration: the conductor may not be who ran it.
    expect(drawOperatorText({ executedBy: null, conductedBy: 'Ana', at })).toBe(`Conducido por Ana · ${when}`);
    expect(drawOperatorText({ conductedBy: 'Ana', at })).toBe(`Conducido por Ana · ${when}`);
    expect(drawOperatorText({ executedBy: { kind: 'ADMIN', name: null }, conductedBy: 'Ana', at })).toBe(
      `Conducido por Ana · ${when}`,
    );
  });

  it('leaves the date out when there is none (a session still live)', () => {
    expect(drawOperatorText({ conductedBy: 'Ana' })).toBe('Conducido por Ana');
    expect(drawOperatorText({ conductedBy: 'Ana', at: null })).toBe('Conducido por Ana');
  });

  it('says nothing when the API names nobody', () => {
    expect(drawOperatorText({})).toBeNull();
    expect(drawOperatorText({ executedBy: null, conductedBy: null, at })).toBeNull();
  });
});
