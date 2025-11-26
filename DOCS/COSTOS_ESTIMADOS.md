# Estimación de Costos - Sistema Tiendi

Estimación detallada de costos operacionales para el sistema de e-commerce multi-tenant Tiendi en Azure.

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Costos de Infraestructura Azure](#2-costos-de-infraestructura-azure)
3. [Costos de Servicios Externos](#3-costos-de-servicios-externos)
4. [Costos de Pasarelas de Pago](#4-costos-de-pasarelas-de-pago)
5. [Costos por Escenario de Crecimiento](#5-costos-por-escenario-de-crecimiento)
6. [Costos de Desarrollo y Personal](#6-costos-de-desarrollo-y-personal)
7. [Proyecciones Anuales](#7-proyecciones-anuales)
8. [Optimizaciones de Costo](#8-optimizaciones-de-costo)

---

## 1. Resumen Ejecutivo

### 1.1 Costo Mensual Estimado (Año 1)

| Categoría | Costo Mensual (USD) | % del Total |
|-----------|---------------------|-------------|
| **Infraestructura Azure** | $1,200 - $1,800 | 60% |
| **Servicios Externos** | $300 - $500 | 20% |
| **Pasarelas de Pago** | Variable (2.9% + fees) | 15% |
| **Otros (dominios, SSL, etc.)** | $100 | 5% |
| **TOTAL ESTIMADO** | **$1,600 - $2,400/mes** | 100% |

### 1.2 Costo por Usuario/Transacción

| Métrica | Costo Estimado |
|---------|----------------|
| Costo por usuario activo mensual | $0.80 - $1.20 |
| Costo por transacción (sin comisión pago) | $0.05 - $0.08 |
| Costo por vendedor activo mensual | $15 - $25 |

### 1.3 Break-Even Analysis

```
Ingresos necesarios mensuales:
- Costos fijos: $2,000/mes
- Con 5% de comisión en ventas: $40,000 GMV/mes
- Con 100 vendedores a $20/mes: $2,000/mes en suscripciones
- Punto de equilibrio: Mes 6-8 (proyectado)
```

---

## 2. Costos de Infraestructura Azure

### 2.1 Compute (Azure Kubernetes Service)

#### **Producción Cluster**

| Recurso | Especificaciones | Cantidad | Costo Unitario | Costo Mensual |
|---------|------------------|----------|----------------|---------------|
| **AKS Nodes** | Standard_D4s_v3<br/>(4 vCPU, 16 GB RAM) | 3-5 nodes | $140/node | $420 - $700 |
| **Load Balancer** | Standard | 1 | $25 | $25 |
| **Public IP** | Static | 2 | $3.60 | $7.20 |
| **Container Registry** | Standard (100 GB) | 1 | $20 | $20 |

**Subtotal Compute:** $472 - $752/mes

#### **Staging/DR Cluster**

| Recurso | Especificaciones | Cantidad | Costo Mensual |
|---------|------------------|----------|---------------|
| **AKS Nodes** | Standard_D2s_v3<br/>(2 vCPU, 8 GB RAM) | 2 nodes | $140 |

**Subtotal DR:** $140/mes

### 2.2 Database

#### **Azure Database for PostgreSQL - Flexible Server**

| Tier | vCores | RAM | Storage | IOPS | HA | Costo Mensual |
|------|--------|-----|---------|------|----|----|-----------|
| **Production** | 4 vCores | 32 GB | 256 GB SSD | 3,000 | Zone-redundant | $350 |
| **Backup Storage** | - | - | 35 días, geo-redundant | - | - | $40 |

**Subtotal PostgreSQL:** $390/mes

#### **Azure Cache for Redis**

| Tier | Tamaño | RAM | Costo Mensual |
|------|--------|-----|---------------|
| **Premium P1** | - | 6 GB | $158 |
| **Persistence** | RDB + AOF | - | Incluido |

**Subtotal Redis:** $158/mes

#### **Azure Cosmos DB** (MongoDB API)

| Throughput | Storage | Costo Mensual |
|------------|---------|---------------|
| 1,000 RU/s | 25 GB | $65 |

**Subtotal Cosmos DB:** $65/mes

**Total Databases:** $613/mes

### 2.3 Storage

#### **Azure Blob Storage**

| Tier | Uso Estimado | Costo por GB | Costo Mensual |
|------|--------------|--------------|---------------|
| **Hot Tier** | 100 GB (imágenes activas) | $0.018 | $1.80 |
| **Cool Tier** | 200 GB (backups) | $0.010 | $2.00 |
| **Archive** | 500 GB (logs antiguos) | $0.002 | $1.00 |
| **Transacciones** | ~500k/mes | - | $5 |

**Subtotal Storage:** $9.80/mes

### 2.4 Networking

| Recurso | Especificaciones | Costo Mensual |
|---------|------------------|---------------|
| **Azure Front Door** | Standard | $35 base + $0.25/GB |
| **Data Transfer Out** | 500 GB/mes | $40 |
| **Private Endpoints** | 3 endpoints | $21.60 |
| **Azure CDN** | 1 TB/mes | $81 |

**Subtotal Networking:** $178/mes

### 2.5 Security & Monitoring

| Recurso | Costo Mensual |
|---------|---------------|
| **Azure Key Vault** | $3 + transacciones |
| **Microsoft Defender for Cloud** | $15/resource x 5 = $75 |
| **Azure Monitor** | 10 GB logs/mes = $23 |
| **Application Insights** | $2.88/GB x 5 GB = $14.40 |

**Subtotal Security:** $115/mes

### 2.6 Resumen Infraestructura Azure

| Categoría | Costo Mensual |
|-----------|---------------|
| Compute (AKS) | $612 - $892 |
| Databases | $613 |
| Storage | $10 |
| Networking | $178 |
| Security & Monitoring | $115 |
| **TOTAL AZURE** | **$1,528 - $1,808/mes** |

---

## 3. Costos de Servicios Externos

### 3.1 Comunicaciones

#### **SendGrid** (Email)

| Plan | Emails/mes | Costo Mensual |
|------|------------|---------------|
| Essentials | 50,000 emails | $19.95 |
| **Pro (Recomendado)** | 100,000 emails | $89.95 |

**Costo por email adicional:** $0.0006

**Estimación Año 1:**
- Transaccionales: 10,000/mes
- Marketing: 20,000/mes
- **Total:** $89.95/mes

#### **Twilio** (SMS + WhatsApp)

| Servicio | Uso Estimado | Costo Unitario | Costo Mensual |
|----------|--------------|----------------|---------------|
| **SMS** (Perú) | 500 SMS/mes | $0.04/SMS | $20 |
| **WhatsApp** Business API | 1,000 mensajes/mes | $0.005/mensaje | $5 |

**Total Twilio:** $25/mes

#### **Firebase Cloud Messaging** (Push Notifications)

| Plan | Costo |
|------|-------|
| Gratis | $0 (ilimitado) |

**Total Firebase:** $0/mes

**Subtotal Comunicaciones:** $115/mes

### 3.2 APIs y Servicios

#### **Google Maps Platform**

| API | Uso Mensual | Costo por 1,000 | Costo Mensual |
|-----|-------------|-----------------|---------------|
| Maps JavaScript API | 30,000 loads | $7 | $210 |
| Geocoding API | 10,000 requests | $5 | $50 |
| Distance Matrix API | 5,000 requests | $5 | $25 |
| **Crédito mensual gratis** | - | - | -$200 |

**Total Google Maps:** $85/mes

#### **Sentry** (Error Tracking)

| Plan | Eventos/mes | Costo Mensual |
|------|-------------|---------------|
| Team | 100,000 eventos | $26 |

**Total Sentry:** $26/mes

#### **Algolia** (Search - Opcional)

Si decides usar Algolia en vez de Elasticsearch:

| Plan | Records | Searches/mes | Costo Mensual |
|------|---------|--------------|---------------|
| Grow | 100,000 | 500,000 | $149 |

**Total Algolia (Opcional):** $149/mes (No incluido en total)

**Subtotal APIs:** $111/mes

### 3.3 Herramientas de Desarrollo

| Servicio | Plan | Costo Mensual |
|----------|------|---------------|
| **GitHub** | Team (5 usuarios) | $21 |
| **Figma** | Professional (2 editores) | $30 |
| **Linear** | Standard (proyecto) | $8 |

**Subtotal Dev Tools:** $59/mes

### 3.4 Dominio y SSL

| Servicio | Costo Anual | Costo Mensual |
|----------|-------------|---------------|
| **tiendi.pe** (dominio) | $15/año | $1.25 |
| **SSL Certificate** | Gratis (Let's Encrypt) | $0 |
| **Email profesional** | Google Workspace (5 usuarios) | $30 |

**Subtotal Dominio:** $31/mes

### 3.5 Resumen Servicios Externos

| Categoría | Costo Mensual |
|-----------|---------------|
| Comunicaciones (SendGrid + Twilio) | $115 |
| APIs (Google Maps + Sentry) | $111 |
| Dev Tools | $59 |
| Dominio & Email | $31 |
| **TOTAL SERVICIOS EXTERNOS** | **$316/mes** |

---

## 4. Costos de Pasarelas de Pago

### 4.1 Niubiz (Visanet Perú)

**Estructura de Comisiones:**

| Tipo de Tarjeta | Tasa | Ejemplo (S/ 100) |
|-----------------|------|------------------|
| Tarjetas locales | 2.90% + S/ 0.30 | S/ 3.20 |
| Tarjetas internacionales | 3.50% + S/ 0.30 | S/ 3.80 |

**Costos Fijos:**
- Setup fee: $300 (una vez)
- Mensualidad: $20/mes
- Gateway fee: $0 (incluido)

**Costo Mensual Base:** $20

### 4.2 Culqi (Alternativa Perú)

**Estructura de Comisiones:**

| Tipo | Tasa | Ejemplo (S/ 100) |
|------|------|------------------|
| Tarjetas | 3.79% + S/ 0.30 | S/ 4.09 |
| Yape | 2.49% + S/ 0.30 | S/ 2.79 |

**Costos Fijos:**
- Setup: $0
- Mensualidad: $0
- Solo cobran por transacción

**Costo Mensual Base:** $0

### 4.3 Estimación de Costos por Volumen

**Asumiendo GMV mensual de S/ 50,000:**

| Pasarela | GMV (S/) | Comisión % | Costo Aprox |
|----------|----------|------------|-------------|
| Niubiz | 50,000 | 2.9% + fees | S/ 1,500 ($400) |
| Culqi | 50,000 | 3.79% + fees | S/ 1,945 ($520) |

**Nota:** Estos costos son transferidos al vendedor o incluidos en el precio. No son costo directo de la plataforma.

---

## 5. Costos por Escenario de Crecimiento

### 5.1 Escenario 1: Lanzamiento (Meses 1-3)

**Usuarios:**
- 10 vendedores activos
- 500 clientes activos
- 200 pedidos/mes

| Categoría | Costo Mensual |
|-----------|---------------|
| Azure (minimal setup) | $800 |
| Servicios Externos | $200 |
| Dominio & Tools | $90 |
| **TOTAL** | **$1,090/mes** |

### 5.2 Escenario 2: Crecimiento (Meses 4-12)

**Usuarios:**
- 100 vendedores activos
- 5,000 clientes activos
- 2,000 pedidos/mes
- GMV: S/ 100,000/mes

| Categoría | Costo Mensual |
|-----------|---------------|
| Azure | $1,528 |
| Servicios Externos | $316 |
| Dominio & Tools | $90 |
| Comisiones pago (transferidas) | Variable |
| **TOTAL** | **$1,934/mes** |

**Ingresos Potenciales:**
- Comisión 5% sobre GMV S/ 100k = S/ 5,000 ($1,333)
- Suscripciones 100 vendedores x $20 = $2,000
- **Total ingresos:** $3,333/mes
- **Margen:** $1,399/mes (41% margen)

### 5.3 Escenario 3: Escala (Año 2)

**Usuarios:**
- 500 vendedores activos
- 25,000 clientes activos
- 10,000 pedidos/mes
- GMV: S/ 500,000/mes

| Categoría | Costo Mensual |
|-----------|---------------|
| Azure (scaled up) | $3,500 |
| Servicios Externos | $800 |
| Personal adicional | $4,000 |
| **TOTAL** | **$8,300/mes** |

**Ingresos Potenciales:**
- Comisión 5% sobre GMV S/ 500k = S/ 25,000 ($6,667)
- Suscripciones 500 x $20 = $10,000
- **Total ingresos:** $16,667/mes
- **Margen:** $8,367/mes (50% margen)

---

## 6. Costos de Desarrollo y Personal

### 6.1 Equipo de Desarrollo (Año 1)

| Rol | Cantidad | Salario Mensual (USD) | Total |
|-----|----------|----------------------|-------|
| **Full Stack Developer** | 2 | $2,500 | $5,000 |
| **DevOps Engineer** | 1 | $3,000 | $3,000 |
| **UI/UX Designer** | 1 | $2,000 | $2,000 |
| **Product Manager** | 1 | $3,500 | $3,500 |
| **QA Tester** | 1 | $1,800 | $1,800 |

**Total Personal Año 1:** $15,300/mes

### 6.2 Costos One-Time (Setup Inicial)

| Item | Costo (USD) |
|------|-------------|
| Diseño de Marca (Logo, Identidad) | $1,500 |
| Setup Azure (consultoría) | $2,000 |
| Prototipado UI/UX | $3,000 |
| Setup Niubiz (certificación) | $300 |
| Certificaciones SSL Premium (opcional) | $500 |
| **TOTAL INICIAL** | **$7,300** |

### 6.3 Costos Legales

| Servicio | Costo (USD) |
|----------|-------------|
| Constitución de empresa (Perú) | $500 |
| Términos y Condiciones | $800 |
| Política de Privacidad | $500 |
| Contratos vendedores | $600 |
| Registro de Marca (INDECOPI) | $200 |
| **TOTAL LEGAL** | **$2,600** |

---

## 7. Proyecciones Anuales

### 7.1 Año 1: Lanzamiento y Crecimiento

**Costos Operacionales:**

| Mes | Azure | Servicios | Tools | Total Mensual | Acumulado |
|-----|-------|-----------|-------|---------------|-----------|
| 1-3 | $800 | $200 | $90 | $1,090 | $3,270 |
| 4-6 | $1,200 | $250 | $90 | $1,540 | $7,890 |
| 7-9 | $1,500 | $300 | $90 | $1,890 | $13,560 |
| 10-12 | $1,800 | $350 | $90 | $2,240 | $20,280 |

**Total Operacional Año 1:** $20,280

**Costos Totales Año 1:**
- Operacionales: $20,280
- Personal: $183,600 (12 meses)
- Setup inicial: $7,300
- Legal: $2,600
- **GRAN TOTAL AÑO 1:** **$213,780**

### 7.2 Ingresos Proyectados Año 1

| Mes | Vendedores | GMV (S/) | Comisión 5% | Suscripciones | Ingresos Totales |
|-----|------------|----------|-------------|---------------|------------------|
| 1-3 | 10 | 15,000 | $133 | $200 | $333 |
| 4-6 | 50 | 75,000 | $1,000 | $1,000 | $2,000 |
| 7-9 | 100 | 150,000 | $2,000 | $2,000 | $4,000 |
| 10-12 | 200 | 300,000 | $4,000 | $4,000 | $8,000 |

**Total Ingresos Año 1:** $51,996

**Pérdida Año 1:** -$161,784 (esperado en fase de crecimiento)

### 7.3 Año 2: Escala

**Proyección:**
- 500 vendedores
- GMV: S/ 6,000,000/año
- Ingresos: $180,000/año
- Costos: $120,000/año
- **Margen positivo:** +$60,000

---

## 8. Optimizaciones de Costo

### 8.1 Reservas de Azure (Savings)

**Azure Reserved Instances (3 años):**

| Recurso | Pay-as-you-go | Reserved (3y) | Ahorro Anual |
|---------|---------------|---------------|--------------|
| AKS Nodes | $8,400/año | $4,200/año | $4,200 (50%) |
| PostgreSQL | $4,200/año | $2,520/año | $1,680 (40%) |
| Redis | $1,896/año | $1,327/año | $569 (30%) |

**Ahorro Potencial Anual:** $6,449 (45% en compute)

### 8.2 Auto-Scaling Agresivo

```yaml
# Escalar down en horas de baja demanda
off_peak_hours:
  schedule: "00:00-06:00 PET"
  min_nodes: 2
  savings: ~$200/mes
```

### 8.3 Comprimir Assets

- Imágenes en WebP (80% reducción)
- CDN edge caching agresivo
- **Ahorro en bandwidth:** ~$50/mes

### 8.4 Elasticsearch vs Algolia

- **Elasticsearch (self-hosted):** $100/mes en compute
- **Algolia (SaaS):** $149/mes
- **Ahorro:** $49/mes usando Elasticsearch

### 8.5 Resumen de Optimizaciones

| Optimización | Ahorro Mensual | Ahorro Anual |
|--------------|----------------|--------------|
| Reserved Instances | $537 | $6,449 |
| Auto-scaling off-peak | $200 | $2,400 |
| Comprimir assets | $50 | $600 |
| Elasticsearch vs Algolia | $49 | $588 |
| **TOTAL AHORROS** | **$836/mes** | **$10,037/año** |

---

## 9. Recomendaciones Financieras

### 9.1 Fase de Lanzamiento (Meses 1-6)

✅ **Hacer:**
- Empezar con tier mínimo de Azure
- Usar créditos gratis (Azure $200, Google Cloud, etc.)
- Considerar founders trabajando sin sueldo inicial
- Buscar inversionistas/aceleradoras para capital semilla

❌ **Evitar:**
- Reserved Instances (muy pronto)
- Premium tiers innecesarios
- Features no-core

### 9.2 Fase de Crecimiento (Meses 7-12)

✅ **Hacer:**
- Escalar solo cuando sea necesario
- Monitorear costos semanalmente
- Optimizar queries y cache
- Implementar auto-scaling

### 9.3 Fase de Escala (Año 2+)

✅ **Hacer:**
- Comprar Reserved Instances
- Negociar descuentos por volumen con proveedores
- Considerar multi-cloud para optimizar costos
- Contratar CFO/Finance para optimización

---

## 10. Métricas Clave a Monitorear

| Métrica | Objetivo | Alerta |
|---------|----------|--------|
| **CAC** (Customer Acquisition Cost) | < $10 | > $20 |
| **LTV** (Lifetime Value) | > $100 | < $50 |
| **LTV:CAC Ratio** | > 3:1 | < 2:1 |
| **Gross Margin** | > 60% | < 40% |
| **Burn Rate** | < $20k/mes | > $30k/mes |
| **Runway** | > 12 meses | < 6 meses |

---

## Anexo A: Calculadora de Costos

**Fórmula para estimar costos mensuales:**

```typescript
function estimateMonthlyCost(params: {
  vendors: number;
  customers: number;
  ordersPerMonth: number;
  gmv: number; // En USD
}): number {
  // Azure base
  const azureBase = 800;
  const azurePerVendor = 5;
  const azurePerOrder = 0.05;

  const azureCost = azureBase +
    (params.vendors * azurePerVendor) +
    (params.ordersPerMonth * azurePerOrder);

  // Servicios externos
  const externalServices = 316;

  // Total
  return azureCost + externalServices;
}

// Ejemplo: 100 vendors, 5000 customers, 2000 orders/mes
const cost = estimateMonthlyCost({
  vendors: 100,
  customers: 5000,
  ordersPerMonth: 2000,
  gmv: 30000,
});

console.log(`Costo estimado: $${cost}/mes`);
// Output: Costo estimado: $1,616/mes
```

---

**Fecha de creación:** 2025-11-25
**Versión:** 1.0
**Próxima revisión:** 2026-01-25
**Responsable:** CFO/Finance Team - Tiendi
