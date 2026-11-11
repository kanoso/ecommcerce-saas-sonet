import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { parseWith, uuidParam } from '../../../../common/http/zod';
import { GetVerificationDataUseCase } from '../../application';
import { RaffleQueries } from '../../application/queries/raffle-queries';
import * as present from './presenters';

const gridQuery = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  // 42 numbers per page, as in the prototype.
  tamano: z.coerce.number().int().min(1).max(200).default(42),
});

/** Routes anyone may call: no buyer data, no seed before the close. */
@Controller('rifas')
export class PublicController {
  constructor(
    private readonly queries: RaffleQueries,
    private readonly verification: GetVerificationDataUseCase,
  ) {}

  @Get()
  async list() {
    return (await this.queries.activeRaffles()).map(present.raffleSummary);
  }

  @Get('finalizadas')
  async listFinished() {
    return (await this.queries.finishedRaffles()).map(present.raffleSummary);
  }

  /** Cacheable for 3 seconds: the grid changes, but not per request. */
  @Get(':id')
  @Header('Cache-Control', 'public, max-age=3')
  async detail(@Param('id') id: string, @Query() query: unknown) {
    const { pagina, tamano } = parseWith(gridQuery, query);
    return present.raffleDetail(
      await this.queries.raffleDetail(parseWith(uuidParam, id), {
        page: pagina,
        pageSize: tamano,
      }),
    );
  }

  @Get(':id/verificacion')
  async verify(@Param('id') id: string) {
    return present.verification(await this.verification.execute(parseWith(uuidParam, id)));
  }

  @Get(':id/en-vivo')
  @Header('Cache-Control', 'public, max-age=3')
  async live(@Param('id') id: string) {
    return present.liveData(await this.queries.liveData(parseWith(uuidParam, id)));
  }
}
