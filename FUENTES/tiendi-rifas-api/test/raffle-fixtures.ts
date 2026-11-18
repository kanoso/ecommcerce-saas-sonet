import { Prisma, PrismaClient } from '@prisma/client';

type RaffleClient = Pick<PrismaClient, 'raffle'>;

/**
 * Inserts a raffle row the way the application ends up writing it: created as
 * a DRAFT together with its prize 1 (RafflePrize rows are writable only while
 * the raffle is a DRAFT, trg_raffle_prize_draft_only), then moved to the
 * requested status. A raffle row without its prizes cannot be drawn: the
 * draw refuses to record a winner for a prize that is not persisted.
 */
export async function createRaffleRow(
  prisma: RaffleClient,
  { data }: { data: Prisma.RaffleUncheckedCreateInput },
) {
  const { status = 'DRAFT', ...draft } = data;
  const created = await prisma.raffle.create({
    data: {
      ...draft,
      status: 'DRAFT',
      prizes: {
        create: [
          {
            position: 1,
            title: data.prize,
            description: data.prizeDescription ?? null,
          },
        ],
      },
    },
  });
  if (status === 'DRAFT') {
    return created;
  }
  return prisma.raffle.update({ where: { id: created.id }, data: { status } });
}
