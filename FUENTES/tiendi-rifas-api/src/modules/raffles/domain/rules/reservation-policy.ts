import { TicketReservationLimitError } from '../errors/domain.errors';

export interface ReservationPolicyConfig {
  maxNumbersPerReservation?: number;
  maxActiveReservedPerBuyer?: number;
  reservationTtlMinutes?: number;
}

export class ReservationPolicy {
  readonly maxNumbersPerReservation: number;
  readonly maxActiveReservedPerBuyer: number;
  readonly reservationTtlMinutes: number;

  constructor(config?: ReservationPolicyConfig) {
    this.maxNumbersPerReservation = config?.maxNumbersPerReservation ?? 20;
    this.maxActiveReservedPerBuyer = config?.maxActiveReservedPerBuyer ?? 20;
    this.reservationTtlMinutes = config?.reservationTtlMinutes ?? 15;
  }

  calculateExpiration(from: Date): Date {
    return new Date(from.getTime() + this.reservationTtlMinutes * 60 * 1000);
  }

  validateReservationRequest(requestedCount: number, currentActiveReservedCount: number): void {
    if (requestedCount <= 0) {
      throw new TicketReservationLimitError('Must request at least 1 number');
    }

    if (requestedCount > this.maxNumbersPerReservation) {
      throw new TicketReservationLimitError(
        `Cannot reserve more than ${this.maxNumbersPerReservation} numbers in a single order (requested: ${requestedCount})`,
      );
    }

    const totalAfterReservation = currentActiveReservedCount + requestedCount;
    if (totalAfterReservation > this.maxActiveReservedPerBuyer) {
      throw new TicketReservationLimitError(
        `Cannot hold more than ${this.maxActiveReservedPerBuyer} active reservations simultaneously (current: ${currentActiveReservedCount}, requested: ${requestedCount})`,
      );
    }
  }
}
