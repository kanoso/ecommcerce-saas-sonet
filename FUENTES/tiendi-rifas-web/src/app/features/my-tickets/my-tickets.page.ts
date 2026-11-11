import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatCloseDate } from '../catalog/raffle-format';
import { formatCents } from '../raffle/raffle-grid.model';
import { TicketOrderRow } from './my-tickets.model';
import { MyTicketsStore } from './my-tickets.store';

/**
 * Route `/mis-boletos` (RF-06, guide §7): the buyer's orders grouped by
 * raffle. A simple list with no prototype, on the same visual tokens.
 */
@Component({
  selector: 'app-my-tickets-page',
  imports: [RouterLink],
  providers: [MyTicketsStore],
  templateUrl: './my-tickets.page.html',
  styleUrl: './my-tickets.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTicketsPage implements OnInit {
  protected readonly store = inject(MyTicketsStore);

  protected readonly formatCents = formatCents;

  ngOnInit(): void {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }

  /** "Paga antes del 3 nov, 10:15" in Lima time; null without a readable deadline. */
  protected deadline(order: TicketOrderRow): string | null {
    const text = order.deadline ? formatCloseDate(order.deadline) : null;
    return text ? `Paga antes del ${text}` : null;
  }

  protected payLabel(raffleTitle: string, order: TicketOrderRow): string {
    return `Completar pago de ${raffleTitle}, números ${order.numbers.join(', ')}`;
  }

  protected claimLabel(raffleTitle: string, order: TicketOrderRow): string {
    return `Reclamar pago de ${raffleTitle}, números ${order.numbers.join(', ')}`;
  }
}
