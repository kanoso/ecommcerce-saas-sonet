# Arquitectura de Observabilidad - Sistema Tiendi

Sistema de monitoreo, logs, métricas, trazas distribuidas y alertas.

---

## Los 3 Pilares de Observabilidad

```mermaid
graph TB
    subgraph "Applications"
        WEB[Web Application]
        API[API Services]
        WORKERS[Background Workers]
        DB[(Databases)]
    end

    subgraph "Observability Stack"
        subgraph "📊 METRICS"
            PROMETHEUS[Prometheus<br/>Time-series DB]
            GRAFANA[Grafana<br/>Dashboards]
        end

        subgraph "📝 LOGS"
            LOKI[Loki / ELK<br/>Log Aggregation]
            LOG_VIEWER[Log Viewer]
        end

        subgraph "🔍 TRACES"
            TEMPO[Tempo / Jaeger<br/>Distributed Tracing]
            TRACE_UI[Trace UI]
        end
    end

    subgraph "Alerting"
        ALERT_MGR[Alertmanager]
        PAGERDUTY[PagerDuty]
        SLACK[Slack]
        EMAIL[Email]
    end

    WEB -->|Metrics| PROMETHEUS
    API -->|Metrics| PROMETHEUS
    WORKERS -->|Metrics| PROMETHEUS
    DB -->|Metrics| PROMETHEUS

    WEB -->|Logs| LOKI
    API -->|Logs| LOKI
    WORKERS -->|Logs| LOKI

    WEB -->|Traces| TEMPO
    API -->|Traces| TEMPO
    WORKERS -->|Traces| TEMPO

    PROMETHEUS --> GRAFANA
    LOKI --> LOG_VIEWER
    TEMPO --> TRACE_UI

    PROMETHEUS --> ALERT_MGR
    ALERT_MGR --> PAGERDUTY
    ALERT_MGR --> SLACK
    ALERT_MGR --> EMAIL

    style PROMETHEUS fill:#e74c3c,color:#fff
    style LOKI fill:#f39c12,color:#fff
    style TEMPO fill:#3498db,color:#fff
    style ALERT_MGR fill:#e67e22,color:#fff
```

---

## Arquitectura Completa de Observabilidad

```mermaid
graph TB
    subgraph "Data Sources"
        APP1[App Server 1]
        APP2[App Server 2]
        APP3[App Server 3]
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        NGINX[NGINX]
    end

    subgraph "Collection Layer"
        PROM_EXPORTER[Node Exporter<br/>Metrics]
        LOG_AGENT[Promtail / Fluent Bit<br/>Logs]
        OTEL[OpenTelemetry Collector<br/>Traces]
    end

    subgraph "Storage & Processing"
        PROMETHEUS[Prometheus<br/>Metrics Storage]
        LOKI[Loki<br/>Log Storage]
        TEMPO[Tempo<br/>Trace Storage]
        S3[Azure Blob<br/>Long-term Storage]
    end

    subgraph "Query & Visualization"
        GRAFANA[Grafana<br/>Unified Dashboard]
        EXPLORE[Grafana Explore]
    end

    subgraph "Alerting & Incident"
        ALERT_MGR[Alertmanager]
        ONCALL[On-Call Rotation]
        INCIDENT[Incident Management]
    end

    APP1 --> PROM_EXPORTER
    APP2 --> PROM_EXPORTER
    APP3 --> PROM_EXPORTER
    PG --> PROM_EXPORTER
    REDIS --> PROM_EXPORTER
    NGINX --> PROM_EXPORTER

    APP1 --> LOG_AGENT
    APP2 --> LOG_AGENT
    APP3 --> LOG_AGENT

    APP1 --> OTEL
    APP2 --> OTEL
    APP3 --> OTEL

    PROM_EXPORTER --> PROMETHEUS
    LOG_AGENT --> LOKI
    OTEL --> TEMPO

    PROMETHEUS --> S3
    LOKI --> S3
    TEMPO --> S3

    PROMETHEUS --> GRAFANA
    LOKI --> GRAFANA
    TEMPO --> GRAFANA

    GRAFANA --> EXPLORE

    PROMETHEUS --> ALERT_MGR
    ALERT_MGR --> ONCALL
    ONCALL --> INCIDENT

    style GRAFANA fill:#2ecc71,color:#fff
    style ALERT_MGR fill:#e74c3c,color:#fff
```

---

## Stack de Métricas (Prometheus + Grafana)

```mermaid
graph LR
    subgraph "Applications"
        APP[Node.js App<br/>/metrics endpoint]
        EXPORTER1[PostgreSQL Exporter]
        EXPORTER2[Redis Exporter]
        EXPORTER3[Node Exporter]
    end

    subgraph "Prometheus"
        PROM[Prometheus Server]
        SCRAPER[Scraper<br/>every 15s]
        TSDB[Time-Series DB]
        RULES[Recording Rules<br/>Alerting Rules]
    end

    subgraph "Visualization"
        GRAFANA[Grafana]
        DASH1[Application Dashboard]
        DASH2[Infrastructure Dashboard]
        DASH3[Business Metrics]
    end

    APP -->|HTTP GET /metrics| SCRAPER
    EXPORTER1 -->|Expose metrics| SCRAPER
    EXPORTER2 -->|Expose metrics| SCRAPER
    EXPORTER3 -->|Expose metrics| SCRAPER

    SCRAPER --> TSDB
    TSDB --> RULES

    TSDB --> GRAFANA
    GRAFANA --> DASH1
    GRAFANA --> DASH2
    GRAFANA --> DASH3

    style PROM fill:#e74c3c,color:#fff
    style GRAFANA fill:#f39c12,color:#fff
```

---

## Stack de Logs (Loki)

```mermaid
graph LR
    subgraph "Log Sources"
        APP1[App stdout/stderr]
        APP2[Log Files]
        DOCKER[Docker Logs]
        K8S[Kubernetes Logs]
    end

    subgraph "Collection"
        PROMTAIL[Promtail Agent]
        DOCKER_DRIVER[Docker Log Driver]
    end

    subgraph "Loki"
        DISTRIBUTOR[Distributor]
        INGESTER[Ingester]
        QUERIER[Querier]
        STORAGE[(Azure Blob)]
    end

    subgraph "Query"
        GRAFANA[Grafana<br/>LogQL]
        ALERTS[Log-based Alerts]
    end

    APP1 --> PROMTAIL
    APP2 --> PROMTAIL
    DOCKER --> DOCKER_DRIVER
    K8S --> PROMTAIL

    PROMTAIL --> DISTRIBUTOR
    DOCKER_DRIVER --> DISTRIBUTOR

    DISTRIBUTOR --> INGESTER
    INGESTER --> STORAGE
    STORAGE --> QUERIER

    QUERIER --> GRAFANA
    QUERIER --> ALERTS

    style LOKI fill:#f39c12,color:#fff
    style GRAFANA fill:#2ecc71,color:#fff
```

---

## Distributed Tracing (Tempo / Jaeger)

```mermaid
sequenceDiagram
    participant User
    participant Gateway as API Gateway<br/>TraceID: abc123
    participant Order as Order Service<br/>SpanID: span1
    participant Payment as Payment Service<br/>SpanID: span2
    participant DB as PostgreSQL<br/>SpanID: span3
    participant Tempo as Tempo

    User->>Gateway: POST /orders

    Gateway->>Gateway: Generate TraceID: abc123<br/>SpanID: span-gateway

    Gateway->>Order: Create order<br/>Headers: traceparent=abc123

    Order->>Order: Start span: span1<br/>Parent: span-gateway

    Order->>Payment: Process payment<br/>Headers: traceparent=abc123

    Payment->>Payment: Start span: span2<br/>Parent: span1

    Payment->>DB: INSERT payment

    DB->>DB: Start span: span3<br/>Parent: span2

    DB-->>Payment: Success

    Payment-->>Order: Payment OK

    Order->>DB: INSERT order

    DB-->>Order: Success

    Order-->>Gateway: Order created

    Gateway-->>User: 201 Created

    Note over Gateway,Tempo: All spans exported to Tempo

    Gateway->>Tempo: Export span-gateway
    Order->>Tempo: Export span1
    Payment->>Tempo: Export span2

    Note over Tempo: Trace abc123 assembled<br/>Total duration: 450ms<br/>- Gateway: 450ms<br/>  - Order: 380ms<br/>    - Payment: 250ms<br/>      - DB: 50ms<br/>    - DB: 80ms
```

---

## Métricas Clave (Golden Signals)

### RED Method (Requests, Errors, Duration)

```yaml
Requests (Rate):
  - http_requests_total
  - rate(http_requests_total[5m])

Errors (Error Rate):
  - http_requests_failed_total
  - rate(http_requests_failed_total[5m]) / rate(http_requests_total[5m])

Duration (Latency):
  - http_request_duration_seconds
  - histogram_quantile(0.95, http_request_duration_seconds)
```

### USE Method (Utilization, Saturation, Errors)

```yaml
Utilization:
  - node_cpu_seconds_total
  - node_memory_usage_bytes / node_memory_total_bytes

Saturation:
  - node_load1 / node_cpu_count
  - rate(node_disk_io_time_seconds_total[5m])

Errors:
  - node_network_transmit_errs_total
  - node_filesystem_readonly
```

---

## Dashboards de Grafana

### Dashboard 1: Application Overview

```yaml
Panels:
  - Request Rate (req/s)
  - Error Rate (%)
  - P95 Latency (ms)
  - Active Users
  - Database Connections
  - Cache Hit Rate
  - Queue Length
  - Background Job Success Rate

Queries:
  - rate(http_requests_total[5m])
  - rate(http_errors_total[5m]) / rate(http_requests_total[5m]) * 100
  - histogram_quantile(0.95, http_request_duration_seconds_bucket[5m])
```

### Dashboard 2: Infrastructure

```yaml
Panels:
  - CPU Usage per Node
  - Memory Usage per Node
  - Disk I/O
  - Network Traffic
  - Pod Status (Kubernetes)
  - Node Health

Queries:
  - 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
  - (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100
```

### Dashboard 3: Business Metrics

```yaml
Panels:
  - GMV (Gross Merchandise Value)
  - Orders per Minute
  - Conversion Rate
  - Payment Success Rate
  - Average Order Value
  - Active Stores
  - Revenue per Store

Queries:
  - sum(rate(orders_total_amount[5m])) * 60
  - rate(orders_completed_total[1m]) * 60
  - rate(orders_completed_total[5m]) / rate(store_visits_total[5m]) * 100
```

---

## Alertas Críticas

### Configuración de Alertmanager

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/...'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: 'default'
    email_configs:
      - to: 'team@tiendi.com'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<key>'

  - name: 'slack'
    slack_configs:
      - channel: '#alerts'
        title: 'Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

### Reglas de Alerta (Prometheus)

```yaml
# alerts.yml
groups:
  - name: application
    interval: 30s
    rules:
      # Alta tasa de errores
      - alert: HighErrorRate
        expr: |
          rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Alta tasa de errores: {{ $value }}%"
          description: "El servicio {{ $labels.service }} tiene más de 5% de errores"

      # Latencia alta
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency > 1s"
          description: "Latencia P95: {{ $value }}s"

      # Base de datos lenta
      - alert: SlowDatabaseQueries
        expr: |
          rate(postgres_slow_queries_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queries lentas detectadas"

      # Baja tasa de éxito de pagos
      - alert: LowPaymentSuccessRate
        expr: |
          rate(payment_success_total[10m]) / rate(payment_attempts_total[10m]) < 0.95
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "Tasa de éxito de pagos < 95%"
          description: "Solo {{ $value }}% de pagos exitosos"

  - name: infrastructure
    rules:
      # CPU alta
      - alert: HighCPUUsage
        expr: |
          100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "CPU > 80% en {{ $labels.instance }}"

      # Memoria alta
      - alert: HighMemoryUsage
        expr: |
          (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
          / node_memory_MemTotal_bytes * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Memoria > 90% en {{ $labels.instance }}"

      # Disco lleno
      - alert: DiskSpaceLow
        expr: |
          (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disco < 10% libre en {{ $labels.instance }}"

      # Servicio caído
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Servicio {{ $labels.job }} está DOWN"
```

---

## Instrumentación de Aplicaciones

### Node.js + Express

```typescript
import express from 'express';
import promClient from 'prom-client';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const app = express();

// Configurar Prometheus
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Métricas custom
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);

// Middleware de métricas
app.use((req, res, next) => {
  const start = Date.now();

  // Crear span para tracing
  const tracer = trace.getTracer('tiendi-api');
  const span = tracer.startSpan(`${req.method} ${req.path}`);

  span.setAttributes({
    'http.method': req.method,
    'http.url': req.url,
    'http.user_agent': req.get('user-agent')
  });

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    // Registrar métricas
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode },
      duration
    );

    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    });

    // Finalizar span
    span.setAttributes({
      'http.status_code': res.statusCode
    });

    if (res.statusCode >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    }

    span.end();
  });

  next();
});

// Endpoint de métricas para Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Logs estructurados
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'tiendi-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    user_id: req.user?.id
  });
  next();
});
```

---

## LogQL Queries (Loki)

```logql
# Buscar errores en los últimos 5 minutos
{app="tiendi-api"} |= "error" | json | line_format "{{.timestamp}} {{.level}} {{.message}}"

# Contar errores por servicio
sum by (service) (count_over_time({app="tiendi-api"} |= "error" [5m]))

# Latencia P95 de queries SQL
quantile_over_time(0.95,
  {app="tiendi-api"}
  | json
  | line_format "{{.query_duration}}"
  | unwrap query_duration [5m]
)

# Errores 500 agrupados por endpoint
{app="tiendi-api"}
  |= "status_code=500"
  | json
  | line_format "{{.endpoint}}"
  | count by (endpoint)

# Logs de un usuario específico
{app="tiendi-api"}
  | json
  | user_id="user_123"
  | line_format "{{.timestamp}} {{.level}} {{.message}}"
```

---

## PromQL Queries (Prometheus)

```promql
# Tasa de requests por segundo
rate(http_requests_total[5m])

# Error rate (últimos 5 min)
rate(http_errors_total[5m]) / rate(http_requests_total[5m]) * 100

# Latencia P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Throughput por endpoint
sum by (route) (rate(http_requests_total[5m]))

# CPU usage por pod
sum by (pod) (rate(container_cpu_usage_seconds_total[5m])) * 100

# Memoria usada
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / 1024 / 1024 / 1024

# Queries lentas en PostgreSQL (>1s)
rate(postgres_query_duration_seconds_bucket{le="1"}[5m])

# Redis cache hit rate
rate(redis_keyspace_hits_total[5m]) /
  (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) * 100
```

---

## SLOs (Service Level Objectives)

```yaml
SLO: Availability
  Objective: 99.9% uptime
  Error Budget: 0.1% = 43 minutes/month
  Measurement: rate(http_requests_total{status_code!~"5.."}[30d]) / rate(http_requests_total[30d])

SLO: Latency
  Objective: P95 < 500ms
  Error Budget: 5% of requests > 500ms
  Measurement: histogram_quantile(0.95, http_request_duration_seconds_bucket[30d])

SLO: Payment Success Rate
  Objective: 99.5% success rate
  Error Budget: 0.5% failures
  Measurement: rate(payment_success_total[30d]) / rate(payment_attempts_total[30d])
```

---

## Costos Estimados

### Opción 1: Self-Hosted (VMs en Azure)

```
- VM para Prometheus (D2s v3): $70/mes
- VM para Loki (D4s v3): $140/mes
- VM para Tempo (D2s v3): $70/mes
- VM para Grafana (B2s): $40/mes
- Azure Blob Storage (500GB): $10/mes
Total: ~$330/mes
```

### Opción 2: Managed Services

```
- Grafana Cloud (Pro): $299/mes
  - Incluye: Prometheus, Loki, Tempo, Grafana
  - 50GB logs, 10K series, 50GB traces
- Azure Monitor: $200/mes
Total: ~$499/mes
```

---

**Fecha de creación:** 2025-01-24
**Versión:** 1.0
