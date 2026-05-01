export type Role = 'STORE_OWNER' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE' | 'EMPLOYEE' | 'CUSTOMER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
  avatar: string | null;
}

export interface AuthSession {
  token: string;
  refreshToken: string;
  user: User;
}

export interface ApiAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    storeId: string | null;
    avatarUrl?: string | null;
  };
}
