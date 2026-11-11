import { OperatorAlertNotFoundError, parseOperatorId } from '../../domain';
import { Clock, OperatorAlertRepository } from '../ports';

export interface MarkOperatorAlertReadCommand {
  alertId: string;
  operatorId: string;
}

/** Alerts are shared: one operator reading it clears it for all (DT-09). */
export class MarkOperatorAlertReadUseCase {
  constructor(
    private readonly alertRepo: OperatorAlertRepository,
    private readonly clock: Clock,
  ) {}

  async execute(request: MarkOperatorAlertReadCommand): Promise<void> {
    // The canonical operator id, checked before anything is read (DT-17).
    const command = {
      ...request,
      operatorId: parseOperatorId(request.operatorId),
    };
    const alert = await this.alertRepo.findById(command.alertId);
    if (!alert) {
      throw new OperatorAlertNotFoundError(command.alertId);
    }

    await this.alertRepo.markRead(
      alert.id,
      command.operatorId,
      this.clock.now(),
    );
  }
}
