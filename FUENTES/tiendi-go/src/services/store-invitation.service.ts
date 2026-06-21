import axios from 'axios';
import { api } from './api';

/**
 * Thrown when the backend returns 404 on a respond call.
 * Semantics: the invitation was already resolved elsewhere — treat as silent success.
 */
export class InvitationResolvedError extends Error {
  constructor() {
    super('Invitation already resolved');
    this.name = 'InvitationResolvedError';
  }
}

export const storeInvitationService = {
  /**
   * POST /riders/me/invitations/:storeId/respond
   *   body: { accept: boolean }
   *
   * 200 → resolves (no return value)
   * 404 → throws InvitationResolvedError (already resolved elsewhere)
   * other errors → re-throws original error
   */
  async respond(storeId: string, accept: boolean): Promise<void> {
    try {
      await api.post(`/riders/me/invitations/${storeId}/respond`, { accept });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        throw new InvitationResolvedError();
      }
      throw err;
    }
  },
};
