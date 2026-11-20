import { TestBed } from '@angular/core/testing';
import { ImageLightboxComponent } from './image-lightbox.component';
import { DOUBLE_TAP_SCALE, MAX_SCALE, ZOOM_STEP } from './image-zoom.model';

const IMAGES = ['https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'];

function render(images: string[] = IMAGES, startIndex = 0) {
  TestBed.configureTestingModule({ imports: [ImageLightboxComponent] });
  const fixture = TestBed.createComponent(ImageLightboxComponent);
  fixture.componentRef.setInput('images', images);
  fixture.componentRef.setInput('startIndex', startIndex);
  fixture.componentRef.setInput('alt', 'Smart TV');
  let closed = 0;
  fixture.componentInstance.closed.subscribe(() => closed++);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends Element>(sel: string) => el.querySelector(sel) as T;
  const btn = (label: string) => q<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const img = () => q<HTMLImageElement>('.lightbox__img');
  const readout = () => q<HTMLElement>('.lightbox__level').textContent?.trim();
  const press = (key: string) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };
  const click = (b: HTMLElement) => {
    b.click();
    fixture.detectChanges();
  };
  return { fixture, el, q, btn, img, readout, press, click, closedCount: () => closed };
}

describe('ImageLightboxComponent', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders a modal dialog with the start image, counter and 100% readout', () => {
    const { q, img, readout } = render(IMAGES, 1);
    const dialog = q<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(img().src).toBe(IMAGES[1]);
    expect(img().alt).toContain('Smart TV');
    expect(q<HTMLElement>('.lightbox__counter').textContent?.trim()).toBe('2 / 3');
    expect(readout()).toBe('100%');
  });

  it('focuses the close button and locks body scroll while open, restoring it on destroy', async () => {
    document.body.style.overflow = 'auto';
    const { fixture, btn } = render();
    await fixture.whenStable();
    expect(document.activeElement).toBe(btn('Cerrar'));
    expect(document.body.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('navigates with the buttons and arrow keys, wrapping around', () => {
    const { btn, img, click, press, q } = render();
    click(btn('Siguiente'));
    expect(img().src).toBe(IMAGES[1]);
    press('ArrowRight');
    expect(img().src).toBe(IMAGES[2]);
    press('ArrowRight');
    expect(img().src).toBe(IMAGES[0]);
    press('ArrowLeft');
    expect(img().src).toBe(IMAGES[2]);
    click(btn('Anterior'));
    expect(img().src).toBe(IMAGES[1]);
    expect(q<HTMLElement>('.lightbox__counter').textContent?.trim()).toBe('2 / 3');
  });

  it('hides navigation and counter with a single image', () => {
    const { btn, q } = render(['https://example.com/only.jpg']);
    expect(btn('Siguiente')).toBeNull();
    expect(btn('Anterior')).toBeNull();
    expect(q('.lightbox__counter')).toBeNull();
  });

  it('closes with Escape, the close button and a backdrop click, but not an image click', () => {
    const { press, btn, click, q, img, closedCount } = render();
    click(img());
    expect(closedCount()).toBe(0);
    press('Escape');
    expect(closedCount()).toBe(1);
    click(btn('Cerrar'));
    expect(closedCount()).toBe(2);
    click(q<HTMLElement>('.lightbox__stage'));
    expect(closedCount()).toBe(3);
  });

  it('zooms with the buttons, clamped between 100% and 400%, and resets', () => {
    const { btn, click, readout, img } = render();
    expect(btn('Alejar').disabled).toBe(true);
    expect(btn('Restablecer zoom').disabled).toBe(true);

    click(btn('Acercar'));
    expect(readout()).toBe(`${Math.round((1 + ZOOM_STEP) * 100)}%`);
    expect(img().style.transform).toContain(`scale(${1 + ZOOM_STEP})`);

    for (let i = 0; i < 20; i++) click(btn('Acercar'));
    expect(readout()).toBe(`${MAX_SCALE * 100}%`);
    expect(btn('Acercar').disabled).toBe(true);

    click(btn('Alejar'));
    expect(readout()).toBe(`${Math.round((MAX_SCALE - ZOOM_STEP) * 100)}%`);

    click(btn('Restablecer zoom'));
    expect(readout()).toBe('100%');
    expect(img().style.transform).toContain('scale(1)');
    for (let i = 0; i < 20; i++) click(btn('Alejar'));
    expect(readout()).toBe('100%');
  });

  it('toggles zoom on double-click and zooms with the mouse wheel', () => {
    const { fixture, img, readout } = render();
    img().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    expect(readout()).toBe(`${DOUBLE_TAP_SCALE * 100}%`);
    img().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    expect(readout()).toBe('100%');

    const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    img().dispatchEvent(wheel);
    fixture.detectChanges();
    expect(wheel.defaultPrevented).toBe(true);
    expect(readout()).not.toBe('100%');
  });

  it('zooms with + - 0 but leaves them to the browser with Ctrl or Cmd held', () => {
    const { fixture, readout, press } = render();
    press('+');
    expect(readout()).toBe(`${Math.round((1 + ZOOM_STEP) * 100)}%`);
    press('0');
    expect(readout()).toBe('100%');

    for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, ...mod }));
      fixture.detectChanges();
      expect(readout()).toBe('100%');
    }
  });

  it('resets the zoom when changing image', () => {
    const { btn, click, readout } = render();
    click(btn('Acercar'));
    expect(readout()).not.toBe('100%');
    click(btn('Siguiente'));
    expect(readout()).toBe('100%');
  });
});
