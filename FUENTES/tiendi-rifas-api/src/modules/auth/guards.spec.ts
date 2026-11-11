import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService, Principal } from './auth.service';
import { SessionGuard } from './guards';

describe('SessionGuard', () => {
  const principal: Principal = {
    id: 'user-123',
    email: 'user@example.com',
    role: 'buyer',
    sessionId: 'session-123',
  };

  const authService: jest.Mocked<AuthService> = {
    authenticate: jest.fn(),
  } as unknown as jest.Mocked<AuthService>;

  const guard = new SessionGuard(authService);

  const mockContext = (headers: Record<string, string> = {}, query: Record<string, string> = {}) => {
    const request: Record<string, unknown> = {
      headers,
      query,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authenticates with Bearer header', async () => {
    authService.authenticate.mockResolvedValueOnce(principal);
    const ctx = mockContext({ authorization: 'Bearer test-token' });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(authService.authenticate).toHaveBeenCalledWith('test-token');
    const req = ctx.switchToHttp().getRequest() as { principal?: Principal };
    expect(req.principal).toEqual(principal);
  });

  it('rejects a session token sent as a ?token= query parameter (401)', async () => {
    authService.authenticate.mockResolvedValue(principal);
    const ctx = mockContext({}, { token: 'query-token-123' });

    const failure = guard.canActivate(ctx);

    await expect(failure).rejects.toThrow(UnauthorizedException);
    await expect(failure).rejects.toMatchObject({ status: 401 });
    expect(authService.authenticate).not.toHaveBeenCalled();
    const req = ctx.switchToHttp().getRequest() as { principal?: Principal };
    expect(req.principal).toBeUndefined();
  });

  it('uses only the Authorization header even when a ?token= query parameter is also present', async () => {
    authService.authenticate.mockResolvedValueOnce(principal);
    const ctx = mockContext({ authorization: 'Bearer header-token' }, { token: 'query-token-123' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(authService.authenticate).toHaveBeenCalledTimes(1);
    expect(authService.authenticate).toHaveBeenCalledWith('header-token');
  });

  it('rejects a non-Bearer Authorization scheme', async () => {
    const ctx = mockContext({ authorization: 'Basic abc' }, { token: 'query-token-123' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when no token is present', async () => {
    const ctx = mockContext({}, {});

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when token authentication fails', async () => {
    authService.authenticate.mockResolvedValueOnce(null);
    const ctx = mockContext({ authorization: 'Bearer invalid-token' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
