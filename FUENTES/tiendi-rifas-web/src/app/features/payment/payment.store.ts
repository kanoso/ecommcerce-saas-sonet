import { InjectionToken, computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, Observable, catchError, exhaustMap, filter, finalize, interval, pipe, switchMap, takeWhile, tap } from 'rxjs';
import { ApiError, toApiError, userMessageFor } from '../../core/api/api-error';
import { BankOrWallet, Order, PaymentAccount } from '../../core/api/api.models';
import { OrderRead, OrdersApi } from '../../core/api/orders-api';
import { PaymentAccountsApi } from '../../core/api/payment-accounts-api';
import { PAGE_IS_VISIBLE } from '../raffle/raffle-detail.store';
import { toCents } from '../raffle/raffle-grid.model';
import {
  PaymentPhase,
  ProofFormErrors,
  ProofFormValues,
  formatCountdown,
  isFinalPhase,
  isPastDeadline,
  parseAmountToCents,
  phaseOf,
  remainingMs,
  serverClockOffsetMs,
  validateProofForm,
} from './payment.model';

/** Guide §7.2: the order status is read while the proof is in verification. */
export const PAYMENT_POLL_INTERVAL_MS = new InjectionToken<number>('PAYMENT_POLL_INTERVAL_MS', {
  providedIn: 'root',
  factory: () => 5000,
});

const COUNTDOWN_TICK_MS = 1000;

/** Wait between two expiry checks while the server still holds the order. */
const EXPIRY_RECHECK_MS = 5000;

/** The form as the page holds it: the real `File` the upload sends. */
export interface ProofInput extends ProofFormValues {
  file: File | null;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';
type AccountsStatus = 'loading' | 'ready' | 'error';

interface PaymentState {
  orderId: string | null;
  order: Order | null;
  loadStatus: LoadStatus;
  errorMessage: string | null;
  /**
   * Server clock minus local clock, from the `hora_servidor` of the last
   * read (see `serverClockOffsetMs`). Zero until a readable one arrives.
   */
  clockOffsetMs: number;
  /** Local time of the last countdown tick. */
  nowMs: number;
  submitting: boolean;
  submitError: string | null;
  fieldErrors: ProofFormErrors;
  /** The reservation lapsed unpaid: the page goes back to the grid. */
  expired: boolean;
  /** Where to transfer (DT-19), read from the API with the order. */
  accounts: PaymentAccount[];
  accountsStatus: AccountsStatus;
}

const initialState: PaymentState = {
  orderId: null,
  order: null,
  loadStatus: 'idle',
  errorMessage: null,
  clockOffsetMs: 0,
  nowMs: 0,
  submitting: false,
  submitError: null,
  fieldErrors: {},
  expired: false,
  accounts: [],
  accountsStatus: 'loading',
};

/** A malformed id (400), a 403 or another buyer's order (404) all read as missing. */
const isMissingOrder = (error: ApiError): boolean => [400, 403, 404].includes(error.status);

/**
 * State of `/rifas/:id/pago/:orderId`: the order, the operator accounts, the
 * reservation countdown, the proof upload and the status polling while the
 * proof is verified. Provided per page, so its timers end with it.
 */
export const PaymentStore = signalStore(
  withState(initialState),
  withComputed(({ order, nowMs, clockOffsetMs, accounts, accountsStatus }) => {
    const remaining = computed(() => remainingMs(order()?.expiresAt ?? null, nowMs(), clockOffsetMs()));
    return {
      phase: computed<PaymentPhase | null>(() => {
        const current = order();
        return current ? phaseOf(current.status) : null;
      }),
      remainingMs: remaining,
      countdown: computed(() => formatCountdown(remaining())),
      /** Whole cents, so the total never carries a floating point error. */
      totalCents: computed(() => toCents(order()?.totalAmount ?? 0)),
      /** Without an account to transfer to, no proof can be declared. */
      canSendProof: computed(() => accountsStatus() === 'ready' && accounts().length > 0),
    };
  }),
  withMethods(
    (
      store,
      orders = inject(OrdersApi),
      paymentAccounts = inject(PaymentAccountsApi),
      pollEvery = inject(PAYMENT_POLL_INTERVAL_MS),
      isVisible = inject(PAGE_IS_VISIBLE),
    ) => {
      /**
       * Bumped by every read or write that makes earlier answers stale. An
       * answer keeps the epoch it started in and is dropped if it changed, so
       * an old poll can never undo a fresher status.
       */
      let epoch = 0;
      const nextEpoch = (): number => ++epoch;
      const isCurrent = (started: number): boolean => started === epoch;
      let checkingExpiry = false;
      /** Local time before which no new expiry check starts. */
      let nextExpiryCheckAt = 0;

      const orderId = (): string => store.orderId() as string;
      const isFinal = (): boolean => {
        const phase = store.phase();
        return phase !== null && isFinalPhase(phase);
      };

      /**
       * The reservation is over only when the server says EXPIRED, or when an
       * unpaid order is past its deadline by the grace on the server clock.
       * A PENDING answer alone never ends it: the device clock may be wrong.
       */
      const isLapsed = (): boolean => {
        const phase = store.phase();
        const pastDeadline = isPastDeadline(store.order()?.expiresAt ?? null, Date.now(), store.clockOffsetMs());
        return phase === 'expired' || (phase === 'awaiting-proof' && pastDeadline);
      };

      const apply = (read: OrderRead): void => {
        const offset = serverClockOffsetMs(read.serverTime, read.receivedAt);
        patchState(store, {
          order: read.order,
          loadStatus: 'ready',
          errorMessage: null,
          clockOffsetMs: offset ?? store.clockOffsetMs(),
          nowMs: Date.now(),
        });
      };

      const markMissing = (): void =>
        patchState(store, { loadStatus: 'not-found', errorMessage: userMessageFor('ORDER_NOT_FOUND') });

      /** The page cannot trust what it shows: an error with a retry, no form. */
      const markUnreadable = (error: ApiError): void =>
        patchState(store, { loadStatus: 'error', errorMessage: error.userMessage, submitError: null });

      /** Reads the order and applies it unless something newer started meanwhile. */
      const read = (onRead: () => void, onError: (error: ApiError) => void): Observable<OrderRead> => {
        const started = nextEpoch();
        return orders.order(orderId()).pipe(
          filter(() => isCurrent(started)),
          tap((result) => {
            apply(result);
            onRead();
          }),
          catchError((raw: unknown) => {
            if (isCurrent(started)) {
              onError(toApiError(raw));
            }
            return EMPTY;
          }),
        );
      };

      const loadAccounts = rxMethod<void>(
        pipe(
          tap(() => patchState(store, { accountsStatus: 'loading' })),
          switchMap(() =>
            paymentAccounts.list().pipe(
              tap((accounts) => patchState(store, { accounts, accountsStatus: 'ready' })),
              catchError(() => {
                patchState(store, { accounts: [], accountsStatus: 'error' });
                return EMPTY;
              }),
            ),
          ),
        ),
      );

      const load = rxMethod<string>(
        pipe(
          tap((id) => {
            nextExpiryCheckAt = 0;
            patchState(store, { ...initialState, orderId: id, loadStatus: 'loading', nowMs: Date.now() });
            loadAccounts();
          }),
          switchMap(() =>
            read(
              () => patchState(store, { expired: isLapsed() }),
              (error) => (isMissingOrder(error) ? markMissing() : markUnreadable(error)),
            ),
          ),
        ),
      );

      /**
       * At zero the server is asked: the proof may have arrived from another
       * tab, or the device clock may be wrong. The answer resyncs the clock;
       * the page stays until the order is really over (see `isLapsed`), and
       * asks again a little later.
       */
      const confirmExpiry = rxMethod<void>(
        pipe(
          tap(() => {
            checkingExpiry = true;
            nextExpiryCheckAt = Date.now() + EXPIRY_RECHECK_MS;
          }),
          exhaustMap(() =>
            read(
              () => patchState(store, { expired: isLapsed() }),
              (error) => (isMissingOrder(error) ? markMissing() : patchState(store, { expired: isLapsed() })),
            ).pipe(finalize(() => (checkingExpiry = false))),
          ),
        ),
      );

      const startClock = rxMethod<void>(
        pipe(
          switchMap(() => interval(COUNTDOWN_TICK_MS)),
          tap(() => {
            patchState(store, { nowMs: Date.now() });
            const due =
              store.loadStatus() === 'ready' &&
              store.phase() === 'awaiting-proof' &&
              store.remainingMs() === 0 &&
              !store.submitting() &&
              !store.expired() &&
              !checkingExpiry &&
              Date.now() >= nextExpiryCheckAt;
            if (due) {
              confirmExpiry();
            }
          }),
        ),
      );

      const startPolling = rxMethod<void>(
        pipe(
          // Ends for good once the order reaches a final status.
          switchMap(() => interval(pollEvery).pipe(takeWhile(() => !isFinal()))),
          filter(
            () => isVisible() && store.loadStatus() === 'ready' && store.phase() === 'verifying' && !store.submitting(),
          ),
          // A tick while the previous read is pending is skipped, never queued.
          exhaustMap(() =>
            read(
              () => undefined,
              // A failed poll keeps the status as it was; the next tick tries again.
              (error) => (isMissingOrder(error) ? markMissing() : undefined),
            ),
          ),
        ),
      );

      /** After a refused proof: the server says where the order is now. */
      const refresh = rxMethod<void>(
        pipe(
          switchMap(() =>
            read(
              () => patchState(store, { expired: isLapsed() }),
              (error) => (isMissingOrder(error) ? markMissing() : markUnreadable(error)),
            ),
          ),
        ),
      );

      /** The version of a shown account; validation already checked it is shown. */
      const accountVersion = (accountId: string): number =>
        store.accounts().find((a) => a.id === accountId)?.version ?? 0;

      const onSubmitError = (error: ApiError): void => {
        if (error.code === 'PAYMENT_ACCOUNT_CHANGED' || error.code === 'PAYMENT_ACCOUNT_UNAVAILABLE') {
          // The account changed or left since it was shown: show the current
          // ones and ask the buyer which one they really paid to.
          patchState(store, {
            submitError: error.userMessage,
            fieldErrors: { paymentAccount: 'Revisa a qué cuenta transferiste.' },
          });
          loadAccounts();
        } else if (error.code === 'RESERVATION_EXPIRED') {
          patchState(store, { expired: true });
        } else if (error.code === 'INVALID_ORDER_TRANSITION') {
          // Another tab may have sent it: the server says where the order is.
          refresh();
        } else if (isMissingOrder(error)) {
          markMissing();
        } else {
          patchState(store, { submitError: error.userMessage });
        }
      };

      const submit = rxMethod<ProofInput>(
        pipe(
          filter(
            () =>
              store.loadStatus() === 'ready' &&
              store.phase() === 'awaiting-proof' &&
              store.canSendProof() &&
              !store.submitting() &&
              !store.expired(),
          ),
          filter((values) => {
            const fieldErrors = validateProofForm(
            values,
            store.accounts().map((a) => a.id),
          );
            patchState(store, { fieldErrors, submitError: null });
            return Object.keys(fieldErrors).length === 0;
          }),
          // A click while an upload is on its way is dropped, never queued.
          exhaustMap((values) => {
            const started = nextEpoch();
            patchState(store, { submitting: true });
            return orders
              .submitProof(orderId(), {
                file: values.file,
                operationNumber: values.operationNumber,
                bankOrWallet: values.bankOrWallet as BankOrWallet,
                declaredAmountCents: parseAmountToCents(values.declaredAmount) as number,
                paymentAccountId: values.paymentAccountId,
                // The version the buyer saw: the API refuses the proof if it changed (DT-19).
                paymentAccountVersion: accountVersion(values.paymentAccountId),
              })
              .pipe(
                filter(() => isCurrent(started)),
                // Uploaded is not paid: the order shows whatever status the API answers.
                tap((result) => apply(result)),
                catchError((raw: unknown) => {
                  if (isCurrent(started)) {
                    onSubmitError(toApiError(raw));
                  }
                  return EMPTY;
                }),
                // Also when the answer was dropped as stale: the form never stays stuck.
                finalize(() => patchState(store, { submitting: false })),
              );
          }),
        ),
      );

      return {
        load(id: string): void {
          load(id);
        },
        /** Starts the countdown and the status polling until the page is left. */
        start(): void {
          startClock();
          startPolling();
        },
        submit(values: ProofInput): void {
          submit(values);
        },
        retryAccounts(): void {
          loadAccounts();
        },
      };
    },
  ),
);
