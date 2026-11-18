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
    winnerExclusionMode: 'TICKET_ONLY',
    winningAttempt: 2,
    prizeCount: 1,
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

  it('carries the prize count and the winning attempt, but no exclusion mode for a single prize', () => {
    const { body } = templates.ticketConfirmation(confirmation, WEB);

    const section = body.slice(body.indexOf('Datos para verificar tu sorteo'));
    expect(section).toContain('Cantidad de premios: 1');
    expect(section).toContain('Intento ganador: 2');
    expect(section).not.toContain('Modo de exclusión');
  });

  it.each([
    ['TICKET_ONLY', 'Modo de exclusión al momento de tu pago: TICKET_ONLY (solo el boleto ganador)'],
    ['BUYER', 'Modo de exclusión al momento de tu pago: BUYER (todos los boletos del comprador ganador)'],
  ])('names the %s exclusion mode of a multi-prize raffle and says it may change until the close', (mode, line) => {
    const { body } = templates.ticketConfirmation(
      {
        ...confirmation,
        verification: { ...confirmation.verification, winnerExclusionMode: mode, prizeCount: 3 },
      },
      WEB,
    );

    const section = body.slice(body.indexOf('Datos para verificar tu sorteo'));
    expect(section).toContain('Cantidad de premios: 3');
    expect(section).toContain(line);
    expect(section).toContain(
      'El modo de exclusión puede cambiar hasta el cierre de ventas; la página de verificación muestra el que quedó fijado al cierre.',
    );
  });

  it('keeps the whole section of a multi-prize raffle within the body limit', () => {
    const numbers = Array.from({ length: 2000 }, (_, i) => i + 1);
    const verification = { ...confirmation.verification, winnerExclusionMode: 'BUYER', prizeCount: 20 };

    const { body } = templates.ticketConfirmation({ ...confirmation, numbers, verification }, WEB);

    expect(body.length).toBeLessThanOrEqual(2000);
    expect(body).toContain('Cantidad de premios: 20');
    expect(body).toContain(`${WEB}/rifas/${RAFFLE_ID}/verificacion`);
  });

  it('leaves the new lines out of an anchor queued before they existed', () => {
    const { winnerExclusionMode: _m, winningAttempt: _a, prizeCount: _p, ...older } =
      confirmation.verification;

    const { body } = templates.ticketConfirmation({ ...confirmation, verification: older }, WEB);

    expect(body).toContain(`Compromiso (SHA-256 de la semilla): ${COMMITMENT}`);
    expect(body).not.toContain('Cantidad de premios');
    expect(body).not.toContain('Intento ganador');
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

describe('templates.winner', () => {
  const single = { raffleTitle: 'Moto 0 km', winningNumber: 21, prize: 'Moto 150cc' };

  it('keeps the single-prize email as it was', () => {
    const { title, body } = templates.winner(single);

    expect(title).toBe('¡Ganaste Moto 0 km!');
    expect(body).toContain('Tu número 21 ganó el sorteo de Moto 0 km.');
    expect(body).toContain('Premio: Moto 150cc');
  });

  it('names the prize and its position in a multi-prize draw', () => {
    const { title, body } = templates.winner({
      ...single,
      prize: 'Bicicleta',
      prizePosition: 2,
      prizeCount: 3,
    });

    expect(title).toBe('¡Ganaste el 2.º premio de Moto 0 km!');
    expect(body).toContain('Tu número 21 ganó el 2.º premio (de 3) del sorteo de Moto 0 km.');
    expect(body).toContain('Premio: Bicicleta');
    expect(`${title}${body}`).not.toMatch(/<[a-z/][^>]*>/i);
  });
});
