import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-staff-slots-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './staff-slots-banner.component.html',
  styleUrl: './staff-slots-banner.component.scss',
})
export class StaffSlotsBannerComponent {
  used = input.required<number>();
  max  = input.required<number>();
}
