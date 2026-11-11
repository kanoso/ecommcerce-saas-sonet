import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RaffleSummary } from '../../core/api/api.models';
import { formatCloseDate, formatCount, formatPrice, salesProgress } from './raffle-format';

/** Presentational card of one active raffle. */
@Component({
  selector: 'app-raffle-card',
  imports: [RouterLink],
  templateUrl: './raffle-card.html',
  styleUrl: './raffle-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RaffleCard {
  readonly raffle = input.required<RaffleSummary>();

  protected readonly price = computed(() => formatPrice(this.raffle().ticketPrice));
  protected readonly totalNumbers = computed(() => formatCount(this.raffle().totalNumbers));

  protected readonly closeDate = computed(() => {
    const closeAt = this.raffle().salesCloseAt;
    return closeAt ? formatCloseDate(closeAt) : null;
  });

  protected readonly sales = computed(() => {
    const { soldCount, totalNumbers } = this.raffle();
    if (soldCount === null) {
      return null;
    }
    return { percent: salesProgress(soldCount, totalNumbers), sold: formatCount(soldCount) };
  });

  protected readonly available = computed(() => {
    const { availableCount } = this.raffle();
    return availableCount === null ? null : { count: availableCount, text: formatCount(availableCount) };
  });
}
