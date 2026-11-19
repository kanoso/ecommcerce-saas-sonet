import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RaffleSummary } from '../../core/api/api.models';
import { visibleStatusLabel, visibleStatusOf } from '../../core/raffle-status/visible-status';
import { formatCloseDate, formatCount, formatPrice, salesProgress } from './raffle-format';

/** Presentational card of one raffle, on sale, to be drawn or finished. */
@Component({
  selector: 'app-raffle-card',
  imports: [RouterLink],
  templateUrl: './raffle-card.html',
  styleUrl: './raffle-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RaffleCard {
  readonly raffle = input.required<RaffleSummary>();
  /** The moment the visible status is read at; the page's load time by default. */
  readonly now = input<Date>(new Date());

  protected readonly price = computed(() => formatPrice(this.raffle().ticketPrice));
  protected readonly totalNumbers = computed(() => formatCount(this.raffle().totalNumbers));

  /** DT-23: the status a buyer understands, not the stored one. */
  protected readonly visibleStatus = computed(() => visibleStatusOf(this.raffle(), this.now()));
  protected readonly statusLabel = computed(() =>
    visibleStatusLabel(this.visibleStatus(), this.raffle().drawAt),
  );

  /** "Olla arrocera + 2 premios más" for several prizes; the prize otherwise. */
  protected readonly prizeSummary = computed(() => {
    const { prizes, prize } = this.raffle();
    if (prizes.length <= 1) {
      return prizes[0]?.title ?? prize;
    }
    const more = prizes.length - 1;
    return `${prizes[0].title} + ${more} ${more === 1 ? 'premio más' : 'premios más'}`;
  });

  /** Winners of a drawn raffle; none while a live draw is in progress. */
  protected readonly winners = computed(() =>
    this.visibleStatus() === 'DRAWN' ? this.raffle().winners : [],
  );

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

  protected padNumber(n: number | null): string {
    if (n === null) return '--';
    const digits = Math.max(2, String(this.raffle().numberMax).length);
    return String(n).padStart(digits, '0');
  }
}
