import { OperatorDirectory } from '../ports/operator-directory';

export class InMemoryOperatorDirectory implements OperatorDirectory {
  private readonly names = new Map<string, string | null>();

  set(operatorId: string, name: string | null): void {
    this.names.set(operatorId, name);
  }

  async displayNamesOf(operatorIds: string[]): Promise<Map<string, string | null>> {
    const found = new Map<string, string | null>();
    for (const id of operatorIds) {
      if (this.names.has(id)) {
        found.set(id, this.names.get(id) ?? null);
      }
    }
    return found;
  }
}
