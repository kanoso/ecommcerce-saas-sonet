import { api } from '@/services/api';
import type { FaqCategory, FaqCategoryEnum, SupportTicket, CreateTicketPayload, TicketStatus } from '@/types/support.types';

interface RawFaq {
  id: string;
  category: FaqCategoryEnum;
  question: string;
  answer: string;
}

export const supportService = {
  async getFaqs(): Promise<FaqCategory[]> {
    const { data } = await api.get<unknown>('/support/faqs');
    const raw = (Array.isArray(data) ? data : []) as RawFaq[];

    const grouped = new Map<FaqCategoryEnum, RawFaq[]>();
    for (const faq of raw) {
      const list = grouped.get(faq.category) ?? [];
      list.push(faq);
      grouped.set(faq.category, list);
    }

    return Array.from(grouped.entries()).map(([category, faqs]) => ({
      id: category,
      category,
      faqs,
    }));
  },

  async createTicket(
    payload: CreateTicketPayload,
  ): Promise<{ ticketId: string; priority: string; estimatedResponseTime: string }> {
    const { data } = await api.post('/support/tickets', {
      category: payload.category,
      description: payload.description,
      attachmentUrl: payload.attachmentUrl,
      contextBundle: payload.contextBundle,
    });
    return data;
  },

  async getMyTickets(): Promise<SupportTicket[]> {
    const { data } = await api.get<unknown>('/support/tickets');
    const raw = (data as Record<string, unknown>);
    const items = (raw?.['items'] ?? raw?.['data'] ?? []) as SupportTicket[];
    return items;
  },
};
