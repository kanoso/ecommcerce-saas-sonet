# Diseño Técnico — Calendario de Cuotas y Crédito en Kipu

**Alcance:** Fase 5 — Implementación guiada por especificaciones  
**Estado:** Propuesta de diseño técnico lista para revisión  
**Decisiones base:** C1 a C7 (100% aprobadas al 2026-09-30)

---

## 1. Arquitectura y límites de contexto

```text
┌────────────────────────────────────────────────────────────────────────┐
│ tiendi-kipu (Autoridad del plan de cuotas y saldos)                    │
│                                                                        │
│  [LoanPlan] 1 ──── N [LoanInstallment] 1 ──── N [InstallmentAllocation]│
│       │                      │                               │         │
│  (en Expense: prestamo)      │                               │         │
│                              │ (Emisiones)                   │         │
│                              ▼                               ▼         │
│                   [LoanInstallmentEmission]           (desde Expense:  │
│                              │                         cobro / Crédito)│
└──────────────────────────────┼─────────────────────────────────────────┘
                               │ HTTP / JWT Service Token
                               ▼ (Idempotency Key + Versión)
┌────────────────────────────────────────────────────────────────────────┐
│ tiendi-api (Módulo central de notificaciones)                          │
│                                                                        │
│  POST /notifications/api/requests                                      │
│  DELETE /notifications/api/requests/:key?sourceApp=tiendi-kipu         │
└────────────────────────────────────────────────────────────────────────┘
```

### Invariantes clave
1. **Primacía contable:** Los movimientos de dinero reales son exclusivamente `Expense` (`prestamo` y `cobro`). El plan de cuotas describe obligaciones; las imputaciones vinculan el dinero recibido con la obligación sin inventar flujos paralelos en caja.
2. **Resiliencia offline:** SQLite local en Kipu es la autoridad en el dispositivo. Las operaciones offline se muestran explícitamente como pendientes de sincronización (C7).
3. **Versionado monotónico:** Modificar el plan o cuotas incrementa versiones enteras (CAS), cancelando avisos pendientes y reemplazándolos con claves idempotentes nuevas (C5).

---

## 2. Modelo de datos Prisma (`FUENTES/tiendi-kipu/api/prisma/schema.prisma`)

```prisma
// Plan de cuotas asociado al préstamo raíz (C1, C2a-C2d, C5)
model LoanPlan {
  id                 String            @id @default(uuid())
  expenseId          String            @unique // Vinculado a Expense raíz (tipo = "prestamo")
  expense            Expense           @relation("PrestamoPlan", fields: [expenseId], references: [id], onDelete: Cascade)
  userId             String
  user               User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  anchorDay          Int               // Día ancla 1-31 para recorte de fin de mes (C2b)
  installmentsCount  Int               // Cantidad N de cuotas
  totalAmount        Decimal           // Igual al saldo pendiente al confirmar (C2d)
  active             Boolean           @default(true)
  version            Int               @default(1) // Monotónico para CAS en modificaciones (C5)
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  installments       LoanInstallment[]

  @@index([userId, active])
}

// Cuota individual del plan (C2a-C2c, C4a-C4c, C5)
model LoanInstallment {
  id           String                     @id @default(uuid())
  planId       String
  plan         LoanPlan                   @relation(fields: [planId], references: [id], onDelete: Cascade)
  number       Int                        // Ordinal 1..N ("4 de 12")
  monto        Decimal                    // Monto planificado en centavos
  dueDate      DateTime                   // Fecha civil (interpretada a medianoche UTC)
  status       String                     @default("PENDING") // PENDING | PARTIAL | PAID
  version      Int                        @default(1)
  createdAt    DateTime                   @default(now())
  updatedAt    DateTime                   @updatedAt

  allocations  LoanInstallmentAllocation[]
  emissions    LoanInstallmentEmission[]

  @@unique([planId, number])
  @@index([planId, status])
  @@index([dueDate])
}

// Imputación explícita de cobro real o saldo a favor a una cuota (C3, C4e)
model LoanInstallmentAllocation {
  id                  String             @id @default(uuid())
  installmentId       String
  installment         LoanInstallment    @relation(fields: [installmentId], references: [id], onDelete: Cascade)
  cobroExpenseId      String?            // Expense de cobro real (null si es crédito)
  cobroExpense        Expense?           @relation("CobroAllocations", fields: [cobroExpenseId], references: [id], onDelete: SetNull)
  creditApplicationId String?            // Aplicación de saldo a favor (null si es cobro real)
  creditApplication   CreditApplication? @relation(fields: [creditApplicationId], references: [id], onDelete: SetNull)
  monto               Decimal            // Monto explícitamente imputado a esta cuota (C4e)
  createdAt           DateTime           @default(now())

  @@index([installmentId])
  @@index([cobroExpenseId])
  @@index([creditApplicationId])
}

// Saldo a favor originado por sobrecobro (C4d2a-C4d2c)
model LoanCredit {
  id              String              @id @default(uuid())
  userId          String
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  sourceExpenseId String              @unique // El cobro real que superó el saldo del préstamo
  sourceExpense   Expense             @relation("CobroCreditSource", fields: [sourceExpenseId], references: [id], onDelete: Cascade)
  deudor          String              // Nombre normalizado del deudor (C4d2b1)
  montoTotal      Decimal             // Monto total del excedente
  saldoDisponible Decimal             // Saldo a favor remanente sin usar
  active          Boolean             @default(true)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  applications    CreditApplication[]

  @@index([userId, deudor, active])
}

// Aplicación no monetaria de crédito a otro préstamo del mismo deudor (C4d2b2b2a, C4d2b2b2b2b)
model CreditApplication {
  id                   String                      @id @default(uuid())
  creditId             String
  credit               LoanCredit                  @relation(fields: [creditId], references: [id], onDelete: Cascade)
  destinationExpenseId String                      // Préstamo destino del mismo deudor
  destinationExpense   Expense                     @relation("CreditoAplicadoDestino", fields: [destinationExpenseId], references: [id], onDelete: Cascade)
  monto                Decimal                     // Monto aplicado (parcial o total)
  revertedAt           DateTime?                   // Fecha si fue revertido por corrección (C4d2c, C4d2b2b2b2b)
  revertReason         String?
  createdAt            DateTime                    @default(now())

  allocations          LoanInstallmentAllocation[]

  @@index([creditId])
  @@index([destinationExpenseId])
}

// Outbox de emisiones programadas hacia notificaciones centrales (C6a, C6b, C5)
model LoanInstallmentEmission {
  id             String          @id @default(uuid())
  installmentId  String
  installment    LoanInstallment @relation(fields: [installmentId], references: [id], onDelete: Cascade)
  version        Int             // Versión monotónica de la cuota
  kind           String          // "due-soon" (-3d) | "due-date" (0d) | "overdue" (+3d)
  scheduledAt    DateTime        // Instante UTC para las 09:00 hora local IANA del usuario
  idempotencyKey String          @unique
  publishedAt    DateTime?
  cancelledAt    DateTime?
  createdAt      DateTime        @default(now())

  @@unique([installmentId, version, kind])
  @@index([publishedAt, cancelledAt])
}
```

---

## 3. Reglas de cálculo y negocio

### 3.1 Generación de borrador (C2a–C2d)
Dado el saldo del préstamo $B$ en centavos y $N$ cuotas:
- Importe base: $A_{\text{base}} = \lfloor B / N \rfloor$
- Residuo: $R = B - (A_{\text{base}} \times N)$
- Cuotas 1 a $N-1$: $M_i = A_{\text{base}}$
- Cuota $N$: $M_N = A_{\text{base}} + R$
- Validación al confirmar: $\sum_{i=1}^N M_i = B$ exactamente.

Recorte de fin de mes (C2b):
- Con día ancla $d$: en el mes $m$ con $L_m$ días, el vencimiento cae en $\min(d, L_m)$. El día ancla original nunca se pierde (ej. 31 ene $\to$ 28 feb $\to$ 31 mar).

### 3.2 Imputación y estados de cuota (C3, C4a–C4c, C4e)
- Monto imputado: $S_k = \sum a_j$
- Saldo cuota: $\text{saldo}_k = M_k - S_k$
- Estado:
  - `PAID` si $S_k \ge M_k$ (cancela avisos futuros).
  - `PARTIAL` si $0 < S_k < M_k$ (mantiene avisos).
  - `PENDING` si $S_k = 0$.

### 3.3 Calendario de avisos (C6a, C6b)
A las 09:00 en la zona IANA del usuario:
1. `due-soon`: 3 días antes del vencimiento.
2. `due-date`: el día del vencimiento.
3. `overdue`: 3 días después del vencimiento (máximo 1 aviso).

Formato de clave idempotente:
`loan-installment:<installmentId>:v:<version>:<kind>`

---

## 4. Pruebas TDD requeridas

1. `loan-plan-draft.spec.ts`: División exacta en centavos, residuo en la última cuota, anclaje 31/01 a 28/02 y 31/03.
2. `loan-plan-lifecycle.spec.ts`: Versionado CAS, inmutabilidad de cuotas pagadas/parciales, edición solo de cuotas futuras.
3. `loan-allocation.spec.ts`: Imputación parcial, cancelación en pago total, asignación multicuota sin prorrateos automáticos.
4. `loan-credit.spec.ts`: Detección de excedente como crédito, restricción al mismo deudor, reversión manual asistida al corregir cobro origen.
5. `loan-emissions.spec.ts`: Claves idempotentes monotónicas, disparos a las 09:00 local, outbox y cancelación remota.
