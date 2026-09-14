import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

@Module({
  controllers: [HealthController, OpportunitiesController],
  providers: [OpportunitiesService],
})
export class AppModule {}

