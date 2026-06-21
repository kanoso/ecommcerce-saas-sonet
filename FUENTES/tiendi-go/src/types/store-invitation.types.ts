// Types for the store invitation feature (push-driven overlay).
// An invitation is ephemeral — no persistence, no expiry timer.

export interface StoreInvitation {
  storeId: string;
  storeName: string;
  storeLogoUrl: string | null;
}

export interface StoreInvitationState {
  invitation: StoreInvitation | null;
  /** Discriminated acting flag: 'idle' | 'accept' | 'reject'. */
  acting: 'idle' | 'accept' | 'reject';
  setInvitation: (invitation: StoreInvitation) => void;
  clearInvitation: () => void;
  accept: () => Promise<void>;
  reject: () => Promise<void>;
}

export const INITIAL_STATE: Pick<StoreInvitationState, 'invitation' | 'acting'> = {
  invitation: null,
  acting: 'idle',
};
