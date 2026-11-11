/**
 * Plain-text emails in neutral Spanish. tiendi-notifications strips HTML from
 * every string, so nothing here is markup. The reasons are already safe for
 * the buyer: fixed texts on extra transfers and cancels (DT-16), and the
 * operator's own words on a rejection, which the buyer must read (DT-08).
 */
import type { DrawAnchor, PaymentAccountSummary } from '../../application/ports';

export interface EmailContent {
  eventType: string;
  category: string;
  title: string;
  body: string;
}

const MAX_TITLE = 200;
const MAX_BODY = 2000;
const SIGNATURE = '\n\nEquipo de Rifas Tiendi';

function money(amount: number): string {
  return `S/ ${amount.toFixed(2)}`;
}

/** Long lists are cut so the whole email stays within the service limit. */
function numberList(numbers: number[], limit = 1200): string {
  const all = numbers.join(', ');
  if (all.length <= limit) {
    return all;
  }
  const shown: number[] = [];
  let length = 0;
  for (const n of numbers) {
    length += String(n).length + 2;
    if (length > limit - 100) {
      break;
    }
    shown.push(n);
  }
  return `${shown.join(', ')} y ${numbers.length - shown.length} más`;
}

function email(
  eventType: string,
  category: string,
  title: string,
  lines: string[],
): EmailContent {
  const body = `${lines.join('\n')}${SIGNATURE}`;
  return {
    eventType,
    category,
    title: title.slice(0, MAX_TITLE),
    body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 1)}…` : body,
  };
}

const limaDateTime = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'America/Lima',
});

/** "Datos para verificar tu sorteo": public values only, nothing about the buyer. */
function anchorLines(raffleId: string, anchor: DrawAnchor, webBaseUrl: string): string[] {
  const base = webBaseUrl.replace(/\/+$/, '');
  return [
    '',
    'Datos para verificar tu sorteo',
    `Compromiso (SHA-256 de la semilla): ${anchor.commitmentHash}`,
    `Ronda de drand: #${anchor.drandRound}`,
    `Fecha del sorteo: ${limaDateTime.format(new Date(anchor.drawAt))} (hora de Lima)`,
    `Fecha del sorteo (ISO 8601): ${anchor.drawAt}`,
    ...(anchor.salesCloseAt
      ? [
          `Cierre de ventas: ${limaDateTime.format(new Date(anchor.salesCloseAt))} (hora de Lima)`,
          `Cierre de ventas (ISO 8601): ${anchor.salesCloseAt}`,
        ]
      : []),
    `Verifica el sorteo en: ${base}/rifas/${encodeURIComponent(raffleId)}/verificacion`,
    'Si estos datos no coinciden con los de la página de verificación, el sorteo no es confiable.',
  ];
}

const ACCOUNT_ACTIONS: Record<string, string> = {
  PROPOSED: 'propuso un cambio en',
  APPROVED: 'aprobó un cambio en',
  REJECTED: 'rechazó un cambio en',
  CANCELLED: 'canceló un cambio en',
  DEACTIVATED: 'desactivó',
  REORDERED: 'reordenó',
};

const CHANGE_KINDS: Record<string, string> = {
  CREATE: 'crear la cuenta',
  UPDATE: 'cambiar los datos de la cuenta',
  ACTIVATE: 'volver a activar la cuenta',
};

/** Only the last digits: the email must not carry the whole account. */
function accountLine(label: string, account: PaymentAccountSummary | null): string {
  if (!account) {
    return `${label}: no existía`;
  }
  const cci = account.cciEnding ? `, CCI terminado en ${account.cciEnding}` : '';
  const state = account.active === null ? '' : account.active ? ', activa' : ', inactiva';
  return `${label}: ${account.method}, titular ${account.holderName}, número terminado en ${account.numberEnding}${cci}${state}`;
}

export const templates = {
  /**
   * The buyer's copy of what the raffle committed to (DT-20): it arrives
   * out of band, so a later change on the platform cannot rewrite it.
   */
  ticketConfirmation(
    data: {
      raffleId: string;
      raffleTitle: string;
      numbers: number[];
      totalAmount: number;
      orderId: string;
      verification?: DrawAnchor;
    },
    webBaseUrl: string,
  ): EmailContent {
    const anchor = data.verification
      ? anchorLines(data.raffleId, data.verification, webBaseUrl)
      : [];
    return email(
      'raffle.ticket-confirmed',
      'raffle-tickets',
      `Tus boletos de ${data.raffleTitle}`,
      [
        'Hola:',
        '',
        `Confirmamos tu pago de ${money(data.totalAmount)}. Estos son tus números en ${data.raffleTitle}:`,
        // A shorter list leaves room for the anchor within the body limit.
        numberList(data.numbers, anchor.length > 0 ? 600 : 1200),
        '',
        `Número de orden: ${data.orderId}`,
        'Guarda este correo: es tu comprobante de participación.',
        ...anchor,
      ],
    );
  },

  paymentRejected(data: {
    raffleTitle: string;
    reason: string;
    orderId: string;
  }): EmailContent {
    return email(
      'raffle.payment-rejected',
      'raffle-payments',
      `No pudimos aceptar tu pago en ${data.raffleTitle}`,
      [
        'Hola:',
        '',
        `Revisamos tu comprobante de la orden ${data.orderId} y no pudimos aceptarlo.`,
        `Motivo: ${data.reason}`,
        '',
        'Los números de esa orden quedaron libres. Si crees que es un error, responde con el número de orden.',
      ],
    );
  },

  paymentUnderReview(data: {
    raffleTitle: string;
    reason: string;
    orderId: string;
  }): EmailContent {
    return email(
      'raffle.payment-under-review',
      'raffle-payments',
      `Estamos revisando tu pago en ${data.raffleTitle}`,
      [
        'Hola:',
        '',
        `Tu pago de la orden ${data.orderId} quedó en revisión.`,
        data.reason,
        '',
        'Un operador comprobará si el dinero llegó y te escribiremos con la respuesta.',
      ],
    );
  },

  refundPending(data: {
    raffleTitle: string;
    amount: number;
    reason: string;
    orderId: string;
  }): EmailContent {
    return email(
      'raffle.refund-pending',
      'raffle-refunds',
      `Vamos a devolverte ${money(data.amount)}`,
      [
        'Hola:',
        '',
        `Abrimos la devolución de ${money(data.amount)} de tu orden ${data.orderId} en ${data.raffleTitle}.`,
        `Motivo: ${data.reason}`,
        '',
        'Te avisaremos cuando la transferencia esté hecha.',
      ],
    );
  },

  refundCompleted(data: {
    raffleTitle: string;
    amount: number;
    orderId: string;
  }): EmailContent {
    return email(
      'raffle.refund-completed',
      'raffle-refunds',
      `Te devolvimos ${money(data.amount)}`,
      [
        'Hola:',
        '',
        `Transferimos ${money(data.amount)} de tu orden ${data.orderId} en ${data.raffleTitle}.`,
        'Revisa tu cuenta o billetera. Si no ves el dinero en 48 horas, responde a este correo.',
      ],
    );
  },

  winner(data: {
    raffleTitle: string;
    winningNumber: number;
    prize: string;
  }): EmailContent {
    return email(
      'raffle.winner',
      'raffle-draws',
      `¡Ganaste ${data.raffleTitle}!`,
      [
        'Hola:',
        '',
        `Tu número ${data.winningNumber} ganó el sorteo de ${data.raffleTitle}.`,
        `Premio: ${data.prize}`,
        '',
        'Te contactaremos para coordinar la entrega. Puedes verificar el sorteo en la página pública de la rifa.',
      ],
    );
  },

  verificationOverdue(data: {
    raffleTitle: string;
    orderId: string;
    numbers: number[];
    declaredAmount: number | null;
    dueAt: Date;
  }): EmailContent {
    return email(
      'raffle.verification-overdue',
      'raffle-operations',
      `Comprobante sin revisar en ${data.raffleTitle}`,
      [
        `La orden ${data.orderId} venció su plazo de revisión el ${data.dueAt.toISOString()}.`,
        `Números: ${numberList(data.numbers)}`,
        `Monto declarado: ${data.declaredAmount === null ? 'sin declarar' : money(data.declaredAmount)}`,
        '',
        'Los números siguen retenidos. Apruébala o recházala desde el panel.',
      ],
    );
  },

  paymentAccountChanged(data: {
    action: string;
    changeId: string | null;
    kind: string | null;
    operatorId: string;
    occurredAt: string;
    accountId: string;
    before: PaymentAccountSummary | null;
    after: PaymentAccountSummary | null;
  }): EmailContent {
    const verb = ACCOUNT_ACTIONS[data.action] ?? 'cambió';
    const method = data.after?.method ?? data.before?.method ?? '';
    const change = data.changeId
      ? [`Solicitud ${data.changeId}: ${CHANGE_KINDS[data.kind ?? ''] ?? 'cambio'}.`]
      : [];
    const waiting =
      data.action === 'PROPOSED'
        ? ['Nada cambia para los compradores hasta que otro operador lo apruebe desde el panel.']
        : [];
    return email(
      'raffle.payment-account-changed',
      'raffle-operations',
      `Se ${verb} una cuenta de pago (${method})`,
      [
        `El operador ${data.operatorId} ${verb} la cuenta de pago ${data.accountId} el ${data.occurredAt}.`,
        ...change,
        accountLine('Antes', data.before),
        accountLine(data.action === 'PROPOSED' ? 'Propuesto' : 'Ahora', data.after),
        ...waiting,
        '',
        'Los compradores transfieren a estas cuentas. Si no reconoces el cambio, recházalo o desactiva la cuenta en el panel y cierra las sesiones de ese operador.',
      ],
    );
  },

  magicLink(data: { link: string; expiresInMinutes: number }): EmailContent {
    return email('raffle.access-link', 'raffle-access', 'Tu enlace de acceso', [
      'Hola:',
      '',
      'Usa este enlace para entrar a Rifas Tiendi:',
      data.link,
      '',
      `Vence en ${data.expiresInMinutes} minutos y sirve una sola vez. Si no lo pediste, ignora este correo.`,
    ]);
  },
};
