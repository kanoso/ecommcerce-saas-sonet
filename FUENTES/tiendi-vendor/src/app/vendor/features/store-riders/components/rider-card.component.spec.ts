import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  provideZonelessChangeDetection,
} from '@angular/core';
import { RiderCardComponent } from './rider-card.component';
import { AvatarComponent } from '../../../shared/ui/atoms/avatar.component';
import { TagComponent } from '../../../shared/ui/atoms/tag.component';
import { ButtonComponent } from '../../../shared/ui/atoms/button.component';
import { StoreRider } from '../store-riders.store';

// ─── Stubs ───────────────────────────────────────────────────────────────────

@Component({
  selector: 'td-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class AvatarStub {
  name = input<string>('');
  imageUrl = input<string | null>(null);
  size = input<string>('md');
}

@Component({
  selector: 'td-tag',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span class="tag-label">{{ label() }}</span>',
})
class TagStub {
  variant = input<string>('neutral');
  label = input<string>('');
}

@Component({
  selector: 'td-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<button type="button" (click)="clicked.emit()">{{ label() }}</button>',
})
class ButtonStub {
  label    = input<string>('');
  variant  = input<string>('primary');
  size     = input<string>('md');
  loading  = input<boolean>(false);
  clicked  = output<void>();
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRider(overrides: Partial<StoreRider> = {}): StoreRider {
  return {
    id: 'rider-1',
    name: 'Juan Perez',
    phone: '+5491112345678',
    avatarUrl: null,
    trustStatus: 'ACTIVE',
    operationalStatus: null,
    ...overrides,
  };
}

// ─── Test factory ─────────────────────────────────────────────────────────────

async function createFixture(rider: StoreRider): Promise<ComponentFixture<RiderCardComponent>> {
  await TestBed.configureTestingModule({
    imports: [RiderCardComponent],
    providers: [provideZonelessChangeDetection()],
  })
    .overrideComponent(RiderCardComponent, {
      remove: { imports: [AvatarComponent, TagComponent, ButtonComponent] },
      add:    { imports: [AvatarStub, TagStub, ButtonStub] },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(RiderCardComponent);
  fixture.componentRef.setInput('rider', rider);
  fixture.detectChanges();
  return fixture;
}

function findButtons(el: HTMLElement): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
}

function findButtonByLabel(el: HTMLElement, label: string): HTMLButtonElement | undefined {
  return findButtons(el).find((b) => b.textContent?.trim() === label);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RiderCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  // ── Renders name and phone ─────────────────────────────────────────────────

  it('should render rider name', async () => {
    const fixture = await createFixture(makeRider());
    const name = fixture.nativeElement.querySelector('.rider-card__name');
    expect(name?.textContent?.trim()).toBe('Juan Perez');
  });

  it('should render rider phone', async () => {
    const fixture = await createFixture(makeRider());
    const phone = fixture.nativeElement.querySelector('.rider-card__phone');
    expect(phone?.textContent?.trim()).toBe('+5491112345678');
  });

  // ── tagVariant computed ────────────────────────────────────────────────────

  it('tagVariant should be "success" for ACTIVE rider', async () => {
    const fixture = await createFixture(makeRider({ trustStatus: 'ACTIVE' }));
    expect(fixture.componentRef.instance.tagVariant()).toBe('success');
  });

  it('tagVariant should be "pending" for PENDING rider', async () => {
    const fixture = await createFixture(makeRider({ trustStatus: 'PENDING' }));
    expect(fixture.componentRef.instance.tagVariant()).toBe('pending');
  });

  it('tagVariant should be "warning" for SUSPENDED rider', async () => {
    const fixture = await createFixture(makeRider({ trustStatus: 'SUSPENDED' }));
    expect(fixture.componentRef.instance.tagVariant()).toBe('warning');
  });

  // ── PENDING rider ──────────────────────────────────────────────────────────

  describe('PENDING rider', () => {
    it('should show "Esperando aceptación" text', async () => {
      const fixture = await createFixture(makeRider({ trustStatus: 'PENDING' }));
      const waiting = fixture.nativeElement.querySelector('.rider-card__waiting');
      expect(waiting?.textContent).toContain('Esperando aceptación');
    });

    it('should not render any action buttons', async () => {
      const fixture = await createFixture(makeRider({ trustStatus: 'PENDING' }));
      expect(findButtons(fixture.nativeElement)).toHaveLength(0);
    });
  });

  // ── ACTIVE rider ───────────────────────────────────────────────────────────

  describe('ACTIVE rider', () => {
    it('should render "Suspender" button', async () => {
      const fixture = await createFixture(makeRider({ trustStatus: 'ACTIVE' }));
      expect(findButtonByLabel(fixture.nativeElement, 'Suspender')).toBeDefined();
    });

    it('should render "Eliminar" button', async () => {
      const fixture = await createFixture(makeRider({ trustStatus: 'ACTIVE' }));
      expect(findButtonByLabel(fixture.nativeElement, 'Eliminar')).toBeDefined();
    });

    it('should emit statusChange with SUSPENDED when "Suspender" is clicked', async () => {
      const rider = makeRider({ trustStatus: 'ACTIVE' });
      const fixture = await createFixture(rider);
      const changes: { rider: StoreRider; status: string }[] = [];
      fixture.componentRef.instance.statusChange.subscribe((v) => changes.push(v));

      findButtonByLabel(fixture.nativeElement, 'Suspender')?.click();
      fixture.detectChanges();

      expect(changes).toHaveLength(1);
      expect(changes[0].status).toBe('SUSPENDED');
      expect(changes[0].rider.id).toBe(rider.id);
    });
  });

  // ── SUSPENDED rider ────────────────────────────────────────────────────────

  describe('SUSPENDED rider', () => {
    it('should render "Activar" button', async () => {
      const fixture = await createFixture(makeRider({ trustStatus: 'SUSPENDED' }));
      expect(findButtonByLabel(fixture.nativeElement, 'Activar')).toBeDefined();
    });

    it('should render "Eliminar" button', async () => {
      const fixture = await createFixture(makeRider({ trustStatus: 'SUSPENDED' }));
      expect(findButtonByLabel(fixture.nativeElement, 'Eliminar')).toBeDefined();
    });
  });

  // ── remove output ──────────────────────────────────────────────────────────

  it('should emit remove when "Eliminar" is clicked on an ACTIVE rider', async () => {
    const rider = makeRider({ trustStatus: 'ACTIVE' });
    const fixture = await createFixture(rider);
    const removed: StoreRider[] = [];
    fixture.componentRef.instance.remove.subscribe((v) => removed.push(v));

    findButtonByLabel(fixture.nativeElement, 'Eliminar')?.click();
    fixture.detectChanges();

    expect(removed).toHaveLength(1);
    expect(removed[0].id).toBe(rider.id);
  });

  it('should emit remove when "Eliminar" is clicked on a SUSPENDED rider', async () => {
    const rider = makeRider({ trustStatus: 'SUSPENDED' });
    const fixture = await createFixture(rider);
    const removed: StoreRider[] = [];
    fixture.componentRef.instance.remove.subscribe((v) => removed.push(v));

    findButtonByLabel(fixture.nativeElement, 'Eliminar')?.click();
    fixture.detectChanges();

    expect(removed).toHaveLength(1);
    expect(removed[0].id).toBe(rider.id);
  });
});
