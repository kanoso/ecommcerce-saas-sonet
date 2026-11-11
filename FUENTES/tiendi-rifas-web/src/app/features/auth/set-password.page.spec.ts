import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ApiError, userMessageFor } from '../../core/api/api-error';
import { AuthApi } from '../../core/api/auth-api';
import { SetPasswordPage } from './set-password.page';

describe('SetPasswordPage', () => {
  let calls: { password: string; response: Subject<void> }[];
  let fixture: ComponentFixture<SetPasswordPage>;
  let el: HTMLElement;

  beforeEach(() => {
    calls = [];
    TestBed.configureTestingModule({
      imports: [SetPasswordPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthApi,
          useValue: {
            setPassword: (password: string) => {
              const response = new Subject<void>();
              calls.push({ password, response });
              return response;
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(SetPasswordPage);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  const type = (password: string, confirm: string) => {
    const pwd = el.querySelector('#new-pwd') as HTMLInputElement;
    const again = el.querySelector('#confirm-pwd') as HTMLInputElement;
    pwd.value = password;
    pwd.dispatchEvent(new Event('input'));
    again.value = confirm;
    again.dispatchEvent(new Event('input'));
  };

  const submit = () => {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  const fail = (status: number, code: string) => {
    calls[0].response.error(new ApiError(status, code, userMessageFor(code)));
    fixture.detectChanges();
  };

  const submitButton = () => el.querySelector('button[type="submit"]') as HTMLButtonElement;

  it('renders the password and confirmation fields', () => {
    expect(el.querySelector('#new-pwd')).not.toBeNull();
    expect(el.querySelector('#confirm-pwd')).not.toBeNull();
    expect(submitButton().disabled).toBe(false);
  });

  it('rejects a password shorter than 6 characters', () => {
    type('abc', 'abc');
    submit();
    expect(calls).toHaveLength(0);
    expect(el.textContent).toContain('entre 6 y 100 caracteres');
  });

  it('rejects a password longer than 100 characters', () => {
    const long = 'a'.repeat(101);
    type(long, long);
    submit();
    expect(calls).toHaveLength(0);
    expect(el.textContent).toContain('entre 6 y 100 caracteres');
  });

  it('rejects a confirmation that does not match', () => {
    type('secreto123', 'secreto124');
    submit();
    expect(calls).toHaveLength(0);
    expect(el.textContent).toContain('Las contraseñas no coinciden.');
  });

  it('sends the password and shows a pending state', () => {
    type('secreto123', 'secreto123');
    submit();
    expect(calls.map((c) => c.password)).toEqual(['secreto123']);
    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain('Guardando…');
  });

  it('confirms success and hides the form', () => {
    type('secreto123', 'secreto123');
    submit();
    calls[0].response.complete();
    fixture.detectChanges();
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Tu contraseña quedó guardada');
  });

  it('explains that the account already has a password (409)', () => {
    type('secreto123', 'secreto123');
    submit();
    fail(409, 'CONFLICT');
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Tu cuenta ya tiene una contraseña');
    expect(alert?.textContent).toContain('ingresar');
    expect(submitButton().disabled).toBe(false);
  });

  it('asks to sign in again, coming back here, when the session expired (401)', () => {
    type('secreto123', 'secreto123');
    submit();
    fail(401, 'UNAUTHORIZED');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Tu sesión terminó');
    const link = el.querySelector('a[href^="/ingresar"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/ingresar?volver=%2Fcuenta%2Fcontrasena');
  });

  it('asks to wait when rate limited (429)', () => {
    type('secreto123', 'secreto123');
    submit();
    fail(429, 'TOO_MANY_REQUESTS');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('demasiados intentos');
  });

  it('shows the generic message for any other failure', () => {
    type('secreto123', 'secreto123');
    submit();
    fail(500, 'HTTP_500');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Ocurrió un error inesperado');
    expect(submitButton().disabled).toBe(false);
  });
});
