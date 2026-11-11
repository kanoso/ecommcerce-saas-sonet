import { OperatorAlert } from '../../domain';
import { OperatorAlertRepository } from '../ports';

/** What the admin panel shows as pending, oldest first (DT-09). */
export class ListUnreadOperatorAlertsUseCase {
  constructor(private readonly alertRepo: OperatorAlertRepository) {}

  execute(): Promise<OperatorAlert[]> {
    return this.alertRepo.findUnread();
  }
}
