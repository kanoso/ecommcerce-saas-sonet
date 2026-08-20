import { Injectable } from '@angular/core';

/**
 * Lector de codigos de barras para el alta de productos en tiendi-vendor.
 * Usa la API nativa `BarcodeDetector` cuando el navegador la soporta
 * (Chrome/Edge en Android y desktop); si no esta disponible, carga
 * `@zxing/browser` de forma perezosa como fallback (Safari/iOS y demas).
 * Ver DOCS/CATALOGO_MAESTRO.md §7.2.
 */

interface NativeBarcodeDetectorResult {
  rawValue: string;
}

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<NativeBarcodeDetectorResult[]>;
}

interface NativeBarcodeDetectorCtor {
  new (options: { formats: string[] }): NativeBarcodeDetector;
}

declare global {
  interface Window {
    BarcodeDetector?: NativeBarcodeDetectorCtor;
  }
}

const SUPPORTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'];

/**
 * El navegador denego el permiso de camara (NotAllowedError, o el nombre
 * legacy PermissionDeniedError). Mensaje pensado para mostrarse tal cual
 * al vendedor. Ver DOCS/CATALOGO_MAESTRO.md Fase 4.
 */
export class CameraPermissionDeniedError extends Error {
  constructor() {
    super(
      'No pudimos acceder a la camara. Activa el permiso de camara para este sitio en la configuracion del navegador e intenta de nuevo.',
    );
    this.name = 'CameraPermissionDeniedError';
  }
}

/**
 * Cualquier otro fallo de camara (sin dispositivo disponible, en uso por
 * otra app, etc.) que no sea un permiso denegado.
 */
export class CameraUnavailableError extends Error {
  constructor() {
    super('No pudimos abrir la camara en este dispositivo. Podes escribir el codigo manualmente.');
    this.name = 'CameraUnavailableError';
  }
}

const PERMISSION_DENIED_ERROR_NAMES = new Set(['NotAllowedError', 'PermissionDeniedError']);

@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  /**
   * Solicita acceso a la camara trasera del dispositivo para escanear. Ver
   * DOCS/CATALOGO_MAESTRO.md Fase 4 ("Manejo de permiso de camara denegado
   * con mensaje claro"): distingue el permiso denegado de cualquier otro
   * fallo de camara para que el consumidor pueda mostrar un mensaje claro.
   */
  async requestCameraAccess(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (err) {
      if (err instanceof DOMException && PERMISSION_DENIED_ERROR_NAMES.has(err.name)) {
        throw new CameraPermissionDeniedError();
      }
      throw new CameraUnavailableError();
    }
  }

  /**
   * Indica si el navegador puede escanear codigos de barras, ya sea con la
   * API nativa o con el fallback @zxing/browser.
   */
  async isSupported(): Promise<boolean> {
    if (this.hasNativeDetector()) {
      return true;
    }
    return this.canLoadZxing();
  }

  /**
   * Escanea un unico frame de video buscando un codigo de barras.
   * Devuelve el valor crudo detectado o null si no se encontro nada.
   */
  async scanFromVideo(video: HTMLVideoElement): Promise<string | null> {
    if (this.hasNativeDetector()) {
      return this.scanWithNativeDetector(video);
    }
    return this.scanWithZxing(video);
  }

  private hasNativeDetector(): boolean {
    return 'BarcodeDetector' in window && !!window.BarcodeDetector;
  }

  private async scanWithNativeDetector(video: HTMLVideoElement): Promise<string | null> {
    const detector = new window.BarcodeDetector!({ formats: SUPPORTED_FORMATS });
    const results = await detector.detect(video);
    return results[0]?.rawValue ?? null;
  }

  private async scanWithZxing(video: HTMLVideoElement): Promise<string | null> {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeOnceFromVideoElement(video);
      return result.getText();
    } catch {
      return null;
    }
  }

  private async canLoadZxing(): Promise<boolean> {
    try {
      await import('@zxing/browser');
      return true;
    } catch {
      return false;
    }
  }
}
