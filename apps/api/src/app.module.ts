import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { AuthModule } from './auth/auth.module';
import { MeController } from './users/me.controller';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController, OpportunitiesController, MeController, ApplicationsController],
  providers: [OpportunitiesService, ApplicationsService],
})
export class AppModule {}
