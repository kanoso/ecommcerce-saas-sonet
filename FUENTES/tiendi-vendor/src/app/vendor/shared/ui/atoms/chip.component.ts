import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'td-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './chip.component.html',
  styleUrl: './chip.component.scss',
})
export class ChipComponent {
  label = input.required<string>();
  selected = input<boolean>(false);
  disabled = input<boolean>(false);

  toggled = output<boolean>();
}
