import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AuthApi } from '../../core/api/auth-api';
import { Session } from '../../core/api/api.models';
import { RETURN_PATH_STORAGE, ReturnPathStore } from '../../core/session/return-path';
import { CLOCK, SessionStore } from '../../core/session/session.store';
import { memoryStorage } from '../../core/session/testing/memory-storage';
import { RequestLinkPage } from './request-link.page';

describe('RequestLinkPage', () => {
  let loginCalls: { id: string; pwd: string; response: Subject<Session> }[];
  let regCalls: { id: string; pwd: string; name?: string; response: Subject<Session> }[];
  let linkCalls: { email: string; response: Subject<void> }[];
  let fixture: ComponentFixture<RequestLinkPage>;
  let el: HTMLElement;

  beforeEach(() => {
    loginCalls = [];
    regCalls = [];
    linkCalls = [];
    TestBed.configureTestingModule({
      imports: [RequestLinkPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthApi,
          useValue: {
            login: (id: string, pwd: string) => {
              const response = new Subject<Session>();
              loginCalls.push({ id, pwd, response });
              return response;
            },
            register: (id: string, pwd: string, name?: string) => {
              const response = new Subject<Session>();
              regCalls.push({ id, pwd, name, response });
              return response;
            },
            requestLink: (email: string) => {
              const response = new Subject<void>();
              linkCalls.push({ email, response });
              return response;
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(RequestLinkPage);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  const typeLogin = (id: string, pwd: string) => {
    const idInput = el.querySelector('#login-id') as HTMLInputElement;
    const pwdInput = el.querySelector('#login-pwd') as HTMLInputElement;
    idInput.value = id;
    idInput.dispatchEvent(new Event('input'));
    pwdInput.value = pwd;
    pwdInput.dispatchEvent(new Event('input'));
  };

  const submitForm = () => {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('renders login tab by default with identifier and password fields', () => {
    expect(el.querySelector('#login-id')).not.toBeNull();
    expect(el.querySelector('#login-pwd')).not.toBeNull();
    expect(el.textContent).toContain('Ingresar');
  });

  it('validates empty inputs on login', () => {
    submitForm();
    expect(loginCalls).toHaveLength(0);
    expect(el.textContent).toContain('Completa tu identificador y contraseña.');
  });

  it('submits login with valid credentials', () => {
    typeLogin('72345678', 'password123');
    submitForm();

    expect(loginCalls).toHaveLength(1);
    expect(loginCalls[0].id).toBe('72345678');
    expect(loginCalls[0].pwd).toBe('password123');
  });

  it('switches to register tab and submits registration', () => {
    const tabs = el.querySelectorAll('.auth-tab');
    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('#reg-id')).not.toBeNull();
    expect(el.querySelector('#reg-pwd')).not.toBeNull();

    const regId = el.querySelector('#reg-id') as HTMLInputElement;
    const regPwd = el.querySelector('#reg-pwd') as HTMLInputElement;
    regId.value = '987654321';
    regId.dispatchEvent(new Event('input'));
    regPwd.value = 'secret123';
    regPwd.dispatchEvent(new Event('input'));

    submitForm();

    expect(regCalls).toHaveLength(1);
    expect(regCalls[0].id).toBe('987654321');
    expect(regCalls[0].pwd).toBe('secret123');
  });

  it('does not register with an email: email accounts use the link or Google', () => {
    const tabs = el.querySelectorAll('.auth-tab');
    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.textContent).not.toContain('DNI, celular o correo');

    const regId = el.querySelector('#reg-id') as HTMLInputElement;
    const regPwd = el.querySelector('#reg-pwd') as HTMLInputElement;
    regId.value = 'buyer@example.com';
    regId.dispatchEvent(new Event('input'));
    regPwd.value = 'secret123';
    regPwd.dispatchEvent(new Event('input'));

    submitForm();

    expect(regCalls).toHaveLength(0);
  });

  it('shows error when login API fails', () => {
    typeLogin('72345678', 'wrongpwd');
    submitForm();

    loginCalls[0].response.error(new ApiError(401, 'UNAUTHORIZED', 'Credenciales inválidas'));
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Credenciales inválidas');
  });
});

describe('RequestLinkPage return path', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'ingresar', component: RequestLinkPage }]),
        { provide: RETURN_PATH_STORAGE, useValue: memoryStorage() },
        { provide: CLOCK, useValue: () => 0 },
        {
          provide: AuthApi,
          useValue: {
            login: () => new Subject<Session>(),
            register: () => new Subject<Session>(),
            requestLink: () => new Subject<void>(),
          },
        },
      ],
    });
  });

  const loginFrom = async (url: string) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    const el = harness.routeNativeElement as HTMLElement;
    const idInput = el.querySelector('#login-id') as HTMLInputElement;
    const pwdInput = el.querySelector('#login-pwd') as HTMLInputElement;
    idInput.value = '72345678';
    idInput.dispatchEvent(new Event('input'));
    pwdInput.value = 'password123';
    pwdInput.dispatchEvent(new Event('input'));
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  };

  it('remembers the internal page to return to after login', async () => {
    await loginFrom('/ingresar?volver=%2Frifas%2Fabc');
    expect(TestBed.inject(ReturnPathStore).consume()).toBe('/rifas/abc');
  });

  it('ignores a return address outside the app', async () => {
    await loginFrom('/ingresar?volver=https%3A%2F%2Fevil.example');
    expect(TestBed.inject(ReturnPathStore).consume()).toBeNull();
  });

  it('forgets an earlier return path when none is given', async () => {
    TestBed.inject(ReturnPathStore).remember('/rifas/old');
    await loginFrom('/ingresar');
    expect(TestBed.inject(ReturnPathStore).consume()).toBeNull();
  });
});
