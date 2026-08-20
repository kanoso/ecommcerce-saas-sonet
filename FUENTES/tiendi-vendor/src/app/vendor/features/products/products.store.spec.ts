/**
 * Unit tests for ProductsStore — scoped to the `gtin` wiring added for the
 * barcode-scanning product intake flow. See DOCS/CATALOGO_MAESTRO.md §7.
 *
 * Not a full-coverage spec for the whole store: only the gtin-related
 * behavior of mapProduct(), createProduct() and updateProduct() is covered
 * here, mirroring the existing `sku` field handling in each function.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ProductsStore } from './products.store';
import { AuthStore } from '../../core/services/auth.store';
import { AnalyticsService } from '../../core/services/analytics.service';
import { environment } from '../../../../environments/environment';

const API = environment.apiUrl;

// ─── Test factory ────────────────────────────────────────────────────────────

function configure(storeId = 'store-1') {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(withInterceptorsFromDi()),
      provideHttpClientTesting(),
      {
        provide: AuthStore,
        useValue: {
          currentUser: signal({
            id: 'u1',
            name: 'Owner',
            email: 'o@test.com',
            role: 'STORE_OWNER' as const,
            storeId,
            storeRole: null,
            avatar: null,
          }),
        },
      },
      AnalyticsService,
    ],
  });

  return {
    store: TestBed.inject(ProductsStore),
    http: TestBed.inject(HttpTestingController),
  };
}

function baseCreatePayload() {
  return {
    storeId: 'store-1',
    name: 'Agua San Luis 625 ml',
    shortDescription: '',
    description: 'Agua mineral sin gas',
    tags: '',
    categoryId: 'cat-1',
    sku: 'AGU-625',
    price: 500,
    discountPrice: null,
    stock: 10,
    stockAlert: 5,
    isActive: true,
    featured: false,
    imageUrls: [],
  };
}

describe('ProductsStore — gtin', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      // no pending requests for tests that don't hit HTTP
    }
  });

  describe('mapProduct() via loadProducts()', () => {
    it('should map gtin from the raw backend response', () => {
      const { store, http } = configure();

      store.loadProducts();
      http
        .expectOne(`${API}/stores/store-1/products?limit=100`)
        .flush({ data: [{ id: 'p1', gtin: '7750182001234' }], meta: {} });
      http.expectOne(`${API}/categories`).flush([]);

      expect(store.products()[0].gtin).toBe('7750182001234');
    });

    it('should map gtin to undefined when absent from the raw response', () => {
      const { store, http } = configure();

      store.loadProducts();
      http
        .expectOne(`${API}/stores/store-1/products?limit=100`)
        .flush({ data: [{ id: 'p1' }], meta: {} });
      http.expectOne(`${API}/categories`).flush([]);

      expect(store.products()[0].gtin).toBeUndefined();
    });
  });

  describe('createProduct()', () => {
    it('should include gtin in the POST payload when provided', () => {
      const { store, http } = configure();

      store.createProduct({ ...baseCreatePayload(), gtin: '7750182001234' });

      const req = http.expectOne(`${API}/stores/store-1/products`);
      expect(req.request.body.gtin).toBe('7750182001234');
      req.flush({ id: 'p1' });
    });

    it('should send gtin as undefined when not provided (gtin is optional)', () => {
      const { store, http } = configure();

      store.createProduct(baseCreatePayload());

      const req = http.expectOne(`${API}/stores/store-1/products`);
      expect(req.request.body.gtin).toBeUndefined();
      req.flush({ id: 'p1' });
    });
  });

  describe('updateProduct()', () => {
    it('should include gtin in the PUT payload when explicitly set', () => {
      const { store, http } = configure();

      store.updateProduct('p1', { gtin: '7750182001234' });

      const req = http.expectOne(`${API}/products/p1`);
      expect(req.request.body.gtin).toBe('7750182001234');
      req.flush({ id: 'p1' });
    });

    it('should omit gtin from the PUT payload when not present in the patch', () => {
      const { store, http } = configure();

      store.updateProduct('p1', { name: 'Nuevo nombre' });

      const req = http.expectOne(`${API}/products/p1`);
      expect('gtin' in req.request.body).toBe(false);
      req.flush({ id: 'p1' });
    });
  });

  // ─── Master-catalog lookup (§7.5.5) ───────────────────────────────────────
  describe('lookupMasterProduct()', () => {
    it('should set status "loading" immediately and "found" with the match once resolved', () => {
      const { store, http } = configure();

      store.lookupMasterProduct('7750182001236');
      expect(store.masterProductLookupStatus()).toBe('loading');

      http.expectOne(`${API}/master-products/lookup?gtin=7750182001236`).flush({
        gtin: '7750182001236',
        name: 'Agua San Luis',
        marca: 'San Luis',
        contenido: '625 ml',
        categoria: 'Bebidas',
        imagen: 'https://cdn.tiendi.pe/master/agua-san-luis.jpg',
      });

      expect(store.masterProductLookupStatus()).toBe('found');
      expect(store.masterProductMatch()).toEqual({
        gtin: '7750182001236',
        name: 'Agua San Luis',
        marca: 'San Luis',
        contenido: '625 ml',
        categoria: 'Bebidas',
        imagen: 'https://cdn.tiendi.pe/master/agua-san-luis.jpg',
      });
    });

    it('should set status "not-found" and clear the match on a 404', () => {
      const { store, http } = configure();

      store.lookupMasterProduct('7750182001237');
      http
        .expectOne(`${API}/master-products/lookup?gtin=7750182001237`)
        .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

      expect(store.masterProductLookupStatus()).toBe('not-found');
      expect(store.masterProductMatch()).toBeNull();
    });

    it('should clear the match and reset status to "idle" via clearMasterProductMatch()', () => {
      const { store, http } = configure();

      store.lookupMasterProduct('7750182001236');
      http
        .expectOne(`${API}/master-products/lookup?gtin=7750182001236`)
        .flush({ gtin: '7750182001236', name: 'Agua San Luis' });
      expect(store.masterProductMatch()).not.toBeNull();

      store.clearMasterProductMatch();

      expect(store.masterProductMatch()).toBeNull();
      expect(store.masterProductLookupStatus()).toBe('idle');
    });
  });
});
