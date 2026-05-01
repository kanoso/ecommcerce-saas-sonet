/**
 * json-server middleware — simula auth JWT, guards de rol, latencia y errores
 */

const VALID_TOKENS = {
  'token-store-owner': { userId: 'u1', role: 'STORE_OWNER', storeId: 's1', name: 'Carlos García' },
  'token-manager':     { userId: 'u2', role: 'MANAGER',     storeId: 's1', name: 'María López' },
  'token-cashier':     { userId: 'u3', role: 'CASHIER',     storeId: 's1', name: 'Juan Pérez' },
  'token-warehouse':   { userId: 'u4', role: 'WAREHOUSE',   storeId: 's1', name: 'Rosa Mamani' },
};

const ROLE_PERMISSIONS = {
  STORE_OWNER: ['*'],
  MANAGER:     ['/vendor/dashboard', '/vendor/orders', '/vendor/products', '/vendor/customers', '/vendor/analytics', '/vendor/notifications', '/vendor/complaints', '/vendor/invoices', '/stores'],
  CASHIER:     ['/vendor/orders', '/vendor/notifications'],
  WAREHOUSE:   ['/vendor/products'],
};

const ORDER_TRANSITIONS = {
  PENDING:    ['CONFIRMED', 'REJECTED'],
  CONFIRMED:  ['DISPATCHED', 'REJECTED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED:  [],
  REJECTED:   [],
};

function simulateLatency() {
  const ms = Math.floor(Math.random() * 300) + 100;
  return new Promise(r => setTimeout(r, ms));
}

function hasPermission(role, path) {
  if (!ROLE_PERMISSIONS[role]) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (perms.includes('*')) return true;
  return perms.some(p => path.startsWith(p));
}

module.exports = (req, res, next) => {
  // ── LOGIN endpoint ──────────────────────────────────────────
  if (req.method === 'POST' && req.path === '/auth/login') {
    const { email } = req.body || {};
    const tokenMap = {
      'carlos@tiendi.app': 'token-store-owner',
      'maria@tiendi.app':  'token-manager',
      'juan@tiendi.app':   'token-cashier',
      'rosa@tiendi.app':   'token-warehouse',
    };
    const token = tokenMap[email];
    if (token) {
      const user = VALID_TOKENS[token];
      return res.json({
        token,
        refreshToken: 'refresh-' + token,
        user: { id: user.userId, role: user.role, storeId: user.storeId, name: user.name, email }
      });
    }
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  // ── REFRESH TOKEN ───────────────────────────────────────────
  if (req.method === 'POST' && req.path === '/auth/refresh') {
    const { refreshToken } = req.body || {};
    if (refreshToken && refreshToken.startsWith('refresh-token-')) {
      const token = refreshToken.replace('refresh-', '');
      if (VALID_TOKENS[token]) {
        return res.json({ token, refreshToken });
      }
    }
    return res.status(401).json({ message: 'Token expirado' });
  }

  // ── AUTH GUARD — verificar JWT ──────────────────────────────
  const authHeader = req.headers.authorization;
  const vendorRoute = req.path.startsWith('/vendor') || req.path.startsWith('/stores') || req.path.startsWith('/orders') || req.path.startsWith('/products') || req.path.startsWith('/customers');

  if (vendorRoute) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    const token = authHeader.split(' ')[1];
    const session = VALID_TOKENS[token];
    if (!session) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    // Adjuntar sesión al request para uso posterior
    req.session = session;

    // ── ROLE GUARD ────────────────────────────────────────────
    if (!hasPermission(session.role, req.path)) {
      return res.status(403).json({ message: 'No tenés permiso para hacer esto.' });
    }
  }

  // ── SIMULAR LATENCIA ────────────────────────────────────────
  simulateLatency().then(() => {

    // ── VALIDACIONES DE NEGOCIO — transiciones de pedido ──────
    if (req.method === 'PUT' && req.path.match(/^\/orders\/[^/]+\/(confirm|dispatch|complete|reject)$/)) {
      const action = req.path.split('/').pop();
      const actionToStatus = { confirm: 'CONFIRMED', dispatch: 'DISPATCHED', complete: 'DELIVERED', reject: 'REJECTED' };
      const newStatus = actionToStatus[action];

      // Buscar el pedido en el body del router
      // json-server no da acceso fácil al recurso, pero podemos delegar al next
      // y parchear la respuesta. Para simplicidad, simulamos OK.
      // El frontend debe manejar el estado localmente (optimistic update).
    }

    next();
  });
};
