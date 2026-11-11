import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from './core/api/auth-api';
import { SessionStore } from './core/session/session.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  title = 'tiendi-rifas-web';

  protected readonly session = inject(SessionStore);
  protected readonly isAdmin = computed(() => this.session.user()?.role?.toLowerCase() === 'admin');
  private readonly auth = inject(AuthApi);
  private readonly router = inject(Router);

  /** Forgets the session locally even if the server call fails, and redirects to login. */
  protected signOut(): void {
    this.auth
      .signOut()
      .pipe(
        finalize(() => {
          this.session.signOut();
          void this.router.navigate(['/ingresar']);
        }),
      )
      .subscribe({ error: () => undefined });
  }
}
