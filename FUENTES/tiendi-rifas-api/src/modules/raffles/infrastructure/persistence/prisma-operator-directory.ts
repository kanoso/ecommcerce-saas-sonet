import { Injectable } from '@nestjs/common';
import { OperatorDirectory } from '../../application/ports';
import { PrismaService } from './prisma.service';

/** Operator display names from the User table: only id and name are read. */
@Injectable()
export class PrismaOperatorDirectory implements OperatorDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async displayNamesOf(operatorIds: string[]): Promise<Map<string, string | null>> {
    if (operatorIds.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: operatorIds } },
      select: { id: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.name]));
  }
}
