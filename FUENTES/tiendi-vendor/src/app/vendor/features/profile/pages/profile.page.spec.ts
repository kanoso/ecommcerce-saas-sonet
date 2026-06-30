/**
 * Unit tests for ProfilePage.
 * Covers: required-field validation (S-02), error handling (S-03).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, type WritableSignal } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { ProfilePage } from './profile.page';
import { AuthStore } from '../../../core/services/auth.store';

// ─── Stubs ───────────────────────────────────────────────────────────────────

const stubUser = {
  id: 'user-1',
  name: 'Maria Lopez',
  email: 'maria@tiendi.pe',
  role: 'STORE_OWNER' as const,
  storeId: 'store-1',
  storeRole: null,
  avatar: null,
  firstName: 'Maria',
  lastName: 'Lopez',
  phone: null,
  createdAt: '2024-01-15T10:00:00.000Z',
};

function makeAuthStoreStub(
  updateMeImpl: () => Promise<typeof stubUser> = () => Promise.resolve(stubUser),
) {
  return {
    currentUser: signal(stubUser),
    isAuthenticated: signal(true),
    updateMe: vi.fn().mockImplementation(updateMeImpl),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setup(authStoreValue?: ReturnType<typeof makeAuthStoreStub>) {
  const store = authStoreValue ?? makeAuthStoreStub();

  await TestBed.configureTestingModule({
    imports: [ProfilePage],
    providers: [
      provideZonelessChangeDetection(),
      { provide: AuthStore, useValue: store },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<ProfilePage> = TestBed.createComponent(ProfilePage);
  fixture.detectChanges();
  return { fixture, store };
}

// ─── Internal component shape (for casting) ──────────────────────────────────

interface ProfilePageInternal {
  form: FormGroup;
  isSaving: WritableSignal<boolean>;
  saveError: WritableSignal<string | null>;
  saveOk: WritableSignal<boolean>;
  onSubmit: () => Promise<void>;
}

// ─── 4.3: Required-field validation (S-02) ───────────────────────────────────

describe('ProfilePage — form validation (S-02)', () => {
  it('is invalid when firstName is cleared', async () => {
    const { fixture } = await setup();
    const comp = fixture.componentInstance as unknown as ProfilePageInternal;
    comp.form.controls['firstName'].setValue('');
    comp.form.controls['firstName'].markAsTouched();
    expect(comp.form.valid).toBe(false);
  });

  it('does not call authStore.updateMe when firstName is empty', async () => {
    const stub = makeAuthStoreStub();
    const { fixture } = await setup(stub);
    const comp = fixture.componentInstance as unknown as ProfilePageInternal;
    comp.form.controls['firstName'].setValue('');
    comp.form.controls['firstName'].markAsTouched();

    await comp.onSubmit();

    expect(stub.updateMe).not.toHaveBeenCalled();
  });

  it('is invalid when lastName is cleared', async () => {
    const { fixture } = await setup();
    const comp = fixture.componentInstance as unknown as ProfilePageInternal;
    comp.form.controls['lastName'].setValue('');
    comp.form.controls['lastName'].markAsTouched();
    expect(comp.form.valid).toBe(false);
  });

  it('is valid with required fields populated', async () => {
    const { fixture } = await setup();
    const comp = fixture.componentInstance as unknown as ProfilePageInternal;
    // Form is pre-filled from stubUser.firstName + stubUser.lastName via ngOnInit
    expect(comp.form.valid).toBe(true);
  });
});

// ─── 4.4: Error handling (S-03) ──────────────────────────────────────────────

describe('ProfilePage — HTTP error handling (S-03)', () => {
  it('sets saveError and re-enables form when updateMe rejects', async () => {
    const stub = makeAuthStoreStub(() => Promise.reject(new Error('Bad request')));
    const { fixture } = await setup(stub);
    const comp = fixture.componentInstance as unknown as ProfilePageInternal;

    // Form is valid (prefilled from stubUser)
    expect(comp.form.valid).toBe(true);

    await comp.onSubmit();

    expect(comp.saveError()).toBe('Bad request');
    expect(comp.isSaving()).toBe(false);
    expect(comp.form.enabled).toBe(true);
  });
});
