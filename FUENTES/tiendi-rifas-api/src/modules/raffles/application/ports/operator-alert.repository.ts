import { OperatorAlert } from '../../domain';

export interface OperatorAlertRepository {
  findById(id: string): Promise<OperatorAlert | null>;
  /** Oldest first. */
  findUnread(): Promise<OperatorAlert[]>;
  /** Marking again changes nothing: the first reader stays on record. */
  markRead(id: string, operatorId: string, now: Date): Promise<void>;
}
