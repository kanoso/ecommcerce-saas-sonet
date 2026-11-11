import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AdminApi, ProofFile } from '../../core/api/admin-api';
import { ApiError } from '../../core/api/api-error';
import { ProofViewer } from './proof-viewer';

@Component({
  selector: 'app-proof-viewer-host',
  standalone: true,
  template: '',
  providers: [ProofViewer],
})
class HostComponent {
  readonly viewer = inject(ProofViewer);
}

describe('ProofViewer', () => {
  let adminApiMock: { proofFile: ReturnType<typeof vi.fn> };
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let openSpy: ReturnType<typeof vi.spyOn>;
  let popup: { location: { href: string }; opener: unknown; close: ReturnType<typeof vi.fn> };

  const file: ProofFile = { blob: new Blob(['png'], { type: 'image/png' }), filename: 'comprobante.png' };

  const create = () => {
    const fixture = TestBed.createComponent(HostComponent);
    return { fixture, viewer: fixture.componentInstance.viewer };
  };

  beforeEach(() => {
    adminApiMock = { proofFile: vi.fn().mockReturnValue(of(file)) };
    createObjectURL = vi.fn().mockReturnValue('blob:https://rifas.test/proof-1');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
    popup = { location: { href: 'about:blank' }, opener: window, close: vi.fn() };
    openSpy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: AdminApi, useValue: adminApiMock }],
    });
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('fetches the proof as a blob and shows it in a new tab through an object URL', () => {
    const { viewer } = create();

    viewer.view('ord-1');

    expect(adminApiMock.proofFile).toHaveBeenCalledWith('ord-1');
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(createObjectURL).toHaveBeenCalledWith(file.blob);
    expect(popup.opener).toBeNull();
    expect(popup.location.href).toBe('blob:https://rifas.test/proof-1');
    expect(popup.location.href).not.toContain('token');
    expect(viewer.loadingId()).toBeNull();
    expect(viewer.error()).toBeNull();
  });

  it('marks the order as loading while the file is in flight', () => {
    const pending = new Subject<ProofFile>();
    adminApiMock.proofFile.mockReturnValue(pending);
    const { viewer } = create();

    viewer.view('ord-1');
    expect(viewer.loadingId()).toBe('ord-1');

    pending.next(file);
    pending.complete();
    expect(viewer.loadingId()).toBeNull();
  });

  it('downloads the file with its filename when the browser blocks the new tab', () => {
    openSpy.mockReturnValue(null);
    const clicks: { href: string; download: string }[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ href: this.href, download: this.download });
    });
    const { viewer } = create();

    viewer.view('ord-1');

    expect(clicks).toEqual([{ href: 'blob:https://rifas.test/proof-1', download: 'comprobante.png' }]);
    clickSpy.mockRestore();
  });

  it('closes the blank tab and shows the API user message when the download fails', () => {
    adminApiMock.proofFile.mockReturnValue(
      throwError(() => new ApiError(404, 'ORDER_NOT_FOUND', 'No encontramos esta orden.')),
    );
    const { viewer } = create();

    viewer.view('ord-1');

    expect(popup.close).toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(viewer.error()).toBe('No encontramos esta orden.');
    expect(viewer.loadingId()).toBeNull();
  });

  it('uses a generic message when the failure is not an ApiError', () => {
    adminApiMock.proofFile.mockReturnValue(throwError(() => new Error('boom')));
    const { viewer } = create();

    viewer.view('ord-1');

    expect(viewer.error()).toBe('No se pudo abrir el comprobante. Intenta nuevamente.');
  });

  it('revokes every object URL it created when its host is destroyed', () => {
    createObjectURL.mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b');
    const { fixture, viewer } = create();

    viewer.view('ord-1');
    viewer.view('ord-2');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    fixture.destroy();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:a');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:b');
  });

  it('cancels an in-flight download when its host is destroyed', () => {
    const pending = new Subject<ProofFile>();
    adminApiMock.proofFile.mockReturnValue(pending);
    const { fixture, viewer } = create();

    viewer.view('ord-1');
    fixture.destroy();
    pending.next(file);

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(popup.close).toHaveBeenCalled();
  });

  describe('MIME allowlist', () => {
    const clickCapture = () => {
      const clicks: { href: string; download: string }[] = [];
      const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        clicks.push({ href: this.href, download: this.download });
      });
      return { clicks, restore: () => spy.mockRestore() };
    };

    it.each(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])(
      'opens %s inline through a blob re-wrapped with that exact type',
      (type) => {
        adminApiMock.proofFile.mockReturnValue(of({ blob: new Blob(['x'], { type }), filename: 'comprobante' }));
        const { viewer } = create();

        viewer.view('ord-1');

        const wrapped = createObjectURL.mock.calls[0][0] as Blob;
        expect(wrapped.type).toBe(type);
        expect(popup.location.href).toBe('blob:https://rifas.test/proof-1');
        expect(popup.close).not.toHaveBeenCalled();
      },
    );

    it('normalizes case and strips parameters before checking the type', () => {
      adminApiMock.proofFile.mockReturnValue(
        of({ blob: new Blob(['x'], { type: 'Image/PNG; charset=binary' }), filename: 'comprobante.png' }),
      );
      const { viewer } = create();

      viewer.view('ord-1');

      expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe('image/png');
      expect(popup.location.href).toBe('blob:https://rifas.test/proof-1');
    });

    it.each(['text/html', 'image/svg+xml', 'text/html; charset=utf-8', ''])(
      'never navigates the tab to a %s blob: closes it and downloads it as octet-stream',
      (type) => {
        adminApiMock.proofFile.mockReturnValue(
          of({ blob: new Blob(['<script>alert(1)</script>'], { type }), filename: 'evil.html' }),
        );
        const capture = clickCapture();
        const { viewer } = create();

        viewer.view('ord-7');

        expect(popup.location.href).toBe('about:blank');
        expect(popup.close).toHaveBeenCalled();
        expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe('application/octet-stream');
        expect(capture.clicks).toEqual([
          { href: 'blob:https://rifas.test/proof-1', download: 'comprobante-ord-7' },
        ]);
        capture.restore();
      },
    );
  });
});
