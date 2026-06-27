import { inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';
import { AnalyticsService } from '../../core/services/analytics.service';

const API = environment.apiUrl;

export type StaffRole = 'STORE_OWNER' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE' | 'EMPLOYEE';
export type StaffStatus = 'ACTIVE' | 'PENDING';

export interface StaffMember {
  id: string;
  userId: string | null;
  role: StaffRole;
  status: StaffStatus;
  email: string;
  name: string;
  initials: string;
}

interface StaffState {
  members: StaffMember[];
  maxSlots: number;
  usedSlots: number;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
}

export const StaffStore = signalStore(
  { providedIn: 'root' },
  withState<StaffState>({
    members: [],
    maxSlots: 5,
    usedSlots: 0,
    isLoading: false,
    isSaving: false,
    error: null,
    successMessage: null,
  }),
  withComputed((store) => ({
    activeMembers:  computed(() => store.members().filter((m) => m.status === 'ACTIVE')),
    pendingMembers: computed(() => store.members().filter((m) => m.status === 'PENDING')),
    slotsAvailable: computed(() => store.maxSlots() - store.usedSlots()),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const authStore = inject(AuthStore);
    const analytics = inject(AnalyticsService);

    function storeId(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    function showSuccess(msg: string): void {
      patchState(store, { successMessage: msg });
      setTimeout(() => patchState(store, { successMessage: null }), 3000);
    }

    return {
      async loadStaff(): Promise<void> {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isLoading: true, error: null });
        try {
          const data = await firstValueFrom(
            http.get<{ members: StaffMember[]; maxSlots: number; usedSlots: number }>(
              `${API}/stores/${sid}/employees`
            )
          );
          patchState(store, { ...data, isLoading: false });
        } catch (err: unknown) {
          patchState(store, { isLoading: false, error: err instanceof Error ? err.message : 'Error al cargar el equipo' });
        }
      },

      async inviteMember(email: string, role: StaffRole): Promise<void> {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isSaving: true });
        try {
          const member = await firstValueFrom(
            http.post<StaffMember>(`${API}/stores/${sid}/employees/invite`, { email, role })
          );
          patchState(store, {
            members: [...store.members(), member],
            usedSlots: store.usedSlots() + 1,
            isSaving: false,
          });
          analytics.capture('staff_invited', { role });
          showSuccess(`Invitación enviada a ${email}`);
        } catch (err: unknown) {
          const httpErr = err as { error?: { message?: string }; status?: number };
          const msg = httpErr?.error?.message ?? (err instanceof Error ? err.message : 'Error al invitar');
          const isConflict = httpErr?.status === 409;
          patchState(store, { isSaving: false, error: isConflict ? 'Este email ya fue invitado' : msg });
        }
      },

      async changeRole(id: string, role: StaffRole): Promise<void> {
        patchState(store, { isSaving: true });
        try {
          await firstValueFrom(http.put(`${API}/employees/${id}/role`, { role }));
          patchState(store, {
            members: store.members().map((m) => m.id === id ? { ...m, role } : m),
            isSaving: false,
          });
          showSuccess('Rol actualizado');
        } catch (err: unknown) {
          patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al cambiar rol' });
        }
      },

      async removeMember(id: string): Promise<void> {
        const member = store.members().find((m) => m.id === id);
        patchState(store, { isSaving: true });
        try {
          await firstValueFrom(http.delete(`${API}/employees/${id}`));
          patchState(store, {
            members: store.members().filter((m) => m.id !== id),
            usedSlots: Math.max(0, store.usedSlots() - 1),
            isSaving: false,
          });
          showSuccess(`${member?.name ?? 'Miembro'} eliminado del equipo`);
        } catch (err: unknown) {
          patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al eliminar' });
        }
      },

      async resendInvite(email: string): Promise<void> {
        const member = store.members().find((m) => m.email === email);
        try {
          if (member) await firstValueFrom(http.post(`${API}/employees/${member.id}/resend-invite`, {}));
        } finally {
          showSuccess(`Invitación reenviada a ${email}`);
        }
      },
    };
  }),
);
