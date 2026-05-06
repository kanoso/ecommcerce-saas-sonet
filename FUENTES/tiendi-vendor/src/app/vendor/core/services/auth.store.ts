import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiAuthResponse, AuthSession, Role, User } from '../types';
import { environment } from '../../../../environments/environment';

const SESSION_KEY = 'tiendi_vendor_session';
const API_BASE = environment.apiUrl;

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({
    user: null,
    token: null,
    refreshToken: null,
    isLoading: false,
  }),
  withComputed(({ user, token }) => ({
    isAuthenticated: computed(() => !!token()),
    currentUser: computed(() => user()),
    isVendor: computed(() => {
      const vendorRoles: Role[] = ['STORE_OWNER', 'MANAGER', 'CASHIER', 'WAREHOUSE'];
      const role = user()?.role;
      return role != null && vendorRoles.includes(role);
    }),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const router = inject(Router);

    function persistSession(session: AuthSession): void {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    function clearSession(): void {
      localStorage.removeItem(SESSION_KEY);
    }

    return {
      hasRole(role: Role): boolean {
        return store.user()?.role === role;
      },

      loadFromStorage(): void {
        try {
          const raw = localStorage.getItem(SESSION_KEY);
          if (!raw) return;
          const session: AuthSession = JSON.parse(raw);
          if (session?.token && session?.user) {
            patchState(store, {
              user: session.user,
              token: session.token,
              refreshToken: session.refreshToken,
            });
          }
        } catch {
          clearSession();
        }
      },

      async login(email: string, password: string): Promise<void> {
        patchState(store, { isLoading: true });
        try {
          const raw = await firstValueFrom(
            http.post<ApiAuthResponse>(`${API_BASE}/auth/login`, { email, password }),
          );
          const session: AuthSession = {
            token: raw.accessToken,
            refreshToken: raw.refreshToken,
            user: {
              id: raw.user.id,
              name: raw.user.name,
              email: raw.user.email,
              role: raw.user.role as Role,
              storeId: raw.user.storeId ?? null,
              avatar: raw.user.avatarUrl ?? null,
            },
          };
          patchState(store, {
            user: session.user,
            token: session.token,
            refreshToken: session.refreshToken,
            isLoading: false,
          });
          persistSession(session);
        } catch (err) {
          patchState(store, { isLoading: false });
          throw err;
        }
      },

      /**
       * Refresca los datos del usuario desde GET /auth/me.
       * Se llama al iniciar la app para sincronizar con el backend.
       * Si falla (offline, 401, etc.) no hace nada — los datos de localStorage siguen vigentes.
       */
      async fetchMe(): Promise<void> {
        const token = store.token();
        if (!token) return;
        try {
          const raw = await firstValueFrom(
            http.get<ApiAuthResponse['user']>(`${API_BASE}/auth/me`),
          );
          const updatedUser: User = {
            id: raw.id,
            name: raw.name,
            email: raw.email,
            role: raw.role as Role,
            storeId: raw.storeId ?? null,
            avatar: raw.avatarUrl ?? null,
          };
          patchState(store, { user: updatedUser });
          const refreshToken = store.refreshToken();
          if (token && refreshToken) {
            persistSession({ token, refreshToken, user: updatedUser });
          }
        } catch {
          // Silently fail — user data from localStorage is still valid
        }
      },

      async doRefreshToken(): Promise<void> {
        const currentRefresh = store.refreshToken();
        if (!currentRefresh) throw new Error('No refresh token available');

        const raw = await firstValueFrom(
          http.post<{ accessToken: string; refreshToken: string }>(`${API_BASE}/auth/refresh`, {
            refreshToken: currentRefresh,
          }),
        );

        patchState(store, {
          token: raw.accessToken,
          refreshToken: raw.refreshToken,
        });

        const currentUser = store.user();
        if (currentUser) {
          persistSession({ token: raw.accessToken, refreshToken: raw.refreshToken, user: currentUser });
        }
      },

      logout(): void {
        const token = store.token();
        if (token) {
          http.post(`${API_BASE}/auth/logout`, {}).subscribe();
        }
        patchState(store, {
          user: null,
          token: null,
          refreshToken: null,
          isLoading: false,
        });
        clearSession();
        void router.navigate(['/']);
      },
    };
  }),
);
