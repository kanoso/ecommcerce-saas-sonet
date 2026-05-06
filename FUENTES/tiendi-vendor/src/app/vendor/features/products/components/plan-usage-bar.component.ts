import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'td-plan-usage-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './plan-usage-bar.component.html',
  styleUrl: './plan-usage-bar.component.scss',
})
export class PlanUsageBarComponent {
  used = input.required<number>();
  max = input.required<number>();

  percentage = computed(() => Math.min(100, Math.round((this.used() / this.max()) * 100)));
  isWarning = computed(() => this.percentage() > 80);
}
