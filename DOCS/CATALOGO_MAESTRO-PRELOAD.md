---
tags:
  - tiendi
  - catalogo-maestro
  - gtin
  - import
  - gs1
  - decision
aliases:
  - Precarga del Catálogo Maestro
  - Import masivo de MasterProduct
  - MasterProductSource IMPORT/GS1
---

# Precarga del Catálogo Maestro: estado actual y camino a seguir

> [!IMPORTANT]
> **Respuesta corta: hoy no existe ningún mecanismo de precarga o import masivo.** El catálogo se completa exclusivamente producto por producto, cuando un vendedor da de alta o edita un artículo con GTIN. Esto no es un olvido — es una decisión de diseño documentada en [[CATALOGO_MAESTRO#9.3 Sin backfill|CATALOGO_MAESTRO §9.3]] y en la decisión **C3** de [[CATALOGO_MAESTRO#10.3 Decisiones que hay que tomar|CATALOGO_MAESTRO §10.3]].

Este documento complementa a [[CATALOGO_MAESTRO]] respondiendo puntualmente a la pregunta: *¿cómo obtenemos productos y los dejamos precargados en el catálogo maestro?*

---

## 1. Cómo se completa el catálogo hoy

El único camino de entrada es orgánico:

1. Un vendedor crea o edita un `Product` con `gtin` en el panel de `tiendi-vendor`.
2. `ProductsService.create()` / `.update()` extrae `gtin`, `netContent`, `uom` del DTO y llama a `MasterCatalogService.resolve()` **antes** del spread del resto de campos (`products.service.ts`).
3. `resolve()` normaliza el GTIN, arma el `matchKey` (`gtin:...` o `attr:...`), y crea o vincula el `MasterProduct` correspondiente vía `upsert` idempotente.

No hay un segundo camino. No hay un job, un script, ni un endpoint que inserte productos en el catálogo maestro sin que pase por un alta real de un vendedor.

## 2. Evidencia de código

`MasterProductSource` es un enum de 4 valores en `schema.prisma`:

```prisma
enum MasterProductSource {
  VENDOR
  ADMIN
  IMPORT
  GS1
}
```

Búsqueda de todos los usos reales de `MasterProductSource.<valor>` en `tiendi-api`:

```
tiendi-api/src/modules/master-catalog/master-catalog.service.ts:120
    source: MasterProductSource.VENDOR,
```

**Un solo resultado en todo el proyecto.** `ADMIN`, `IMPORT` y `GS1` están declarados en el schema pero ningún código los asigna jamás. Son un hueco reservado para el futuro, no una feature que quedó a medio construir.

## 3. Por qué no existe (decisión, no descuido)

`CATALOGO_MAESTRO.md` lo dice explícitamente en dos lugares:

> **§9.3 — Sin backfill**
> Al estar en pre-lanzamiento no hay datos de producción que migrar.

> **§10.3 — Decisión C3**
> ¿Enriquecer desde catálogo GS1 externo? → **Después.** Primero medir cuánto del catálogo real llega con GTIN; el costo de licencia no se justifica sin ese dato.

El razonamiento es correcto: GS1 cobra licencia de acceso a su base de datos de productos. Pagarla antes de saber si los vendedores efectivamente escanean códigos de barras sería gastar sin tener el dato que justifica el gasto. La estrategia elegida es medir primero (métrica ya implementada: *"porcentaje de productos nuevos con GTIN válido"*, objetivo 60%, §11 Fase 7) y decidir después.

## 4. Cómo construir la precarga cuando se decida hacerla

No hace falta diseñar nada nuevo. Toda la lógica de normalización, validación de dígito verificador y dedupe por `matchKey` ya está construida en `MasterCatalogService.resolve()`. Precargar es, en esencia, invocar ese mismo método en batch.

### 4.1 Piezas a agregar

| Pieza | Detalle |
|-------|---------|
| Fuente de datos | CSV propio, exportación de un proveedor, o feed de GS1 (recién ahí se paga la licencia) |
| Endpoint o script | `POST /master-products/import` (admin) o un comando de Nest CLI, según si se quiere repetible desde el panel o es una corrida única |
| Lógica | Iterar cada fila → `resolve()` con `source: MasterProductSource.IMPORT` (o `GS1` si viene de esa fuente) en vez del default `VENDOR` |
| Estado inicial | Crear los `MasterProduct` en `PENDING`, igual que hoy — no saltarse la revisión solo por venir de import |
| Reporte | Devolver cuántos se crearon, cuántos matchearon con un maestro existente (posible duplicado a revisar), cuántos fallaron validación de GTIN |

### 4.2 Por qué conviene esperar la señal de C3 antes de construirlo

Precargar productos que nadie termina vendiendo genera el mismo problema que ya está mapeado como riesgo en [[CATALOGO_MAESTRO#10.2 Detalle y mitigación|CATALOGO_MAESTRO §10.2]] — *"catálogo muerto es trabajo desperdiciado"* (mismo argumento usado para la decisión C2 sobre verificación de `PENDING`). Construir el import antes de tener la métrica de captura de GTIN es resolver un problema que todavía no se confirmó que existe.

---

## 5. Referencias internas

- [[CATALOGO_MAESTRO]] — documento maestro de la feature completa
- [[CATALOGO_MAESTRO#9.3 Sin backfill]] — por qué no hubo backfill en el lanzamiento
- [[CATALOGO_MAESTRO#10.3 Decisiones que hay que tomar]] — decisión C3
- [[MODELO_NEGOCIO]] — acción A1, contexto de negocio del catálogo maestro
