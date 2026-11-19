import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RaffleSummary } from '../../core/api/api.models';
import { RaffleCard } from './raffle-card';
import { aRaffle } from './testing/raffle.fixture';

function render(raffle: RaffleSummary, now?: Date): HTMLElement {
  TestBed.configureTestingModule({ imports: [RaffleCard], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(RaffleCard);
  fixture.componentRef.setInput('raffle', raffle);
  if (now) {
    fixture.componentRef.setInput('now', now);
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';

describe('RaffleCard', () => {
  it('shows title, prize, price and close date', () => {
    const el = render(aRaffle());
    expect(el.querySelector('h2')?.textContent).toContain('Smart TV 55"');
    expect(text(el)).toContain('Un televisor de 55 pulgadas');
    expect(el.textContent).toContain(`S/${String.fromCharCode(160)}10.00`);
    expect(text(el)).toMatch(/Cierra 15 nov.*20:00/);
  });

  it('shows the sales progress when the sold count is known', () => {
    const el = render(aRaffle({ soldCount: 640, availableCount: 350, totalNumbers: 1000 }));
    const bar = el.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('64');
    expect(text(el)).toContain('640 de 1,000 números vendidos');
  });

  it('shows how many numbers are still available', () => {
    expect(text(render(aRaffle({ soldCount: 640, availableCount: 350 })))).toContain('350 disponibles');
  });

  it('says so when no number is available', () => {
    expect(text(render(aRaffle({ soldCount: 1000, availableCount: 0 })))).toContain('Sin números disponibles');
  });

  it('shows the available numbers even when the sold count is unknown', () => {
    const el = render(aRaffle({ soldCount: null, availableCount: 12, totalNumbers: 500 }));
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
    expect(text(el)).toContain('500 números en juego');
    expect(text(el)).toContain('12 disponibles');
  });

  it('shows only the number count when sales are unknown', () => {
    const el = render(aRaffle({ soldCount: null, availableCount: null, totalNumbers: 500 }));
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
    expect(text(el)).toContain('500 números en juego');
    expect(text(el)).not.toContain('disponibles');
  });

  it('omits the close date when it is not a valid date', () => {
    expect(text(render(aRaffle({ salesCloseAt: new Date('nope') })))).not.toContain('Cierra');
  });

  it('shows the authorization resolution badge only when known', () => {
    expect(text(render(aRaffle({ authorizationResolution: 'RD-045-2026' })))).toContain(
      'Autorizado por Resolución RD-045-2026',
    );
    TestBed.resetTestingModule();
    expect(text(render(aRaffle({ authorizationResolution: null })))).not.toContain('Autorizado');
  });

  it('omits the close date when the raffle has none', () => {
    expect(text(render(aRaffle({ salesCloseAt: null })))).not.toContain('Cierra');
  });

  it('links to the raffle to choose numbers', () => {
    const link = render(aRaffle({ id: 'r-9' })).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/rifas/r-9');
    expect(link?.textContent).toContain('Elegir números');
  });

  describe('prizes and visible status (DT-23)', () => {
    const prizes = [
      { position: 1, title: 'Olla arrocera', description: null, images: [] },
      { position: 2, title: 'Licuadora', description: null, images: [] },
      { position: 3, title: 'Tostadora', description: null, images: [] },
    ];
    const drawAt = new Date('2026-11-21T23:00:00Z');
    const badge = (el: HTMLElement) => el.querySelector('[data-visible-status]');

    it('names the first prize and how many more there are', () => {
      expect(text(render(aRaffle({ prizes })))).toContain('Olla arrocera + 2 premios más');
      TestBed.resetTestingModule();
      expect(text(render(aRaffle({ prizes: prizes.slice(0, 2) })))).toContain('Olla arrocera + 1 premio más');
    });

    it('badges a raffle on sale', () => {
      expect(badge(render(aRaffle()))?.textContent).toContain('En venta');
    });

    it('badges a closed raffle with its draw date and links to the live draw', () => {
      const el = render(aRaffle({ status: 'CLOSED', drawAt }), new Date('2026-11-21T20:00:00Z'));
      expect(badge(el)?.textContent).toContain('Ventas cerradas · Sorteo el');
      expect(el.querySelector('a[href="/rifas/11111111-1111-4111-8111-111111111111/en-vivo"]')).not.toBeNull();
    });

    it('badges a pending draw', () => {
      const el = render(aRaffle({ status: 'CLOSED', drawAt }), new Date('2026-11-22T00:00:00Z'));
      expect(badge(el)?.getAttribute('data-visible-status')).toBe('DRAW_PENDING');
      expect(badge(el)?.textContent).toContain('Sorteo pendiente');
    });

    it('badges a live draw and invites to watch it, without winners', () => {
      const el = render(aRaffle({ status: 'DRAWN', drawAt, liveDrawInProgress: true }));
      expect(badge(el)?.textContent).toContain('Sorteando en vivo');
      expect(text(el)).toContain('Ver sorteo en vivo');
      expect(el.querySelector('.card__winners')).toBeNull();
    });

    it('lists the winner of every prize of a drawn raffle', () => {
      const el = render(
        aRaffle({
          status: 'DRAWN',
          prizes: prizes.slice(0, 2),
          winners: [
            { position: 1, prizeTitle: 'Olla arrocera', status: 'WON', winningNumber: 7 },
            { position: 2, prizeTitle: 'Licuadora', status: 'VOID', winningNumber: null },
          ],
        }),
      );
      expect(badge(el)?.textContent).toContain('Sorteada');
      const rows = [...el.querySelectorAll('.card__winners li')].map((li) => text(li as HTMLElement));
      expect(rows[0]).toContain('Olla arrocera');
      expect(rows[0]).toContain('#0007');
      expect(rows[1]).toContain('Licuadora');
      expect(rows[1]).toContain('Desierto');
      expect(text(el)).toContain('Verificación');
    });

    it('badges a cancelled raffle', () => {
      expect(badge(render(aRaffle({ status: 'CANCELLED' })))?.textContent).toContain('Cancelada');
    });
  });
});
