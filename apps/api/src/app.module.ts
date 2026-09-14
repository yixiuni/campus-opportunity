import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, OpportunitiesController],
  providers: [OpportunitiesService],
})
export class AppModule {}
