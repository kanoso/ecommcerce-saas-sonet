import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CatalogStore } from './catalog.store';
import { RaffleCard } from './raffle-card';

/** Route `/`: the active and finished raffles. */
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
  readonly activeTab = signal<'activas' | 'finalizadas'>('activas');

  ngOnInit(): void {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }
}
