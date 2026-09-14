import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { AuthModule } from './auth/auth.module';
import { MeController } from './users/me.controller';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController, OpportunitiesController, MeController, ApplicationsController, MatchingController],
  providers: [OpportunitiesService, ApplicationsService, MatchingService],
})
export class AppModule {}
