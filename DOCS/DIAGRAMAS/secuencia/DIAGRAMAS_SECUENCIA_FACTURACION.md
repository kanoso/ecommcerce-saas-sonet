# Diagramas de Secuencia - Facturación Electrónica (SUNAT) - Sistema Tiendi

Sistema de emisión de comprobantes electrónicos para cumplir con regulaciones peruanas.

---

## 1. Emisión de Boleta Electrónica

```mermaid
sequenceDiagram
    actor Customer as Cliente
    participant Web as Web App
    participant Gateway as API Gateway
    participant Invoice as Invoice Service
    participant PSE as PSE (Nubefact/FactuSol)
    participant SUNAT as SUNAT API
    participant Storage as Azure Blob
    participant DB as PostgreSQL
    participant Email as Email Service

    Customer->>Web: Completar compra<br/>Total: S/ 125.00

    Web->>Gateway: POST /orders (create order)

    Gateway->>Invoice: Generate invoice

    Note over Invoice: Verificar si necesita<br/>comprobante electrónico

    Invoice->>DB: SELECT * FROM stores<br/>WHERE id = ?

    DB-->>Invoice: Store: {<br/>  ruc: "20123456789",<br/>  requires_invoice: true<br/>}

    Invoice->>Invoice: Preparar datos:<br/>- Tipo: BOLETA (03)<br/>- Serie: B001<br/>- Número: secuencial<br/>- Cliente: Consumidor Final<br/>- Items con IGV

    Invoice->>PSE: POST /boletas<br/>{<br/>  serie_numero: "B001-00123",<br/>  fecha_emision: "2025-01-24",<br/>  cliente: {<br/>    tipo_documento: "1" (DNI),<br/>    numero_documento: "12345678",<br/>    denominacion: "Juan Pérez"<br/>  },<br/>  items: [<br/>    {<br/>      descripcion: "Cerveza Pilsen 6-pack",<br/>      cantidad: 2,<br/>      valor_unitario: 13.56,<br/>      igv: 2.44,<br/>      total: 16.00<br/>    }<br/>  ],<br/>  totales: {<br/>    gravadas: 106.78,<br/>    igv: 19.22,<br/>    total: 126.00<br/>  }<br/>}

    PSE->>PSE: Generar XML según<br/>formato UBL 2.1

    PSE->>PSE: Firmar digitalmente<br/>con certificado

    PSE->>SUNAT: POST /comprobantes<br/>(enviar XML firmado)

    SUNAT->>SUNAT: Validar comprobante

    alt Comprobante válido
        SUNAT-->>PSE: CDR (Constancia)<br/>Estado: Aceptado<br/>Hash: abc123...

        PSE->>PSE: Generar PDF

        PSE-->>Invoice: {<br/>  estado: "aceptado",<br/>  cdr_hash: "abc123...",<br/>  pdf_url: "https://...",<br/>  xml_url: "https://..."<br/>}

        Invoice->>Storage: Guardar PDF y XML<br/>invoices/B001-00123/

        Storage-->>Invoice: Almacenado

        Invoice->>DB: INSERT INTO invoices<br/>{<br/>  order_id,<br/>  type: 'boleta',<br/>  series: 'B001',<br/>  number: '00123',<br/>  full_number: 'B001-00123',<br/>  ruc_issuer: '20123456789',<br/>  document_customer: '12345678',<br/>  total: 126.00,<br/>  igv: 19.22,<br/>  status: 'accepted',<br/>  cdr_hash,<br/>  pdf_url,<br/>  xml_url<br/>}

        DB-->>Invoice: Invoice saved

        Invoice->>Email: Send to customer<br/>Adjuntar PDF

        Email-->>Customer: 📧 Email con boleta

        Invoice-->>Gateway: Invoice created

        Gateway-->>Web: Order confirmed

        Web-->>Customer: ✅ Compra exitosa<br/><br/>📄 Boleta: B001-00123<br/>💰 Total: S/ 126.00<br/><br/>📨 Te enviamos tu<br/>comprobante por email

    else Comprobante rechazado
        SUNAT-->>PSE: Error: [código error]<br/>Motivo: "RUC inválido"

        PSE-->>Invoice: {<br/>  estado: "rechazado",<br/>  error: "RUC inválido"<br/>}

        Invoice->>DB: INSERT INTO invoices<br/>{..., status: 'rejected', error}

        Invoice-->>Gateway: 500 Error

        Gateway-->>Web: Error

        Web-->>Customer: ❌ Error al generar<br/>comprobante.<br/>Contacta a soporte.
    end
```

---

## 2. Emisión de Factura Electrónica (con RUC)

```mermaid
sequenceDiagram
    actor Customer as Cliente Empresa
    participant Web as Web App
    participant Gateway as API Gateway
    participant Invoice as Invoice Service
    participant PSE as PSE API
    participant SUNAT as SUNAT
    participant DB as PostgreSQL

    Customer->>Web: Checkout<br/>Solicitar factura

    Web-->>Customer: Formulario fiscal:<br/>- RUC<br/>- Razón social<br/>- Dirección fiscal

    Customer->>Web: Ingresar:<br/>RUC: 20987654321<br/>Razón: EMPRESA SAC

    Web->>Gateway: POST /orders<br/>{..., invoice_data: {ruc, ...}}

    Gateway->>Invoice: Validate RUC

    Invoice->>SUNAT: GET /contribuyentes/{ruc}

    SUNAT-->>Invoice: {<br/>  razon_social: "EMPRESA SAC",<br/>  estado: "ACTIVO",<br/>  condicion: "HABIDO",<br/>  direccion: "Av. Principal..."<br/>}

    alt RUC válido y activo
        Invoice->>PSE: POST /facturas<br/>{<br/>  serie_numero: "F001-00456",<br/>  tipo: "01" (FACTURA),<br/>  cliente: {<br/>    tipo_documento: "6" (RUC),<br/>    numero_documento: "20987654321",<br/>    denominacion: "EMPRESA SAC",<br/>    direccion: "Av. Principal..."<br/>  },<br/>  items: [...],<br/>  totales: {<br/>    gravadas: 212.71,<br/>    igv: 38.29,<br/>    total: 251.00<br/>  },<br/>  detraccion: null<br/>}

        PSE->>SUNAT: Enviar factura

        SUNAT-->>PSE: Aceptado + CDR

        PSE-->>Invoice: Factura emitida

        Invoice->>DB: Save invoice

        Invoice-->>Gateway: Success

        Gateway-->>Web: Invoice created

        Web-->>Customer: ✅ Factura emitida<br/><br/>📄 F001-00456<br/>🏢 EMPRESA SAC<br/>RUC: 20987654321<br/>💰 Total: S/ 251.00

    else RUC inválido o inactivo
        Invoice-->>Gateway: 400 Bad Request<br/>"RUC no activo o no habido"

        Gateway-->>Web: Error

        Web-->>Customer: ❌ RUC inválido<br/><br/>Verifica que el RUC esté<br/>activo y habido en SUNAT
    end
```

---

## 3. Nota de Crédito (Anulación)

```mermaid
sequenceDiagram
    actor Vendor as Vendedor
    participant Dashboard as Vendor Dashboard
    participant Gateway as API Gateway
    participant Invoice as Invoice Service
    participant PSE as PSE API
    participant SUNAT as SUNAT
    participant DB as PostgreSQL
    participant Email as Email Service

    Vendor->>Dashboard: Anular comprobante<br/>F001-00456

    Dashboard->>Gateway: POST /invoices/{id}/credit-note<br/>{<br/>  motivo: "01" (Anulación),<br/>  descripcion: "Cliente devolvió<br/>  productos"<br/>}

    Gateway->>Invoice: Create credit note

    Invoice->>DB: SELECT * FROM invoices<br/>WHERE id = ?

    DB-->>Invoice: Original invoice data

    Invoice->>Invoice: Verificar:<br/>- Estado: "accepted"<br/>- Fecha < 7 días<br/>- No tiene nota previa

    alt Puede emitir nota
        Invoice->>PSE: POST /notas-credito<br/>{<br/>  serie_numero: "FC01-00012",<br/>  tipo: "07" (NOTA CRÉDITO),<br/>  tipo_motivo: "01",<br/>  descripcion_motivo: "Anulación",<br/>  comprobante_afectado: {<br/>    tipo: "01",<br/>    serie_numero: "F001-00456"<br/>  },<br/>  items: [mismos items],<br/>  totales: [mismos totales]<br/>}

        PSE->>SUNAT: Enviar nota de crédito

        SUNAT-->>PSE: Aceptado + CDR

        PSE-->>Invoice: Nota emitida

        Invoice->>DB: INSERT INTO credit_notes<br/>{<br/>  invoice_id,<br/>  series: 'FC01',<br/>  number: '00012',<br/>  reason_code: '01',<br/>  status: 'accepted'<br/>}

        Invoice->>DB: UPDATE invoices<br/>SET status = 'voided',<br/>    voided_at = NOW()<br/>WHERE id = ?

        Invoice->>Email: Send to customer<br/>"Nota de crédito emitida"

        Invoice-->>Gateway: Credit note created

        Gateway-->>Dashboard: Success

        Dashboard-->>Vendor: ✅ Nota de crédito:<br/>FC01-00012<br/><br/>Factura F001-00456<br/>fue anulada

    else No puede emitir nota
        Invoice-->>Gateway: 400 Bad Request<br/>"Comprobante no puede<br/>ser anulado"

        Gateway-->>Dashboard: Error

        Dashboard-->>Vendor: ❌ No se puede anular<br/><br/>Motivo: Han pasado más<br/>de 7 días desde la emisión
    end
```

---

## 4. Resumen Diario (RC - Bajas)

```mermaid
sequenceDiagram
    participant Cron as Cron Job<br/>00:00 AM
    participant Invoice as Invoice Service
    participant PSE as PSE API
    participant SUNAT as SUNAT
    participant DB as PostgreSQL

    Cron->>Invoice: Generate daily summary

    Invoice->>DB: SELECT * FROM invoices<br/>WHERE status = 'pending_void'<br/>  AND DATE(created_at) = YESTERDAY

    DB-->>Invoice: Voided invoices list

    Invoice->>Invoice: Agrupar por día<br/>de emisión

    Invoice->>PSE: POST /resumen-diario<br/>{<br/>  fecha_generacion: "2025-01-25",<br/>  fecha_referencia: "2025-01-24",<br/>  documentos: [<br/>    {<br/>      tipo: "03" (BOLETA),<br/>      serie_numero: "B001-00123",<br/>      estado: "3" (ANULADO),<br/>      total: 126.00<br/>    },<br/>    {<br/>      tipo: "03",<br/>      serie_numero: "B001-00124",<br/>      estado: "3",<br/>      total: 89.50<br/>    }<br/>  ]<br/>}

    PSE->>SUNAT: Enviar resumen (RC)

    SUNAT-->>PSE: Ticket: 123456789

    PSE-->>Invoice: {ticket: "123456789"}

    Invoice->>DB: INSERT INTO daily_summaries<br/>{<br/>  date: "2025-01-24",<br/>  ticket: "123456789",<br/>  status: 'processing',<br/>  documents_count: 2<br/>}

    Note over Invoice: Esperar 1-2 horas

    Invoice->>PSE: GET /ticket/{ticket}

    PSE->>SUNAT: Consultar ticket

    SUNAT-->>PSE: Estado: "ACEPTADO"<br/>CDR disponible

    PSE-->>Invoice: Summary accepted

    Invoice->>DB: UPDATE daily_summaries<br/>SET status = 'accepted'

    Invoice->>DB: UPDATE invoices<br/>SET status = 'voided'<br/>WHERE id IN (...)
```

---

## Tablas de Base de Datos

```sql
-- Tabla de comprobantes electrónicos
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),

  -- Emisor
  ruc_issuer VARCHAR(11) NOT NULL,
  business_name_issuer VARCHAR(255) NOT NULL,

  -- Tipo de comprobante
  document_type VARCHAR(2) NOT NULL, -- '01': Factura, '03': Boleta, '07': Nota Crédito, '08': Nota Débito
  series VARCHAR(4) NOT NULL,
  number VARCHAR(8) NOT NULL,
  full_number VARCHAR(13) UNIQUE NOT NULL, -- 'F001-00000123'

  -- Cliente
  customer_document_type VARCHAR(1), -- '1': DNI, '6': RUC
  customer_document_number VARCHAR(11),
  customer_name VARCHAR(255),
  customer_address TEXT,

  -- Montos
  subtotal DECIMAL(10,2) NOT NULL,
  igv DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,

  -- Detracción (si aplica)
  detraccion_percentage DECIMAL(5,2),
  detraccion_amount DECIMAL(10,2),

  -- Items
  items JSONB NOT NULL,

  -- Estado SUNAT
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'sent', 'accepted', 'rejected', 'voided'

  cdr_hash VARCHAR(255),
  cdr_notes TEXT,

  -- URLs de archivos
  xml_url TEXT,
  pdf_url TEXT,
  cdr_url TEXT,

  -- Fechas
  issue_date DATE NOT NULL,
  sent_to_sunat_at TIMESTAMP,
  accepted_at TIMESTAMP,
  voided_at TIMESTAMP,

  -- Error info
  error_code VARCHAR(10),
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoices_full_number ON invoices(full_number);
CREATE INDEX idx_invoices_ruc_date ON invoices(ruc_issuer, issue_date DESC);
CREATE INDEX idx_invoices_status ON invoices(status, created_at DESC);

-- Tabla de notas de crédito/débito
CREATE TABLE credit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),

  document_type VARCHAR(2) NOT NULL, -- '07': Nota Crédito, '08': Nota Débito
  series VARCHAR(4) NOT NULL,
  number VARCHAR(8) NOT NULL,
  full_number VARCHAR(13) UNIQUE NOT NULL,

  reason_code VARCHAR(2) NOT NULL,
  -- '01': Anulación, '02': Anulación por error en RUC,
  -- '03': Corrección por error en descripción, etc.
  reason_description TEXT,

  affected_document_type VARCHAR(2),
  affected_document_number VARCHAR(13),

  total DECIMAL(10,2) NOT NULL,

  status VARCHAR(20) DEFAULT 'pending',
  cdr_hash VARCHAR(255),

  xml_url TEXT,
  pdf_url TEXT,

  issue_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_notes_invoice ON credit_notes(invoice_id);

-- Tabla de resúmenes diarios
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ruc_issuer VARCHAR(11) NOT NULL,

  summary_date DATE NOT NULL, -- Fecha de los documentos
  generation_date DATE NOT NULL, -- Fecha de generación del resumen

  ticket VARCHAR(20), -- Ticket de SUNAT
  documents_count INTEGER NOT NULL,

  status VARCHAR(20) DEFAULT 'processing',
  -- 'processing', 'accepted', 'rejected'

  xml_url TEXT,
  cdr_url TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_daily_summaries_ruc_date ON daily_summaries(ruc_issuer, summary_date DESC);

-- Tabla de secuencias de numeración
CREATE TABLE invoice_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),

  document_type VARCHAR(2) NOT NULL,
  series VARCHAR(4) NOT NULL,
  current_number INTEGER DEFAULT 0,

  UNIQUE(store_id, document_type, series)
);
```

---

## Configuración de PSE

```typescript
// Proveedores de Servicios Electrónicos disponibles
const PSE_PROVIDERS = {
  nubefact: {
    apiUrl: 'https://api.nubefact.com/v1',
    apiToken: process.env.NUBEFACT_TOKEN,
    ruc: '20123456789'
  },
  factusol: {
    apiUrl: 'https://api.factusol.pe/v2',
    apiKey: process.env.FACTUSOL_KEY,
    ruc: '20123456789'
  },
  sunat_sol: {
    // Conexión directa a SUNAT (requiere certificado digital)
    soapUrl: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
    username: '20123456789MODDATOS',
    password: process.env.SUNAT_SOL_PASSWORD,
    certificate: './certs/certificate.pfx',
    certificatePassword: process.env.CERT_PASSWORD
  }
};

// Tipos de documentos SUNAT
const DOCUMENT_TYPES = {
  FACTURA: '01',
  BOLETA: '03',
  NOTA_CREDITO: '07',
  NOTA_DEBITO: '08',
  RETENCION: '20',
  PERCEPCION: '40'
};

// Tipos de documento de identidad
const IDENTITY_TYPES = {
  DNI: '1',
  RUC: '6',
  CARNET_EXTRANJERIA: '4',
  PASAPORTE: '7'
};
```

---

## Servicio de Facturación

```typescript
class InvoiceService {
  async generateInvoice(order: Order): Promise<Invoice> {
    // 1. Obtener siguiente número
    const sequence = await this.getNextNumber(
      order.storeId,
      order.needsRuc ? 'F001' : 'B001'
    );

    // 2. Preparar datos
    const invoiceData = {
      documentType: order.needsRuc ? DOCUMENT_TYPES.FACTURA : DOCUMENT_TYPES.BOLETA,
      series: order.needsRuc ? 'F001' : 'B001',
      number: sequence.toString().padStart(8, '0'),
      issueDate: new Date(),
      customer: {
        documentType: order.customer.documentType,
        documentNumber: order.customer.documentNumber,
        name: order.customer.name,
        address: order.customer.address
      },
      items: order.items.map(item => ({
        description: item.product.name,
        quantity: item.quantity,
        unitPrice: this.calculateBasePrice(item.price),
        igv: this.calculateIGV(item.price),
        total: item.subtotal
      })),
      totals: {
        subtotal: this.calculateSubtotal(order.total),
        igv: this.calculateIGV(order.total),
        total: order.total
      }
    };

    // 3. Enviar a PSE
    const response = await this.pse.sendInvoice(invoiceData);

    // 4. Guardar en base de datos
    const invoice = await db.query(`
      INSERT INTO invoices (
        order_id, document_type, series, number, full_number,
        ruc_issuer, customer_document_number, total, igv,
        status, cdr_hash, xml_url, pdf_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      order.id,
      invoiceData.documentType,
      invoiceData.series,
      invoiceData.number,
      `${invoiceData.series}-${invoiceData.number}`,
      order.store.ruc,
      invoiceData.customer.documentNumber,
      invoiceData.totals.total,
      invoiceData.totals.igv,
      response.status,
      response.cdrHash,
      response.xmlUrl,
      response.pdfUrl
    ]);

    return invoice;
  }

  private calculateIGV(total: number): number {
    // IGV en Perú es 18%
    return parseFloat((total * 0.18 / 1.18).toFixed(2));
  }

  private calculateBasePrice(priceWithIGV: number): number {
    return parseFloat((priceWithIGV / 1.18).toFixed(2));
  }

  private calculateSubtotal(total: number): number {
    return total - this.calculateIGV(total);
  }
}
```

---

**Fecha de creación:** 2025-01-24
**Versión:** 1.0
