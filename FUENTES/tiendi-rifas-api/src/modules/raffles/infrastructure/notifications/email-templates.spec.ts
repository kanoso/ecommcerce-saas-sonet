import { templates } from './email-templates';

const WEB = 'https://rifas.example.pe';
const RAFFLE_ID = '3f8e2a40-6c1b-4f3e-9d2a-7b5c1e0f9a11';
const COMMITMENT = 'a'.repeat(64);

const confirmation = {
  orderId: 'order-1',
  raffleId: RAFFLE_ID,
  raffleTitle: 'Moto 0 km',
  numbers: [7, 21],
  totalAmount: 40,
  verification: {
    commitmentHash: COMMITMENT,
    drandRound: '24680135',
    drawAt: '2026-11-16T01:30:00.000Z',
    salesCloseAt: '2026-11-15T23:00:00.000Z',
  },
};

describe('templates.ticketConfirmation, the payment-approved email', () => {
  it('carries the data to verify the draw: commitment, round, draw date and link', () => {
    const { body } = templates.ticketConfirmation(confirmation, WEB);

    const section = body.slice(body.indexOf('Datos para verificar tu sorteo'));
    expect(section).toContain('Datos para verificar tu sorteo');
    expect(section).toContain(`Compromiso (SHA-256 de la semilla): ${COMMITMENT}`);
    expect(section).toContain('Ronda de drand: #24680135');
    // 01:30 UTC is 20:30 of the day before in Lima (UTC-5).
    expect(section).toContain('Fecha del sorteo: 15 nov. 2026, 20:30:00 (hora de Lima)');
    expect(section).toContain('Fecha del sorteo (ISO 8601): 2026-11-16T01:30:00.000Z');
    expect(section).toContain('Cierre de ventas: 15 nov. 2026, 18:00:00 (hora de Lima)');
    expect(section).toContain('Cierre de ventas (ISO 8601): 2026-11-15T23:00:00.000Z');
    expect(section).toContain(`${WEB}/rifas/${RAFFLE_ID}/verificacion`);
  });

  it('is plain text: no markup anywhere', () => {
    const { body, title } = templates.ticketConfirmation(confirmation, WEB);

    expect(`${title}${body}`).not.toMatch(/<[a-z/][^>]*>/i);
  });

  it('builds the link with a single slash after a base URL that ends in one', () => {
    const { body } = templates.ticketConfirmation(confirmation, `${WEB}/`);

    expect(body).toContain(`${WEB}/rifas/${RAFFLE_ID}/verificacion`);
    expect(body).not.toContain(`${WEB}//rifas`);
  });

  it('keeps the whole verification section when the list of numbers is long', () => {
    const numbers = Array.from({ length: 2000 }, (_, i) => i + 1);

    const { body } = templates.ticketConfirmation({ ...confirmation, numbers }, WEB);

    expect(body.length).toBeLessThanOrEqual(2000);
    expect(body).toContain(COMMITMENT);
    expect(body).toContain(`${WEB}/rifas/${RAFFLE_ID}/verificacion`);
    expect(body).toMatch(/ y \d+ más/);
  });

  it('leaves the section out of an email queued before it existed', () => {
    const { verification: _omitted, ...queuedBefore } = confirmation;

    const { body } = templates.ticketConfirmation(queuedBefore, WEB);

    expect(body).not.toContain('Datos para verificar tu sorteo');
    expect(body).toContain('7, 21');
  });
});
