import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-onboarding-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nav">
      <div class="nav__left">
        @if (!isLastStep()) {
          @if (step() === 1) {
            <button type="button" class="nav__skip" (click)="skip.emit()">
              Hacer esto después
            </button>
          } @else {
            <button type="button" class="nav__skip" (click)="skip.emit()">
              Omitir
            </button>
          }
        }
      </div>

      <div class="nav__right">
        @if (step() > 1) {
          <button type="button" class="nav__btn nav__btn--secondary" (click)="prev.emit()">
            ← Atrás
          </button>
        }

        @if (isLastStep()) {
          <button
            type="button"
            class="nav__btn nav__btn--primary nav__btn--finish"
            [disabled]="isSaving()"
            (click)="next.emit()">
            @if (isSaving()) {
              <span class="material-icons-outlined nav__spinner">sync</span>
              Guardando...
            } @else {
              ¡Listo! Ver mi panel →
            }
          </button>
        } @else {
          <button type="button" class="nav__btn nav__btn--primary" (click)="next.emit()">
            Siguiente →
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }

    .nav__left,
    .nav__right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .nav__skip {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-secondary);
      padding: 8px 4px;
      transition: color 0.2s;
    }

    .nav__skip:hover {
      color: var(--text-primary);
    }

    .nav__btn {
      border: none;
      border-radius: var(--radius);
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .nav__btn--secondary {
      background: var(--surface);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }

    .nav__btn--secondary:hover {
      background: var(--border);
    }

    .nav__btn--primary {
      background: var(--primary);
      color: #fff;
    }

    .nav__btn--primary:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .nav__btn--finish {
      padding: 10px 24px;
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .nav__btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .nav__spinner {
      font-size: 16px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `],
})
export class OnboardingNavComponent {
  step = input.required<number>();
  isLastStep = input<boolean>(false);
  isSaving = input<boolean>(false);

  prev = output<void>();
  next = output<void>();
  skip = output<void>();
}
