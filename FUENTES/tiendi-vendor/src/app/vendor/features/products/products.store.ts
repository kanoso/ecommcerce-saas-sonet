import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';

export interface Product {
  id: string;
  storeId: string;
  name: string;
  slug?: string;
  shortDescription: string;
  description: string;
  tags: string;
  categoryId: string;
  categoryName?: string;
  presentation: string;
  sku: string;
  price: number;
  discountPrice: number | null;
  stock: number;
  stockAlert: number;
  isActive: boolean;
  isAvailable: boolean;
  featured?: boolean;
  imageUrls: string[];
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  children?: { id: string; name: string; slug: string }[];
}

export interface ProductFilters {
  search: string;
  categoryId: string;
  stockFilter: 'all' | 'low' | 'out' | 'ok';
}

interface ProductsState {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  filters: ProductFilters;
  viewMode: 'grid' | 'list';
}

const initialState: ProductsState = {
  products: [],
  categories: [],
  isLoading: false,
  isSaving: false,
  error: null,
  filters: { search: '', categoryId: '', stockFilter: 'all' },
  viewMode: 'grid',
};

const API = environment.apiUrl;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(raw: Record<string, any>): Product {
  const cat = raw['category'] as { id: string; name: string; slug: string } | null;
  const images = (raw['images'] as string[] | null) ?? [];
  return {
    id:            raw['id'],
    storeId:       raw['storeId']    ?? '',
    name:          raw['name']       ?? '',
    slug:          raw['slug']       ?? '',
    shortDescription: raw['shortDescription'] ?? '',
    description:   raw['description'] ?? '',
    tags:          raw['tags']        ?? '',
    categoryId:    cat?.id           ?? raw['categoryId'] ?? '',
    categoryName:  cat?.name         ?? '',
    presentation:  '',
    sku:           raw['sku']        ?? '',
    price:         Number(raw['price']) || 0,
    discountPrice: raw['salePrice'] != null ? Number(raw['salePrice']) : null,
    stock:         raw['stock']      ?? 0,
    stockAlert:    raw['stockAlert'] ?? 5,
    isActive:      raw['isActive']   ?? true,
    isAvailable:   (raw['stock'] ?? 0) > 0 && (raw['isActive'] ?? true),
    featured:      raw['featured']   ?? false,
    imageUrls:     images,
    createdAt:     raw['createdAt']  ?? new Date().toISOString(),
  };
}

export const ProductsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    filteredProducts: computed(() => {
      const { search, categoryId, stockFilter } = store.filters();
      let items = store.products();

      if (search.trim()) {
        const q = search.toLowerCase();
        items = items.filter((p) => p.name.toLowerCase().includes(q));
      }

      if (categoryId) {
        items = items.filter((p) => p.categoryId === categoryId);
      }

      if (stockFilter !== 'all') {
        items = items.filter((p) => {
          if (stockFilter === 'out') return p.stock === 0;
          if (stockFilter === 'low') return p.stock > 0 && p.stock <= p.stockAlert;
          if (stockFilter === 'ok') return p.stock > p.stockAlert;
          return true;
        });
      }

      return items;
    }),
    lowStockCount: computed(() =>
      store.products().filter((p) => p.stock > 0 && p.stock <= p.stockAlert).length
    ),
    activeCount: computed(() => store.products().filter((p) => p.isActive).length),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const authStore = inject(AuthStore);

    function storeId(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    return {
      loadProducts(): void {
        patchState(store, { isLoading: true, error: null });
        forkJoin({
          products: http.get<{ data: Record<string, unknown>[]; meta: unknown }>(
            `${API}/stores/${storeId()}/products?limit=100`,
          ),
          categories: http.get<Record<string, unknown>[]>(`${API}/categories`),
        }).subscribe({
          next: ({ products, categories }) =>
            patchState(store, {
              products: products.data.map(mapProduct),
              categories: categories as unknown as Category[],
              isLoading: false,
            }),
          error: (err) =>
            patchState(store, { isLoading: false, error: err.message ?? 'Error al cargar productos' }),
        });
      },

      createProduct(data: Omit<Product, 'id' | 'slug' | 'createdAt' | 'isAvailable' | 'categoryName' | 'presentation'>): void {
        patchState(store, { isSaving: true, error: null });
        const payload = {
          name: data.name,
          shortDescription: data.shortDescription || undefined,
          description: data.description,
          tags: data.tags || undefined,
          price: data.price,
          salePrice: data.discountPrice ?? undefined,
          sku: data.sku || undefined,
          stock: data.stock,
          stockAlert: data.stockAlert,
          images: data.imageUrls,
          categoryId: data.categoryId || undefined,
          featured: data.featured,
        };
        http.post<Record<string, unknown>>(`${API}/stores/${storeId()}/products`, payload).subscribe({
          next: (created) =>
            patchState(store, { products: [...store.products(), mapProduct(created)], isSaving: false }),
          error: (err) =>
            patchState(store, { isSaving: false, error: err.message ?? 'Error al crear producto' }),
        });
      },

      updateProduct(id: string, data: Partial<Product>): void {
        patchState(store, { isSaving: true, error: null });
        const payload: Record<string, unknown> = {};
        if (data.name !== undefined)              payload['name']             = data.name;
        if (data.shortDescription !== undefined)  payload['shortDescription'] = data.shortDescription;
        if (data.description !== undefined)       payload['description']      = data.description;
        if (data.tags !== undefined)              payload['tags']             = data.tags;
        if (data.price !== undefined)         payload['price']       = data.price;
        if (data.discountPrice !== undefined) payload['salePrice']   = data.discountPrice;
        if (data.sku !== undefined)           payload['sku']         = data.sku;
        if (data.stock !== undefined)         payload['stock']       = data.stock;
        if (data.stockAlert !== undefined)    payload['stockAlert']  = data.stockAlert;
        if (data.imageUrls !== undefined)     payload['images']      = data.imageUrls;
        if (data.categoryId !== undefined)    payload['categoryId']  = data.categoryId || null;
        if (data.featured !== undefined)      payload['featured']    = data.featured;
        if (data.isActive !== undefined)      payload['isActive']    = data.isActive;

        http.put<Record<string, unknown>>(`${API}/products/${id}`, payload).subscribe({
          next: (updated) =>
            patchState(store, {
              products: store.products().map((p) => (p.id === id ? mapProduct(updated) : p)),
              isSaving: false,
            }),
          error: (err) =>
            patchState(store, { isSaving: false, error: err.message ?? 'Error al actualizar producto' }),
        });
      },

      deleteProduct(id: string): void {
        http.delete(`${API}/products/${id}`).subscribe({
          next: () =>
            patchState(store, { products: store.products().filter((p) => p.id !== id) }),
          error: (err) =>
            patchState(store, { error: err.message ?? 'Error al eliminar producto' }),
        });
      },

      toggleActive(id: string, isActive: boolean): void {
        http.patch<Record<string, unknown>>(`${API}/products/${id}`, { isActive }).subscribe({
          next: (updated) =>
            patchState(store, {
              products: store.products().map((p) => (p.id === id ? { ...p, isActive: updated['isActive'] as boolean } : p)),
            }),
          error: (err) =>
            patchState(store, { error: err.message ?? 'Error al cambiar estado' }),
        });
      },

      setFilters(f: Partial<ProductFilters>): void {
        patchState(store, { filters: { ...store.filters(), ...f } });
      },

      setViewMode(mode: 'grid' | 'list'): void {
        patchState(store, { viewMode: mode });
      },

      clearFilters(): void {
        patchState(store, { filters: { search: '', categoryId: '', stockFilter: 'all' } });
      },
    };
  })
);
