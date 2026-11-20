import { exclusionModeText } from './exclusion-mode-text';

describe('exclusionModeText', () => {
  it('explains the BUYER mode', () => {
    expect(exclusionModeText('BUYER')).toBe('Por comprador: quien gana sale con todos sus boletos');
  });

  it('explains the TICKET_ONLY mode, also the default when the mode is unknown', () => {
    expect(exclusionModeText('TICKET_ONLY')).toBe('Solo el boleto ganador sale del sorteo');
    expect(exclusionModeText(undefined)).toBe('Solo el boleto ganador sale del sorteo');
    expect(exclusionModeText(null)).toBe('Solo el boleto ganador sale del sorteo');
  });
});
