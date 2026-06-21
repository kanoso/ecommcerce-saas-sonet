import { create } from 'zustand';
import Toast from 'react-native-toast-message';
import { storeInvitationService, InvitationResolvedError } from '@/services/store-invitation.service';
import type { StoreInvitationState } from '@/types/store-invitation.types';

export const INITIAL_STATE: Pick<StoreInvitationState, 'invitation' | 'acting'> = {
  invitation: null,
  acting: 'idle',
};

export const useStoreInvitationStore = create<StoreInvitationState>()((set, get) => ({
  ...INITIAL_STATE,

  setInvitation: (invitation) => set({ invitation }),

  clearInvitation: () => set({ invitation: null, acting: 'idle' }),

  accept: async () => {
    const { invitation, acting } = get();
    if (acting !== 'idle' || !invitation) return;

    set({ acting: 'accept' });
    try {
      await storeInvitationService.respond(invitation.storeId, true);
      set({ invitation: null, acting: 'idle' });
    } catch (err) {
      if (err instanceof InvitationResolvedError) {
        set({ invitation: null, acting: 'idle' });
        return;
      }
      set({ acting: 'idle' });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo aceptar la invitación. Intentá nuevamente.',
      });
    }
  },

  reject: async () => {
    const { invitation, acting } = get();
    if (acting !== 'idle' || !invitation) return;

    set({ acting: 'reject' });
    try {
      await storeInvitationService.respond(invitation.storeId, false);
      set({ invitation: null, acting: 'idle' });
    } catch (err) {
      if (err instanceof InvitationResolvedError) {
        set({ invitation: null, acting: 'idle' });
        return;
      }
      set({ acting: 'idle' });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo rechazar la invitación. Intentá nuevamente.',
      });
    }
  },
}));
