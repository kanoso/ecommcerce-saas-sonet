import { create } from 'zustand';
import Toast from 'react-native-toast-message';
import { supportService } from '@/services/support.service';
import type { FaqCategory, SupportTicket } from '@/types/support.types';

interface SupportState {
  faqs: FaqCategory[];
  tickets: SupportTicket[];
  isLoadingFaqs: boolean;
  isLoadingTickets: boolean;
  error: string | null;
  loadFaqs: () => Promise<void>;
  loadTickets: () => Promise<void>;
  reset: () => void;
}

export const useSupportStore = create<SupportState>()((set) => ({
  faqs: [],
  tickets: [],
  isLoadingFaqs: false,
  isLoadingTickets: false,
  error: null,

  loadFaqs: async () => {
    set({ isLoadingFaqs: true, error: null });
    try {
      const faqs = await supportService.getFaqs();
      set({ faqs, isLoadingFaqs: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando las preguntas frecuentes';
      set({ isLoadingFaqs: false, error: msg });
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: msg });
    }
  },

  loadTickets: async () => {
    set({ isLoadingTickets: true, error: null });
    try {
      const tickets = await supportService.getMyTickets();
      set({ tickets, isLoadingTickets: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando los tickets';
      set({ isLoadingTickets: false, error: msg });
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: msg });
    }
  },

  reset: () =>
    set({
      faqs: [],
      tickets: [],
      isLoadingFaqs: false,
      isLoadingTickets: false,
      error: null,
    }),
}));
