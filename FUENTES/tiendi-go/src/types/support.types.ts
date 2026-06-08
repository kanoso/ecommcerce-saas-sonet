export type FaqCategoryEnum =
  | 'GETTING_STARTED'
  | 'DELIVERY_FLOW'
  | 'EARNINGS_PAYMENTS'
  | 'COMMON_PROBLEMS'
  | 'ACCOUNT_PROFILE'
  | 'SCORING_LEVELS'
  | 'LEGAL';

export type TicketCategory =
  | 'DELIVERY_ISSUE'
  | 'PAYMENT_DISPUTE'
  | 'ACCOUNT_PROBLEM'
  | 'DOCUMENT_UPDATE'
  | 'GENERAL_QUESTION'
  | 'INCIDENT_ESCALATION';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: FaqCategoryEnum;
}

export interface FaqCategory {
  id: string;
  category: FaqCategoryEnum;
  faqs: Faq[];
}

export interface SupportTicket {
  id: string;
  category: TicketCategory;
  description: string;
  status: TicketStatus;
  attachmentUrl?: string | null;
  contextBundle?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTicketPayload {
  category: TicketCategory;
  description: string;
  attachmentUrl?: string;
  contextBundle?: Record<string, unknown>;
}

export const FAQ_CATEGORY_LABELS: Record<FaqCategoryEnum, string> = {
  GETTING_STARTED: 'Primeros pasos',
  DELIVERY_FLOW: 'Flujo de entrega',
  EARNINGS_PAYMENTS: 'Ganancias y pagos',
  COMMON_PROBLEMS: 'Problemas frecuentes',
  ACCOUNT_PROFILE: 'Cuenta y perfil',
  SCORING_LEVELS: 'Puntaje y niveles',
  LEGAL: 'Legal',
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  DELIVERY_ISSUE: 'Problema con entrega',
  PAYMENT_DISPUTE: 'Disputa de pago',
  ACCOUNT_PROBLEM: 'Problema con cuenta',
  DOCUMENT_UPDATE: 'Actualización de documentos',
  GENERAL_QUESTION: 'Consulta general',
  INCIDENT_ESCALATION: 'Escalación de incidente',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En curso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};
