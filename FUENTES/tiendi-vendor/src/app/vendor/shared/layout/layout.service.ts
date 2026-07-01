import { Injectable, inject } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly bp = inject(BreakpointObserver);

  readonly isMobile = toSignal(
    this.bp.observe([Breakpoints.Handset]).pipe(map(r => r.matches)),
    { initialValue: false },
  );

  readonly isTablet = toSignal(
    this.bp.observe(['(min-width: 768px) and (max-width: 1023px)']).pipe(map(r => r.matches)),
    { initialValue: false },
  );
}
