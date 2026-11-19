import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CatalogStore } from './catalog.store';
import { RaffleCard } from './raffle-card';

export type CatalogTab = 'en-venta' | 'por-sortear' | 'finalizadas';

/** Route `/`: raffles on sale, to be drawn (live first) and finished (DT-23). */
@Component({
  selector: 'app-catalog-page',
  imports: [RaffleCard],
  providers: [CatalogStore],
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage implements OnInit {
  protected readonly store = inject(CatalogStore);
  readonly activeTab = signal<CatalogTab>('en-venta');

  ngOnInit(): void {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }
}
