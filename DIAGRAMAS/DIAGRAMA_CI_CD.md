# Diagrama de CI/CD - Sistema Tiendi

Este documento describe el pipeline de integración continua y despliegue continuo (CI/CD) del sistema.

---

## 1. Flujo Completo de CI/CD

```mermaid
sequenceDiagram
    actor Dev as Desarrollador
    participant Git as GitHub
    participant CI as GitHub Actions
    participant Test as Test Suite
    participant Build as Build Process
    participant Docker as Docker Registry
    participant CD as Deployment
    participant K8s as Kubernetes
    participant Monitor as Monitoring

    Dev->>Git: git push
    Git->>CI: Trigger workflow

    CI->>CI: Checkout code
    CI->>CI: Install dependencies

    par Run Tests
        CI->>Test: Unit tests
        Test-->>CI: Results
    and
        CI->>Test: Integration tests
        Test-->>CI: Results
    and
        CI->>Test: E2E tests
        Test-->>CI: Results
    end

    alt Tests failed
        CI-->>Dev: Notify failure
    else Tests passed
        CI->>Build: Build application
        Build->>Build: Compile TypeScript
        Build->>Build: Bundle assets
        Build->>Build: Optimize images
        Build-->>CI: Build artifacts

        CI->>Docker: Build Docker image
        Docker->>Docker: Tag image
        Docker-->>CI: Image ready

        CI->>Docker: Push to registry
        Docker-->>CI: Image pushed

        CI->>CD: Trigger deployment
        CD->>K8s: Apply manifests
        K8s->>K8s: Rolling update
        K8s->>K8s: Health checks

        alt Deployment failed
            K8s->>K8s: Rollback
            K8s-->>Dev: Notify failure
        else Deployment success
            K8s->>Monitor: Register deployment
            Monitor->>Monitor: Start monitoring
            Monitor-->>Dev: Notify success
        end
    end
```

---

## 2. Configuración de GitHub Actions

### 2.1 Workflow Principal

```yaml
# .github/workflows/main.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20.x'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Job 1: Linting y Type Checking
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npm run type-check

  # Job 2: Unit Tests
  test-unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unit

  # Job 3: Integration Tests
  test-integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: tiendi_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run migrate:test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/tiendi_test

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/tiendi_test
          REDIS_URL: redis://localhost:6379

  # Job 4: E2E Tests
  test-e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  # Job 5: Build Docker Image
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration, test-e2e]
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # Job 6: Deploy to Staging
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.tiendi.com
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG_STAGING }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/tiendi-api \
            tiendi-api=${{ needs.build.outputs.image-tag }} \
            -n staging

          kubectl rollout status deployment/tiendi-api -n staging

      - name: Run smoke tests
        run: npm run test:smoke
        env:
          BASE_URL: https://staging.tiendi.com

  # Job 7: Deploy to Production
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://tiendi.com
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG_PROD }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/tiendi-api \
            tiendi-api=${{ needs.build.outputs.image-tag }} \
            -n production

          kubectl rollout status deployment/tiendi-api -n production

      - name: Run smoke tests
        run: npm run test:smoke
        env:
          BASE_URL: https://tiendi.com

      - name: Notify Slack
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "✅ Deployment to production successful!",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Deployment to Production*\n✅ Successfully deployed to production\n*Image:* ${{ needs.build.outputs.image-tag }}"
                  }
                }
              ]
            }
```

---

## 3. Dockerfile Optimizado

### 3.1 Multi-stage Build

```dockerfile
# Dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

USER nextjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### 3.2 .dockerignore

```
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.DS_Store
coverage
.next
dist
build
*.md
.vscode
.idea
```

---

## 4. Kubernetes Manifests

### 4.1 Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiendi-api
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: tiendi-api
  template:
    metadata:
      labels:
        app: tiendi-api
        version: v1
    spec:
      containers:
      - name: tiendi-api
        image: ghcr.io/tiendi/tiendi-api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: tiendi-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: tiendi-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
```

### 4.2 Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: tiendi-api
  namespace: production
spec:
  type: ClusterIP
  selector:
    app: tiendi-api
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
```

### 4.3 Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiendi-ingress
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.tiendi.com
    secretName: tiendi-tls
  rules:
  - host: api.tiendi.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: tiendi-api
            port:
              number: 80
```

### 4.4 HorizontalPodAutoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tiendi-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tiendi-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 2
        periodSeconds: 15
      selectPolicy: Max
```

---

## 5. Estrategias de Deployment

### 5.1 Rolling Update (Predeterminado)
- Actualización gradual de pods
- Zero downtime
- Rollback automático si falla health check

### 5.2 Blue-Green Deployment
```yaml
# Service apunta a "blue"
apiVersion: v1
kind: Service
metadata:
  name: tiendi-api
spec:
  selector:
    app: tiendi-api
    version: blue  # Cambiar a "green" para switch

---
# Deployment Blue
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiendi-api-blue
spec:
  selector:
    matchLabels:
      app: tiendi-api
      version: blue
  template:
    metadata:
      labels:
        version: blue

---
# Deployment Green
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiendi-api-green
spec:
  selector:
    matchLabels:
      app: tiendi-api
      version: green
  template:
    metadata:
      labels:
        version: green
```

### 5.3 Canary Deployment
```yaml
# 90% traffic to stable
apiVersion: v1
kind: Service
metadata:
  name: tiendi-api-stable
spec:
  selector:
    app: tiendi-api
    version: stable

---
# 10% traffic to canary
apiVersion: v1
kind: Service
metadata:
  name: tiendi-api-canary
spec:
  selector:
    app: tiendi-api
    version: canary

---
# Ingress con weight
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiendi-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
  - host: api.tiendi.com
    http:
      paths:
      - backend:
          service:
            name: tiendi-api-canary
            port:
              number: 80
```

---

## 6. Monitoreo del Deployment

### 6.1 Health Checks

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
```

### 6.2 Métricas de Deployment

```yaml
# ServiceMonitor para Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: tiendi-api
  namespace: production
spec:
  selector:
    matchLabels:
      app: tiendi-api
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
