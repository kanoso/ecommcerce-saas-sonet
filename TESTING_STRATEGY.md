# Estrategia de Testing - Sistema Tiendi

Estrategia completa de pruebas para garantizar la calidad del sistema e-commerce multi-tenant Tiendi.

---

## Índice

1. [Pirámide de Testing](#1-pirámide-de-testing)
2. [Unit Tests](#2-unit-tests)
3. [Integration Tests](#3-integration-tests)
4. [E2E Tests](#4-e2e-tests)
5. [Performance Tests](#5-performance-tests)
6. [Security Tests](#6-security-tests)
7. [CI/CD Integration](#7-cicd-integration)
8. [Cobertura de Código](#8-cobertura-de-código)

---

## 1. Pirámide de Testing

```
                 /\
                /  \
               /E2E \         10% - End-to-End Tests (Playwright)
              /______\
             /        \
            /Integration\    30% - Integration Tests (Supertest)
           /____________\
          /              \
         /   Unit Tests   \  60% - Unit Tests (Jest/Vitest)
        /__________________\

```

**Objetivos de Cobertura:**
- ✅ **Unit Tests:** 80%+ coverage
- ✅ **Integration Tests:** Critical paths 100%
- ✅ **E2E Tests:** User journeys principales
- ✅ **Performance Tests:** SLA compliance

---

## 2. Unit Tests

### 2.1 Framework: Jest

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s",
      "!**/*.spec.ts",
      "!**/node_modules/**"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### 2.2 Ejemplo: Service Unit Test

```typescript
// product.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';

describe('ProductService', () => {
  let service: ProductService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('findAll', () => {
    it('should return an array of products', async () => {
      const products = [
        { id: '1', name: 'Product 1', price: 100 },
        { id: '2', name: 'Product 2', price: 200 },
      ];

      mockRepository.find.mockResolvedValue(products);

      const result = await service.findAll();

      expect(result).toEqual(products);
      expect(mockRepository.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const createDto = { name: 'New Product', price: 150 };
      const savedProduct = { id: '3', ...createDto };

      mockRepository.save.mockResolvedValue(savedProduct);

      const result = await service.create(createDto);

      expect(result).toEqual(savedProduct);
      expect(mockRepository.save).toHaveBeenCalledWith(createDto);
    });

    it('should throw error if price is negative', async () => {
      const createDto = { name: 'Product', price: -10 };

      await expect(service.create(createDto)).rejects.toThrow(
        'Price must be positive'
      );
    });
  });
});
```

### 2.3 Testing Utilities

```typescript
// test/utils/mock-data.ts
export const mockUser = {
  id: 'user-123',
  email: 'test@tiendi.pe',
  role: 'customer',
};

export const mockStore = {
  id: 'store-123',
  name: 'MiniMarket Test',
  slug: 'minimarket-test',
};

export const mockProduct = {
  id: 'product-123',
  name: 'Test Product',
  price: 100,
  stock: 50,
  storeId: 'store-123',
};

// test/utils/test-db.ts
export async function cleanupDatabase(connection: Connection) {
  const entities = connection.entityMetadatas;
  for (const entity of entities) {
    const repository = connection.getRepository(entity.name);
    await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
  }
}
```

---

## 3. Integration Tests

### 3.1 Framework: Supertest + Testing Containers

```typescript
// test/integration/products.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    // Start PostgreSQL test container
    container = await new PostgreSqlContainer().start();

    process.env.DATABASE_URL = container.getConnectionUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  describe('/products (GET)', () => {
    it('should return 200 and list of products', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should filter products by store_id', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?store_id=store-123')
        .expect(200);

      expect(response.body.every(p => p.storeId === 'store-123')).toBe(true);
    });
  });

  describe('/products (POST)', () => {
    it('should create product with valid data', async () => {
      const createDto = {
        name: 'Integration Test Product',
        price: 100,
        stock: 50,
        storeId: 'store-123',
      };

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', 'Bearer valid-token')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject(createDto);
      expect(response.body.id).toBeDefined();
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Product' })
        .expect(401);
    });

    it('should return 400 with invalid data', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ price: -10 }) // Missing required fields + negative price
        .expect(400);
    });
  });
});
```

---

## 4. E2E Tests

### 4.1 Framework: Playwright

```typescript
// e2e/purchase-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Purchase Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://tiendi.pe');
  });

  test('complete purchase flow from search to confirmation', async ({ page }) => {
    // 1. Allow location
    await page.click('button:has-text("Permitir ubicación")');

    // 2. Wait for stores to load
    await expect(page.locator('[data-testid="store-list"]')).toBeVisible();

    // 3. Click on first store
    await page.click('[data-testid="store-card"]:first-child');

    // 4. Add product to cart
    await page.click('[data-testid="add-to-cart-btn"]:first-child');

    // 5. Verify cart badge updated
    await expect(page.locator('[data-testid="cart-badge"]')).toContainText('1');

    // 6. Go to checkout
    await page.click('[data-testid="cart-button"]');
    await page.click('button:has-text("Ir a checkout")');

    // 7. Login (if not logged in)
    if (await page.locator('text=Iniciar sesión').isVisible()) {
      await page.fill('input[name="email"]', 'test@tiendi.pe');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
    }

    // 8. Fill delivery address
    await page.fill('input[name="address"]', 'Av. Arequipa 123, Lima');
    await page.click('button:has-text("Confirmar dirección")');

    // 9. Select payment method
    await page.click('text=Tarjeta de crédito');

    // 10. Fill card details (en iframe de Niubiz)
    const cardFrame = page.frameLocator('iframe[name="niubiz-card-frame"]');
    await cardFrame.locator('input[name="cardNumber"]').fill('4111111111111111');
    await cardFrame.locator('input[name="expiry"]').fill('12/25');
    await cardFrame.locator('input[name="cvv"]').fill('123');

    // 11. Confirm order
    await page.click('button:has-text("Confirmar pedido")');

    // 12. Verify confirmation page
    await expect(page.locator('text=Pedido confirmado')).toBeVisible();
    await expect(page.locator('[data-testid="order-number"]')).toContainText('OBI-');
  });

  test('should show error if stock is insufficient', async ({ page }) => {
    // Add more items than available stock
    await page.click('[data-testid="add-to-cart-btn"]:first-child');

    // Manually set quantity higher than stock
    await page.fill('[data-testid="quantity-input"]', '999');

    await page.click('button:has-text("Ir a checkout")');

    // Should show error
    await expect(page.locator('text=Stock insuficiente')).toBeVisible();
  });
});
```

### 4.2 Visual Regression Tests

```typescript
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('homepage should match snapshot', async ({ page }) => {
    await page.goto('https://tiendi.pe');

    // Wait for dynamic content to load
    await page.waitForLoadState('networkidle');

    // Take screenshot and compare
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      maxDiffPixels: 100, // Allow minor differences
    });
  });

  test('product page should match snapshot', async ({ page }) => {
    await page.goto('https://tiendi.pe/products/cerveza-pilsen');

    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('product-page.png');
  });
});
```

---

## 5. Performance Tests

### 5.1 Framework: k6

```javascript
// performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
    'errors': ['rate<0.1'],             // Error rate must be below 10%
  },
};

export default function () {
  // 1. Get stores
  const storesRes = http.get('https://api.tiendi.pe/v1/stores/nearby?lat=-12.046&lng=-77.042');
  check(storesRes, {
    'stores status is 200': (r) => r.status === 200,
    'stores response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // 2. Get products
  const productsRes = http.get('https://api.tiendi.pe/v1/products?store_id=store-123');
  check(productsRes, {
    'products status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // 3. Create order (with auth)
  const token = 'Bearer test-token';
  const payload = JSON.stringify({
    items: [{ product_id: 'prod-123', quantity: 2 }],
    delivery_address: 'Av. Arequipa 123',
  });

  const orderRes = http.post('https://api.tiendi.pe/v1/orders', payload, {
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
  });

  check(orderRes, {
    'order status is 201': (r) => r.status === 201,
  }) || errorRate.add(1);

  sleep(2);
}
```

**Ejecutar:**
```bash
k6 run --vus 100 --duration 10m performance/load-test.js
```

---

## 6. Security Tests

### 6.1 OWASP ZAP Automated Scan

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  schedule:
    - cron: '0 2 * * 0' # Weekly on Sundays at 2 AM
  workflow_dispatch:

jobs:
  zap_scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: ZAP Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'https://staging.tiendi.pe'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'
```

### 6.2 Dependency Vulnerability Scanning

```bash
# npm audit
npm audit --audit-level=high

# Snyk
snyk test --severity-threshold=high

# OWASP Dependency Check
dependency-check --project Tiendi --scan ./package.json
```

---

## 7. CI/CD Integration

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:cov

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          flags: unittests

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e:ui

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://staging.tiendi.pe
            https://staging.tiendi.pe/search
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
```

---

## 8. Cobertura de Código

### 8.1 Objetivo de Cobertura

**Por Tipo de Código:**

| Tipo | Coverage Mínimo | Objetivo |
|------|-----------------|----------|
| Services | 80% | 90% |
| Controllers | 70% | 80% |
| Utilities | 90% | 95% |
| DTOs/Entities | 60% | 70% |
| **Global** | **80%** | **85%** |

### 8.2 Monitoreo con Codecov

```yaml
# codecov.yml
coverage:
  status:
    project:
      default:
        target: 80%
        threshold: 2%
    patch:
      default:
        target: 80%

ignore:
  - "**/*.spec.ts"
  - "**/*.test.ts"
  - "**/test/**"
  - "**/migrations/**"

comment:
  require_changes: true
  require_base: yes
  require_head: yes
```

---

## 9. Test Data Management

### 9.1 Fixtures

```typescript
// test/fixtures/users.fixture.ts
export const userFixtures = {
  customer: {
    email: 'customer@test.com',
    password: 'Password123!',
    role: 'customer',
  },
  storeOwner: {
    email: 'vendor@test.com',
    password: 'Password123!',
    role: 'store_owner',
    storeId: 'store-123',
  },
  admin: {
    email: 'admin@test.com',
    password: 'Password123!',
    role: 'admin',
  },
};
```

### 9.2 Database Seeding

```typescript
// test/seeds/seed.ts
async function seedDatabase() {
  await db.users.createMany(userFixtures);
  await db.stores.createMany(storeFixtures);
  await db.products.createMany(productFixtures);
}
```

---

**Fecha de creación:** 2025-11-25
**Versión:** 1.0
**Responsable:** QA Team - Tiendi
