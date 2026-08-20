/**
 * Unit tests for ProductFormPage — scoped to the `gtin` field wiring in the
 * submit payload. See DOCS/CATALOGO_MAESTRO.md §7.5.
 *
 * Not a full-coverage spec for the whole page: only the bug where the
 * vendor's typed/scanned gtin was silently dropped from the create/update
 * payload is covered here.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductFormPage } from './product-form.page';
import { ProductsStore } from '../products.store';

// ─── Stubs ─────────────────────────────────────────────────────────────────

function makeProductsStoreStub() {
  return {
    products: signal([]),
    categories: signal([]),
    isSaving: signal(false),
    error: signal(null),
    masterProductLookupStatus: signal('idle'),
    masterProductMatch: signal(null),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    loadProducts: vi.fn(),
    lookupMasterProduct: vi.fn(),
    clearMasterProductMatch: vi.fn(),
  };
}

function makeActivatedRouteStub(id: string | null = null) {
  return {
    snapshot: { paramMap: { get: () => id } },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function setup(id: string | null = null) {
  const store = makeProductsStoreStub();
  const router = { navigate: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [ProductFormPage],
    providers: [
      provideZonelessChangeDetection(),
      { provide: ProductsStore, useValue: store },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: makeActivatedRouteStub(id) },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<ProductFormPage> = TestBed.createComponent(ProductFormPage);
  fixture.detectChanges();
  return { fixture, store, router };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProductFormPage — submit payload gtin (§7.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should include the gtin typed in the form when creating a product', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;

    comp.onFormChange({ name: 'Agua San Luis', gtin: '7750182001236' });
    comp.onSubmit();

    expect(store.createProduct).toHaveBeenCalledTimes(1);
    const payload = store.createProduct.mock.calls[0][0];
    expect(payload.gtin).toBe('7750182001236');
  });

  it('should include the gtin typed in the form when updating a product', async () => {
    const { fixture, store } = await setup('prod-1');
    const comp = fixture.componentInstance;

    comp.onFormChange({ name: 'Agua San Luis', gtin: '7750182001236' });
    comp.onSubmit();

    expect(store.updateProduct).toHaveBeenCalledTimes(1);
    const payload = store.updateProduct.mock.calls[0][1];
    expect(payload.gtin).toBe('7750182001236');
  });
});

// ─── Master-catalog lookup wiring (§7.5.5) ─────────────────────────────────
// The page is the container: it owns the store call, the component only
// emits. See DOCS/CATALOGO_MAESTRO.md §7.5.5.

describe('ProductFormPage — master-catalog lookup wiring (§7.5.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should call store.lookupMasterProduct with the emitted gtin on gtinLookupRequested', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;

    comp.onGtinLookupRequested('7750182001236');

    expect(store.lookupMasterProduct).toHaveBeenCalledWith('7750182001236');
  });

  it('should call store.clearMasterProductMatch on matchConfirmed', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;

    comp.onMatchConfirmed();

    expect(store.clearMasterProductMatch).toHaveBeenCalledTimes(1);
  });

  it('should call store.clearMasterProductMatch on matchRejected', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;

    comp.onMatchRejected();

    expect(store.clearMasterProductMatch).toHaveBeenCalledTimes(1);
  });
});
