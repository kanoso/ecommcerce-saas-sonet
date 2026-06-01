import { useSupportStore } from '../support.store';
import type { FaqCategory, SupportTicket } from '@/types/support.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/services/support.service', () => ({
  supportService: {
    getFaqs: jest.fn(),
    getMyTickets: jest.fn(),
  },
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

import { supportService } from '@/services/support.service';
import Toast from 'react-native-toast-message';

const mockGetFaqs = (supportService as { getFaqs: jest.Mock }).getFaqs;
const mockGetTickets = (supportService as { getMyTickets: jest.Mock }).getMyTickets;
const mockToastShow = (Toast as unknown as { show: jest.Mock }).show;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFaqCategory(id: string): FaqCategory {
  return {
    id,
    category: 'DELIVERY',
    faqs: [
      { id: `${id}-faq-1`, question: 'How?', answer: 'Like this.', category: 'DELIVERY' },
    ],
  };
}

function makeTicket(id: string, overrides: Partial<SupportTicket> = {}): SupportTicket {
  return {
    id,
    type: 'DELIVERY_ISSUE',
    description: 'My package is missing',
    status: 'OPEN',
    evidenceUrl: null,
    contextBundle: null,
    createdAt: '2026-05-31T10:00:00.000Z',
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  faqs: [],
  tickets: [],
  isLoadingFaqs: false,
  isLoadingTickets: false,
  error: null,
};

beforeEach(() => {
  useSupportStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('faqs is an empty array', () => {
    expect(useSupportStore.getState().faqs).toEqual([]);
  });

  it('tickets is an empty array', () => {
    expect(useSupportStore.getState().tickets).toEqual([]);
  });

  it('isLoadingFaqs is false', () => {
    expect(useSupportStore.getState().isLoadingFaqs).toBe(false);
  });

  it('isLoadingTickets is false', () => {
    expect(useSupportStore.getState().isLoadingTickets).toBe(false);
  });

  it('error is null', () => {
    expect(useSupportStore.getState().error).toBeNull();
  });
});

// ─── loadFaqs — success ───────────────────────────────────────────────────────

describe('loadFaqs — success', () => {
  it('stores the returned faq categories in state', async () => {
    const faqs = [makeFaqCategory('cat-1'), makeFaqCategory('cat-2')];
    mockGetFaqs.mockResolvedValueOnce(faqs);

    await useSupportStore.getState().loadFaqs();

    expect(useSupportStore.getState().faqs).toEqual(faqs);
  });

  it('sets isLoadingFaqs to false after success', async () => {
    mockGetFaqs.mockResolvedValueOnce([]);
    await useSupportStore.getState().loadFaqs();
    expect(useSupportStore.getState().isLoadingFaqs).toBe(false);
  });

  it('clears error on success', async () => {
    useSupportStore.setState({ error: 'old error' });
    mockGetFaqs.mockResolvedValueOnce([]);
    await useSupportStore.getState().loadFaqs();
    expect(useSupportStore.getState().error).toBeNull();
  });

  it('does not show a toast on success', async () => {
    mockGetFaqs.mockResolvedValueOnce([]);
    await useSupportStore.getState().loadFaqs();
    expect(mockToastShow).not.toHaveBeenCalled();
  });
});

// ─── loadFaqs — error ─────────────────────────────────────────────────────────

describe('loadFaqs — error', () => {
  it('sets error message in state', async () => {
    mockGetFaqs.mockRejectedValueOnce(new Error('faq network error'));
    await useSupportStore.getState().loadFaqs();
    expect(useSupportStore.getState().error).toBe('faq network error');
  });

  it('shows a toast on error', async () => {
    mockGetFaqs.mockRejectedValueOnce(new Error('faq network error'));
    await useSupportStore.getState().loadFaqs();
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('sets isLoadingFaqs to false after error', async () => {
    mockGetFaqs.mockRejectedValueOnce(new Error('fail'));
    await useSupportStore.getState().loadFaqs();
    expect(useSupportStore.getState().isLoadingFaqs).toBe(false);
  });

  it('uses fallback message for non-Error rejections', async () => {
    mockGetFaqs.mockRejectedValueOnce('string rejection');
    await useSupportStore.getState().loadFaqs();
    expect(useSupportStore.getState().error).toBe('Error cargando las preguntas frecuentes');
  });
});

// ─── loadTickets — success ────────────────────────────────────────────────────

describe('loadTickets — success', () => {
  it('stores the returned tickets in state', async () => {
    const tickets = [makeTicket('tk-1'), makeTicket('tk-2')];
    mockGetTickets.mockResolvedValueOnce(tickets);

    await useSupportStore.getState().loadTickets();

    expect(useSupportStore.getState().tickets).toEqual(tickets);
  });

  it('sets isLoadingTickets to false after success', async () => {
    mockGetTickets.mockResolvedValueOnce([]);
    await useSupportStore.getState().loadTickets();
    expect(useSupportStore.getState().isLoadingTickets).toBe(false);
  });

  it('clears error on success', async () => {
    useSupportStore.setState({ error: 'old error' });
    mockGetTickets.mockResolvedValueOnce([]);
    await useSupportStore.getState().loadTickets();
    expect(useSupportStore.getState().error).toBeNull();
  });

  it('does not show a toast on success', async () => {
    mockGetTickets.mockResolvedValueOnce([]);
    await useSupportStore.getState().loadTickets();
    expect(mockToastShow).not.toHaveBeenCalled();
  });
});

// ─── loadTickets — error ──────────────────────────────────────────────────────

describe('loadTickets — error', () => {
  it('sets error message in state', async () => {
    mockGetTickets.mockRejectedValueOnce(new Error('ticket error'));
    await useSupportStore.getState().loadTickets();
    expect(useSupportStore.getState().error).toBe('ticket error');
  });

  it('shows a toast on error', async () => {
    mockGetTickets.mockRejectedValueOnce(new Error('ticket error'));
    await useSupportStore.getState().loadTickets();
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('sets isLoadingTickets to false after error', async () => {
    mockGetTickets.mockRejectedValueOnce(new Error('fail'));
    await useSupportStore.getState().loadTickets();
    expect(useSupportStore.getState().isLoadingTickets).toBe(false);
  });

  it('uses fallback message for non-Error rejections', async () => {
    mockGetTickets.mockRejectedValueOnce(42);
    await useSupportStore.getState().loadTickets();
    expect(useSupportStore.getState().error).toBe('Error cargando los tickets');
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('clears faqs', async () => {
    mockGetFaqs.mockResolvedValueOnce([makeFaqCategory('cat-1')]);
    await useSupportStore.getState().loadFaqs();
    useSupportStore.getState().reset();
    expect(useSupportStore.getState().faqs).toEqual([]);
  });

  it('clears tickets', async () => {
    mockGetTickets.mockResolvedValueOnce([makeTicket('tk-1')]);
    await useSupportStore.getState().loadTickets();
    useSupportStore.getState().reset();
    expect(useSupportStore.getState().tickets).toEqual([]);
  });

  it('clears error', () => {
    useSupportStore.setState({ error: 'some error' });
    useSupportStore.getState().reset();
    expect(useSupportStore.getState().error).toBeNull();
  });

  it('resets all loading flags to false', () => {
    useSupportStore.setState({ isLoadingFaqs: true, isLoadingTickets: true });
    useSupportStore.getState().reset();
    expect(useSupportStore.getState().isLoadingFaqs).toBe(false);
    expect(useSupportStore.getState().isLoadingTickets).toBe(false);
  });
});
