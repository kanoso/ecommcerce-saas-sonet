import { BankOrWallet } from '../enums/raffle-status.enum';
import {
  NotChangeProposerError,
  PaymentAccountChangeClosedError,
  SameOperatorApprovalError,
} from '../errors/domain.errors';
import { PaymentAccountChange, PaymentAccountChangeKind, PaymentAccountChangeStatus } from './payment-account-change';

describe('PaymentAccountChange (DT-19, four eyes)', () => {
  const proposedAt = new Date('2026-11-03T10:00:00Z');
  const decidedAt = new Date('2026-11-03T11:00:00Z');

  const proposal = () =>
    PaymentAccountChange.propose({
      id: 'change-1',
      kind: PaymentAccountChangeKind.CREATE,
      accountId: 'account-1',
      proposed: {
        method: BankOrWallet.YAPE,
        holderName: 'Rifas Tiendi SAC',
        accountNumber: '987654321',
        cci: null,
        displayOrder: 0,
      },
      before: null,
      proposedBy: 'admin-1',
      proposedAt,
    });

  it('starts pending, named after its proposer', () => {
    expect(proposal()).toMatchObject({
      status: PaymentAccountChangeStatus.PENDING,
      proposedBy: 'admin-1',
      decidedBy: null,
      decidedAt: null,
    });
  });

  it('is approved by another operator only', () => {
    expect(() => proposal().approve('admin-1', decidedAt)).toThrow(SameOperatorApprovalError);

    expect(proposal().approve('admin-2', decidedAt)).toMatchObject({
      status: PaymentAccountChangeStatus.APPROVED,
      decidedBy: 'admin-2',
      decidedAt,
    });
  });

  it('is rejected by another operator only', () => {
    expect(() => proposal().reject('admin-1', decidedAt)).toThrow(SameOperatorApprovalError);
    expect(proposal().reject('admin-2', decidedAt).status).toBe(PaymentAccountChangeStatus.REJECTED);
  });

  it('is cancelled by its proposer only', () => {
    expect(() => proposal().cancel('admin-2', decidedAt)).toThrow(NotChangeProposerError);
    expect(proposal().cancel('admin-1', decidedAt).status).toBe(PaymentAccountChangeStatus.CANCELLED);
  });

  it('cannot be decided twice', () => {
    const approved = proposal().approve('admin-2', decidedAt);

    expect(() => approved.approve('admin-3', decidedAt)).toThrow(PaymentAccountChangeClosedError);
    expect(() => approved.reject('admin-3', decidedAt)).toThrow(PaymentAccountChangeClosedError);
    expect(() => approved.cancel('admin-1', decidedAt)).toThrow(PaymentAccountChangeClosedError);
  });
});
