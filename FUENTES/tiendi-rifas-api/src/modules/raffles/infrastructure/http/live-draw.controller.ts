import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseWith, uuidParam } from '../../../../common/http/zod';
import type { Principal } from '../../../auth/auth.service';
import { AdminGuard, CurrentUser, operatorIdOf, SessionGuard } from '../../../auth/guards';
import {
  AdvanceLiveDrawUseCase,
  FinishLiveDrawUseCase,
  StartLiveDrawUseCase,
} from '../../application';
import { LiveDrawSession } from '../../domain';
import * as present from './presenters';

const advanceBody = z.object({ paso_esperado: z.number().int().min(0) }).strict();

function sessionResponse(session: LiveDrawSession) {
  return {
    rifa_id: session.raffleId,
    sorteo_id: session.drawId,
    ...present.liveDrawSessionOf(session),
  };
}

/**
 * The server-paced live draw of a MANUAL raffle (DT-23). Iniciar records the
 * official draw first; avanzar and finalizar only decide when the public
 * sees each step of that recorded result.
 */
@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class LiveDrawController {
  constructor(
    private readonly startUseCase: StartLiveDrawUseCase,
    private readonly advanceUseCase: AdvanceLiveDrawUseCase,
    private readonly finishUseCase: FinishLiveDrawUseCase,
  ) {}

  /** Idempotent: a second call returns the session that exists. */
  @Post('rifas/:id/en-vivo/iniciar')
  @HttpCode(200)
  async start(@CurrentUser() user: Principal, @Param('id') id: string) {
    return sessionResponse(
      await this.startUseCase.execute({
        raffleId: parseWith(uuidParam, id),
        operatorId: operatorIdOf(user),
      }),
    );
  }

  /** 409 LIVE_DRAW_STEP_CONFLICT when paso_esperado is stale (a double click). */
  @Post('rifas/:id/en-vivo/avanzar')
  @HttpCode(200)
  async advance(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const raffleId = parseWith(uuidParam, id);
    const { paso_esperado } = parseWith(advanceBody, body);
    return sessionResponse(
      await this.advanceUseCase.execute({
        raffleId,
        operatorId: operatorIdOf(user),
        expectedStep: paso_esperado,
      }),
    );
  }

  /** Reveals every step at once. Idempotent. */
  @Post('rifas/:id/en-vivo/finalizar')
  @HttpCode(200)
  async finish(@CurrentUser() user: Principal, @Param('id') id: string) {
    return sessionResponse(
      await this.finishUseCase.execute({
        raffleId: parseWith(uuidParam, id),
        operatorId: operatorIdOf(user),
      }),
    );
  }
}
