import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule } from '../raffles/infrastructure/persistence';
import { DatabaseHealthIndicator } from './database.health';
import { HealthController } from './health.controller';
import { JobsHealthIndicator } from './jobs.health';

@Module({
  imports: [TerminusModule, PersistenceModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, JobsHealthIndicator],
})
export class HealthModule {}
