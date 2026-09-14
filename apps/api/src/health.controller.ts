import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.guard';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  getHealth() {
    return {
      status: 'ok' as const,
      service: 'campus-opportunity-api',
      timestamp: new Date().toISOString(),
    };
  }
}
