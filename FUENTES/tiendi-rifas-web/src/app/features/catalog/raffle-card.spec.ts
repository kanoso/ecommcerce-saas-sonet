import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RaffleSummary } from '../../core/api/api.models';
import { RaffleCard } from './raffle-card';
import { aRaffle } from './testing/raffle.fixture';

function render(raffle: RaffleSummary): HTMLElement {
  TestBed.configureTestingModule({ imports: [RaffleCard], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(RaffleCard);
  fixture.componentRef.setInput('raffle', raffle);
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
});
