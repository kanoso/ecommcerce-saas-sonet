export interface Category {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number | null; // null = usa precio del producto
  stock: number;
  attributes: Record<string, string>;
}

// NOTE: this interface is not currently imported by any consumer (only
// re-exported from core/types/index.ts). It predates the canonical `Product`
// shape used by ProductsStore (see products.store.ts) and its API mapping
// (mapProduct()). Fields below that are not confirmed against the real
// products API response are marked as pending instead of removed, per
// DOCS/CATALOGO_MAESTRO.md item "Eliminar de product.types.ts los campos
// inexistentes o marcarlos como pendientes".
export interface Product {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrls: string[];
  price: number;
  compareAtPrice: number | null; // pending: not present in mapProduct()'s API mapping
  sku: string | null;
  gtin: string | null;
  stock: number;
  trackStock: boolean; // pending: not present in mapProduct()'s API mapping
  allowOutOfStock: boolean; // pending: not present in mapProduct()'s API mapping
  isActive: boolean;
  isFeatured: boolean;
  variants: ProductVariant[]; // pending: not present in mapProduct()'s API mapping
  tags: string[];
  createdAt: string;
  updatedAt: string; // pending: not present in mapProduct()'s API mapping
}
