import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok' as const,
      service: 'campus-opportunity-api',
      timestamp: new Date().toISOString(),
    };
  }
}

