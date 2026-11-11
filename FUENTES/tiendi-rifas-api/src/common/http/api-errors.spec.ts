import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as domainErrors from '../../modules/raffles/domain/errors/domain.errors';
import { DomainError } from '../../modules/raffles/domain/errors/domain.errors';
import { BeaconRoundUnavailableError } from '../../modules/raffles/application/ports';
import { API_ERRORS, apiErrorOf, ValidationFailedError } from './api-errors';

describe('API error table (F6)', () => {
  const domainClasses = Object.entries(domainErrors).filter(
    ([name, value]) =>
      typeof value === 'function' &&
      value.prototype instanceof DomainError &&
      name !== 'DomainError',
  );

  it('maps every domain error to an HTTP status and a stable code', () => {
    const missing = domainClasses
      .map(([name]) => name)
      .filter((name) => !(name in API_ERRORS));

    expect(missing).toEqual([]);
  });

  it('has no dead rows: each one names a domain or auth error that exists', () => {
    const known = new Set([...domainClasses.map(([name]) => name), 'InvalidMagicLinkError']);

    expect(Object.keys(API_ERRORS).filter((name) => !known.has(name))).toEqual([]);
  });

  it('uses each code once, in upper snake case, except the hidden order', () => {
    const codes = Object.entries(API_ERRORS)
      .filter(([name]) => name !== 'NotOrderOwnerError')
      .map(([, e]) => e.code);

    expect(new Set(codes).size).toBe(codes.length);
    codes.forEach((code) => expect(code).toMatch(/^[A-Z][A-Z0-9_]+$/));
  });

  it('uses only client and conflict statuses for domain errors, never 500', () => {
    Object.values(API_ERRORS).forEach(({ status }) => {
      expect([400, 401, 403, 404, 409, 422, 429, 503]).toContain(status);
    });
  });

  it.each([
    ['TicketNotAvailableError', 409, 'TICKETS_UNAVAILABLE'],
    ['TicketReservationLimitError', 409, 'RESERVATION_LIMIT'],
    ['RaffleNotActiveError', 409, 'RAFFLE_NOT_ACTIVE'],
    ['RaffleNotFoundError', 404, 'RAFFLE_NOT_FOUND'],
    ['OrderNotFoundError', 404, 'ORDER_NOT_FOUND'],
    ['NotOrderOwnerError', 404, 'ORDER_NOT_FOUND'],
    ['MissingRaffleDataError', 409, 'RAFFLE_DATA_MISSING'],
    ['SameOperatorRefundError', 409, 'SAME_OPERATOR_REFUND'],
    ['InvalidOperatorIdError', 403, 'INVALID_OPERATOR_ID'],
  ])('maps %s to %i %s', (name, status, code) => {
    expect(API_ERRORS[name]).toEqual({ status, code });
  });

  it('turns a domain error into its row, keeping its message', () => {
    const error = new domainErrors.RaffleNotFoundError('raffle-1');

    expect(apiErrorOf(error)).toEqual({
      status: 404,
      body: { code: 'RAFFLE_NOT_FOUND', message: error.message },
    });
  });

  it('hides another owner\'s order behind the same answer as a missing one', () => {
    expect(apiErrorOf(new domainErrors.NotOrderOwnerError('order-1'))).toEqual(
      apiErrorOf(new domainErrors.OrderNotFoundError('order-1')),
    );
  });

  it('answers 503 when drand cannot be reached', () => {
    expect(apiErrorOf(new BeaconRoundUnavailableError(1n)).status).toBe(503);
  });

  it('carries validation details', () => {
    const answer = apiErrorOf(
      new ValidationFailedError([{ path: 'numeros', message: 'Required' }]),
    );

    expect(answer).toEqual({
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        message: 'The request is not valid',
        details: [{ path: 'numeros', message: 'Required' }],
      },
    });
  });

  it('lists the requested numbers that were not available, and nothing else', () => {
    const answer = apiErrorOf(new domainErrors.TicketNotAvailableError([9, 7, 9]));

    expect(answer).toEqual({
      status: 409,
      body: {
        code: 'TICKETS_UNAVAILABLE',
        message: expect.any(String),
        details: { numeros_no_disponibles: [7, 9] },
      },
    });
  });

  it('keeps the status of a Nest HTTP exception, with a code from it', () => {
    expect(apiErrorOf(new NotFoundException()).body.code).toBe('NOT_FOUND');
    expect(apiErrorOf(new BadRequestException()).status).toBe(400);
  });

  it('answers an unknown error with 500 and no internal message', () => {
    const answer = apiErrorOf(new Error('connection to db at 10.0.0.5 lost'));

    expect(answer).toEqual({
      status: 500,
      body: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
    });
  });
});
