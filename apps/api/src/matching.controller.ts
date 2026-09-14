import { Body, Controller, Get, Header, Post, Req } from '@nestjs/common';
import { AuthenticatedRequest } from './auth/auth.guard';
import { MatchingService } from './matching.service';
import { ApplicationsService } from './applications.service';

@Controller('matching')
export class MatchingController {
  constructor(private readonly matching: MatchingService, private readonly applications: ApplicationsService) {}
  @Get('status')
  @Header('Cache-Control', 'no-store')
  status(@Req() req: AuthenticatedRequest) { return this.matching.status(req.user.id); }
  @Post('rounds')
  @Header('Cache-Control', 'no-store')
  round(@Req() req: AuthenticatedRequest, @Body() body: unknown) { return this.matching.create(req.user.id, body); }
  @Post('requests')
  request(@Req() req: AuthenticatedRequest, @Body() body: unknown) { return this.applications.createMatch(req.user.id, body); }
}
