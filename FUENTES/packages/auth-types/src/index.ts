/**
 * @tiendi/auth-types — tipos compartidos de autenticación.
 * SOLO tipos, cero runtime (A2). Ver DOCS/AUTENTICACION.md §7.
 *
 * `Role` está alineado al backend (5 roles). `StoreRole` es una dimensión
 * distinta (rol interno de un EMPLOYEE dentro de una tienda) y NO debe
 * promoverse a `Role`.
 */

/** Rol de plataforma, alineado a `tiendi-api/prisma/schema.prisma` (5 valores). */
export type Role = 'SUPER_ADMIN' | 'STORE_OWNER' | 'EMPLOYEE' | 'CUSTOMER' | 'RIDER';

/** Rol interno de tienda (rol de un EMPLOYEE). Nunca es un `Role`. */
export type StoreRole = 'MANAGER' | 'CASHIER' | 'WAREHOUSE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
  storeRole: StoreRole | null;
  avatar: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string | null;
}

export interface AuthSession {
  token: string;
  refreshToken: string;
  user: User;
}

/** Shape crudo de `POST /auth/login` / `/auth/refresh`. Los campos son los que emite la API. */
export interface ApiAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    storeId: string | null;
    storeRole?: string | null;
    avatarUrl?: string | null;
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    createdAt?: string | null;
  };
}
