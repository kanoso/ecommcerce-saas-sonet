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

export interface Product {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrls: string[];
  price: number;
  compareAtPrice: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  trackStock: boolean;
  allowOutOfStock: boolean;
  isActive: boolean;
  isFeatured: boolean;
  variants: ProductVariant[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
