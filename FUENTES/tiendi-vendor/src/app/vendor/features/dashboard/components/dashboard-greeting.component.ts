import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'app-dashboard-greeting',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-greeting.component.html',
  styleUrl: './dashboard-greeting.component.scss',
})
export class DashboardGreetingComponent {
  userName = input.required<string>();
  storeName = input<string>('');
  date = input.required<Date>();

  greetingText = computed(() => {
    const hour = this.date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  });

  formattedDate = computed(() =>
    new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(this.date()),
  );
}
