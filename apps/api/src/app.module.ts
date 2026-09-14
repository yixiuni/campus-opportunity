import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { AuthModule } from './auth/auth.module';
import { MeController } from './users/me.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController, OpportunitiesController, MeController],
  providers: [OpportunitiesService],
})
export class AppModule {}
