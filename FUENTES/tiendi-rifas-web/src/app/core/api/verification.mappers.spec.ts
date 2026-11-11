import { VerificationDataDto } from './api.dto';
import { toLiveRaffleData, toRaffleStatusInfo, toVerificationData } from './api.mappers';

const dto: VerificationDataDto = {
  rifa_id: 'a0b1c2d3-e4f5-4678-9abc-def012345678',
  titulo: 'Smart TV 55"',
  premio: 'Un televisor',
  version_algoritmo: 'v1',
  resolucion_autorizacion: 'RD-123-2026',
  estado: 'DRAWN',
  hash_compromiso: 'c'.repeat(64),
  semilla_revelada: 's'.repeat(64),
  hash_cadena_drand: 'd'.repeat(64),
  ronda_drand: '1000000',
  fecha_sorteo: '2023-09-27T08:29:24.000Z',
  cierre_ventas: '2023-09-27T08:00:00.000Z',
  aleatoriedad_drand: 'r'.repeat(64),
  hash_lista: 'l'.repeat(64),
  lista_verificada: true,
  numeros_vendidos: [10, 20, 30],
  indice_ganador: 1,
  numero_ganador: 20,
  digest_hex: 'e'.repeat(64),
  ejecutado_en: '2026-11-16T01:30:03.000Z',
};

describe('toVerificationData', () => {
  it('maps the frozen data and the official result', () => {
    expect(toVerificationData(dto)).toEqual({
      raffleId: dto.rifa_id,
      title: 'Smart TV 55"',
      prize: 'Un televisor',
      algorithmVersion: 'v1',
      authorizationResolution: 'RD-123-2026',
      status: 'DRAWN',
      commitmentHash: 'c'.repeat(64),
      seedRevealed: 's'.repeat(64),
      drandChainHash: 'd'.repeat(64),
      drandRound: '1000000',
      drawAt: new Date('2023-09-27T08:29:24.000Z'),
      salesCloseAt: new Date('2023-09-27T08:00:00.000Z'),
      soldListHash: 'l'.repeat(64),
      soldListVerified: true,
      soldNumbers: [10, 20, 30],
      winningAttempt: 1,
      extractions: [],
      official: {
        drandRandomness: 'r'.repeat(64),
        winnerIndex: 1,
        winningNumber: 20,
        digestHex: 'e'.repeat(64),
        executedAt: new Date('2026-11-16T01:30:03.000Z'),
      },
    });
  });

  it('treats anything but an explicit true as an unverified list (DT-11)', () => {
    const loose = { ...dto, lista_verificada: 'true' } as unknown as VerificationDataDto;
    expect(toVerificationData(loose).soldListVerified).toBe(false);
    const missing = { ...dto } as Partial<VerificationDataDto>;
    delete missing.lista_verificada;
    expect(toVerificationData(missing as VerificationDataDto).soldListVerified).toBe(false);
  });

  it('treats a missing or unreadable draw date as unknown', () => {
    expect(toVerificationData({ ...dto, fecha_sorteo: '' }).drawAt).toBeNull();
    expect(toVerificationData({ ...dto, fecha_sorteo: 'mañana' }).drawAt).toBeNull();
    expect(toVerificationData({ ...dto, cierre_ventas: '' }).salesCloseAt).toBeNull();
  });

  it('treats a blank resolution as missing', () => {
    expect(toVerificationData({ ...dto, resolucion_autorizacion: '' }).authorizationResolution).toBeNull();
  });
});

describe('toRaffleStatusInfo', () => {
  it('keeps the title and the status of the live data', () => {
    expect(
      toRaffleStatusInfo({
        rifa_id: 'r-1',
        titulo: 'Moto',
        estado: 'CANCELLED',
        hash_compromiso: null,
        hash_cadena_drand: null,
        ronda_drand: null,
        cierre_ventas: null,
        fecha_sorteo: null,
        hash_lista: null,
        semilla_revelada: null,
        numeros_vendidos: null,
        resultado: null,
      }),
    ).toEqual({ title: 'Moto', status: 'CANCELLED' });
  });
});


describe('toLiveRaffleData', () => {
  it('maps the full live data with official result', () => {
    const liveDto = {
      rifa_id: 'r-1',
      titulo: 'Smart TV 55"',
      estado: 'DRAWN' as const,
      hash_compromiso: 'c'.repeat(64),
      hash_cadena_drand: 'd'.repeat(64),
      ronda_drand: '1000000',
      cierre_ventas: '2023-09-27T08:00:00.000Z',
      fecha_sorteo: '2023-09-27T08:29:24.000Z',
      hash_lista: 'l'.repeat(64),
      semilla_revelada: 's'.repeat(64),
      numeros_vendidos: [10, 20, 30],
      resultado: {
        numero_ganador: 20,
        indice_ganador: 1,
        digest_hex: 'e'.repeat(64),
        aleatoriedad_drand: 'r'.repeat(64),
        ejecutado_en: '2026-11-16T01:30:03.000Z',
      },
    };
    expect(toLiveRaffleData(liveDto)).toEqual({
      raffleId: 'r-1',
      title: 'Smart TV 55"',
      status: 'DRAWN',
      commitmentHash: 'c'.repeat(64),
      drandChainHash: 'd'.repeat(64),
      drandRound: '1000000',
      salesCloseAt: new Date('2023-09-27T08:00:00.000Z'),
      drawAt: new Date('2023-09-27T08:29:24.000Z'),
      soldListHash: 'l'.repeat(64),
      seedRevealed: 's'.repeat(64),
      winningAttempt: 1,
      drawEffect: 'SLOT_MACHINE',
      drawMode: 'AUTOMATIC',
      drawDurationSec: 4,
      drawSpeed: 'NORMAL',
      numberMin: 1,
      numberMax: 30,
      soldTicketBuyers: {},
      soldNumbers: [10, 20, 30],
      result: {
        drandRandomness: 'r'.repeat(64),
        winnerIndex: 1,
        winningNumber: 20,
        digestHex: 'e'.repeat(64),
        winningAttempt: undefined,
        extractions: [],
        executedAt: new Date('2026-11-16T01:30:03.000Z'),
      },
    });
  });

  it('handles null result and null dates when still waiting for close', () => {
    const liveDto = {
      rifa_id: 'r-1',
      titulo: 'Moto',
      estado: 'ACTIVE' as const,
      hash_compromiso: 'c'.repeat(64),
      hash_cadena_drand: 'd'.repeat(64),
      ronda_drand: '1000000',
      cierre_ventas: null,
      fecha_sorteo: null,
      hash_lista: null,
      semilla_revelada: null,
      numeros_vendidos: null,
      resultado: null,
    };
    expect(toLiveRaffleData(liveDto)).toEqual({
      raffleId: 'r-1',
      title: 'Moto',
      status: 'ACTIVE',
      winningAttempt: 1,
      drawEffect: 'SLOT_MACHINE',
      drawMode: 'AUTOMATIC',
      drawDurationSec: 4,
      drawSpeed: 'NORMAL',
      numberMin: 1,
      numberMax: 30,
      soldTicketBuyers: {},
      commitmentHash: 'c'.repeat(64),
      drandChainHash: 'd'.repeat(64),
      drandRound: '1000000',
      salesCloseAt: null,
      drawAt: null,
      soldListHash: null,
      seedRevealed: null,
      soldNumbers: null,
      result: null,
    });
  });
});