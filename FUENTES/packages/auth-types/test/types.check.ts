/**
 * Chequeos de tipos en tiempo de compilación (item 8 de la Fase 1).
 * Se corren con `npm run test:types` (tsc --noEmit). Si alguien hace que
 * `StoreRole` sea asignable a `Role`, los `@ts-expect-error` quedan "sin
 * usar" y la compilación falla.
 */
import type { Role, StoreRole, User } from '../src';

// StoreRole NO es asignable a Role.
// @ts-expect-error — 'MANAGER' es StoreRole, no Role
const badManager: Role = 'MANAGER' as StoreRole;

// @ts-expect-error — 'CASHIER' es StoreRole, no Role
const badCashier: Role = 'CASHIER';

// Los 5 roles del backend son Role válido.
const superAdmin: Role = 'SUPER_ADMIN';
const storeOwner: Role = 'STORE_OWNER';
const employee: Role = 'EMPLOYEE';
const customer: Role = 'CUSTOMER';
const rider: Role = 'RIDER';

// storeRole es StoreRole | null, no string.
declare const user: User;
const storeRole: StoreRole | null = user.storeRole;

void badManager;
void badCashier;
void superAdmin;
void storeOwner;
void employee;
void customer;
void rider;
void storeRole;
