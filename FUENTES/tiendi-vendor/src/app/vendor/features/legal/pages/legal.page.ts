import {
  ChangeDetectionStrategy, Component, inject, OnInit,
} from '@angular/core';

import { LegalStore } from '../legal.store';
import { InvoicesTabComponent } from '../components/invoices-tab.component';
import { SunatConfigTabComponent, SunatConfigValue } from '../components/sunat-config-tab.component';
import { ComplaintsTabComponent } from '../components/complaints-tab.component';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InvoicesTabComponent,
    SunatConfigTabComponent,
    ComplaintsTabComponent,
  ],
  templateUrl: './legal.page.html',
  styleUrl: './legal.page.scss',
})
export class LegalPage implements OnInit {
  protected readonly store = inject(LegalStore);

  ngOnInit(): void {
    this.store.loadAll();
  }

  /** Builds initialConfig from store state for the SUNAT form */
  sunatInitialConfig(): Partial<SunatConfigValue> {
    // In a real app we'd have the full store config in state.
    // For now we return an empty object — the form uses its own defaults.
    return {};
  }

  onExport(): void {
    // Mock: would trigger CSV/PDF export from the backend
    alert('Exportando comprobantes...');
  }

  onSaveSunat(config: SunatConfigValue): void {
    this.store.saveSunatConfig(config);
  }
}
