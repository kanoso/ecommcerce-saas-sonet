/**
 * Unit tests for BarcodeScannerService.
 * Covers: native BarcodeDetector path, @zxing/browser fallback path,
 * and feature-detection via isSupported(). See DOCS/CATALOGO_MAESTRO.md §7.2.
 */
import { TestBed } from '@angular/core/testing';
import {
  BarcodeScannerService,
  CameraPermissionDeniedError,
  CameraUnavailableError,
} from './barcode-scanner.service';
import { BrowserMultiFormatReader } from '@zxing/browser';

// @zxing/browser is mocked at module level: a real dynamic import of it
// hangs inside jsdom (no canvas/worker support), and per-test vi.doMock
// does not override a module already cached by an earlier real import().
vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stubNativeDetector(rawValue: string | null) {
  const detect = vi.fn().mockResolvedValue(rawValue === null ? [] : [{ rawValue }]);
  // Must be a regular function (not an arrow function): the service calls
  // `new window.BarcodeDetector(...)`, and arrow functions cannot be constructed.
  const ctor = vi.fn(function BarcodeDetectorMock() {
    return { detect };
  });
  (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector = ctor;
  return { ctor, detect };
}

function removeNativeDetector() {
  delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
}

function mockZxingReader(decodeOnceFromVideoElement: ReturnType<typeof vi.fn>) {
  vi.mocked(BrowserMultiFormatReader).mockImplementation(function () {
    return { decodeOnceFromVideoElement } as unknown as InstanceType<
      typeof BrowserMultiFormatReader
    >;
  });
}

describe('BarcodeScannerService', () => {
  let service: BarcodeScannerService;
  let video: HTMLVideoElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BarcodeScannerService);
    video = document.createElement('video');
  });

  afterEach(() => {
    removeNativeDetector();
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('true cuando window.BarcodeDetector existe', async () => {
      stubNativeDetector('123');

      await expect(service.isSupported()).resolves.toBe(true);
    });

    it('true cuando no hay BarcodeDetector nativo pero @zxing/browser carga', async () => {
      removeNativeDetector();
      mockZxingReader(vi.fn().mockResolvedValue({ getText: () => '123' }));

      await expect(service.isSupported()).resolves.toBe(true);
    });
  });

  describe('scanFromVideo — detector nativo', () => {
    it('devuelve el rawValue del primer resultado detectado', async () => {
      const { ctor, detect } = stubNativeDetector('7750182001234');

      const result = await service.scanFromVideo(video);

      expect(ctor).toHaveBeenCalledWith({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'],
      });
      expect(detect).toHaveBeenCalledWith(video);
      expect(result).toBe('7750182001234');
    });

    it('devuelve null cuando el detector nativo no encuentra nada', async () => {
      stubNativeDetector(null);

      const result = await service.scanFromVideo(video);

      expect(result).toBeNull();
    });
  });

  describe('scanFromVideo — fallback @zxing/browser', () => {
    it('usa @zxing/browser cuando no hay BarcodeDetector nativo', async () => {
      removeNativeDetector();
      const decodeOnceFromVideoElement = vi
        .fn()
        .mockResolvedValue({ getText: () => '7750182001234' });
      mockZxingReader(decodeOnceFromVideoElement);

      const result = await service.scanFromVideo(video);

      expect(decodeOnceFromVideoElement).toHaveBeenCalledWith(video);
      expect(result).toBe('7750182001234');
    });

    it('devuelve null cuando @zxing/browser no logra decodificar', async () => {
      removeNativeDetector();
      mockZxingReader(vi.fn().mockRejectedValue(new Error('not found')));

      const result = await service.scanFromVideo(video);

      expect(result).toBeNull();
    });
  });

  // ─── requestCameraAccess (Fase 4: "Manejo de permiso de cámara denegado
  // con mensaje claro") ────────────────────────────────────────────────────
  describe('requestCameraAccess', () => {
    const FAKE_STREAM = {} as MediaStream;

    function stubGetUserMedia(getUserMedia: ReturnType<typeof vi.fn>) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia },
        configurable: true,
      });
    }

    afterEach(() => {
      delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
    });

    it('resuelve con el stream de la cámara trasera cuando el navegador concede el permiso', async () => {
      const getUserMedia = vi.fn().mockResolvedValue(FAKE_STREAM);
      stubGetUserMedia(getUserMedia);

      const stream = await service.requestCameraAccess();

      expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } });
      expect(stream).toBe(FAKE_STREAM);
    });

    it('lanza CameraPermissionDeniedError con mensaje claro cuando el navegador deniega el permiso', async () => {
      stubGetUserMedia(
        vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      );

      await expect(service.requestCameraAccess()).rejects.toBeInstanceOf(
        CameraPermissionDeniedError,
      );
      await expect(service.requestCameraAccess()).rejects.toThrow(/permiso de c[aá]mara/i);
    });

    it('trata PermissionDeniedError (nombre legacy) como permiso denegado', async () => {
      stubGetUserMedia(
        vi.fn().mockRejectedValue(new DOMException('denied', 'PermissionDeniedError')),
      );

      await expect(service.requestCameraAccess()).rejects.toBeInstanceOf(
        CameraPermissionDeniedError,
      );
    });

    it('lanza CameraUnavailableError con mensaje claro ante cualquier otro fallo de cámara', async () => {
      stubGetUserMedia(
        vi.fn().mockRejectedValue(new DOMException('no camera found', 'NotFoundError')),
      );

      await expect(service.requestCameraAccess()).rejects.toBeInstanceOf(CameraUnavailableError);
      await expect(service.requestCameraAccess()).rejects.toThrow(/no pudimos abrir la c[aá]mara/i);
    });
  });
});
