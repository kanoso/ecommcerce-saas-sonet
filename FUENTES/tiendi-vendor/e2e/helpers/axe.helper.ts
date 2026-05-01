import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export interface A11yViolation {
  id: string;
  impact: string | null;
  description: string;
  nodes: unknown[];
}

/**
 * Ejecuta una auditoría de accesibilidad WCAG 2.0 A/AA sobre la página actual.
 * Retorna el array de violaciones (puede estar vacío si no hay problemas).
 *
 * @param page   - instancia de Playwright Page
 * @param context - descripción opcional para logs (ej: "Dashboard")
 */
export async function checkA11y(page: Page, context?: string): Promise<A11yViolation[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  if (context && results.violations.length > 0) {
    console.warn(`[a11y] ${context}: ${results.violations.length} violaciones encontradas`);
    results.violations.forEach(v => {
      console.warn(`  - [${v.impact}] ${v.id}: ${v.description}`);
    });
  }

  return results.violations as A11yViolation[];
}

/**
 * Filtra solo violaciones de impacto critical o serious.
 * Úsalo en expects para no fallar por warnings menores (moderate/minor).
 */
export function filterSevere(violations: A11yViolation[]): A11yViolation[] {
  return violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
}
