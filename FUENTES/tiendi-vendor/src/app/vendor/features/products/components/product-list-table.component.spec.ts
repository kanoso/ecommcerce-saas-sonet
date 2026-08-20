/**
 * Unit tests for ProductListTableComponent — scoped to the GTIN display
 * added to the barcode-scanning product intake flow.
 * See DOCS/CATALOGO_MAESTRO.md Fase 4 ("Mostrar GTIN en
 * product-list-table.component.html").
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProductListTableComponent } from './product-list-table.component';
import { Product } from '../products.store';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    storeId: 'store1',
    categoryId: 'cat1',
    name: 'Agua San Luis',
    slug: 'agua-san-luis',
    description: null,
    imageUrls: [],
    price: 3.5,
    discountPrice: null,
    sku: 'SKU-1',
    stock: 10,
    stockAlert: 5,
    isActive: true,
    isFeatured: false,
    isDailyOffer: false,
    tags: [],
    createdAt: '',
    ...overrides,
  } as Product;
}

async function createFixture(
  products: Product[],
): Promise<ComponentFixture<ProductListTableComponent>> {
  await TestBed.configureTestingModule({
    imports: [ProductListTableComponent],
    providers: [provideZonelessChangeDetection()],
  }).compileComponents();

  const fixture = TestBed.createComponent(ProductListTableComponent);
  fixture.componentRef.setInput('products', products);
  fixture.componentRef.setInput('isLoading', false);
  fixture.detectChanges();
  return fixture;
}

describe('ProductListTableComponent — gtin', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should render the gtin next to the sku when the product has one', async () => {
    const fixture = await createFixture([makeProduct({ gtin: '7750182001234' })]);

    const gtinEl = fixture.nativeElement.querySelector('.table__gtin');
    expect(gtinEl?.textContent).toContain('7750182001234');
  });

  it('should not render a gtin element when the product has none (§7.4, optional field)', async () => {
    const fixture = await createFixture([makeProduct({ gtin: undefined })]);

    expect(fixture.nativeElement.querySelector('.table__gtin')).toBeNull();
  });
});
