import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AuthenticatedRequest } from './auth/auth.guard';
import { ApplicationsService } from './applications.service';

@Controller()
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post('opportunities/:id/applications')
  create(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.create(req.user.id, id, body); }

  @Get('me/applications')
  @Header('Cache-Control', 'no-store')
  list(@Req() req: AuthenticatedRequest, @Query('direction') direction = 'sent') { return this.service.list(req.user.id, direction); }

  @Get('applications/:id')
  @Header('Cache-Control', 'no-store')
  detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.detail(req.user.id, id); }

  @Patch('applications/:id')
  edit(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.edit(req.user.id, id, body); }

  @Post('applications/:id/review')
  @HttpCode(200)
  review(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.review(req.user.id, id, body); }

  @Post('applications/:id/withdraw')
  @HttpCode(200)
  withdraw(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.withdraw(req.user.id, id); }

  @Get('applications/:id/contact')
  @Header('Cache-Control', 'no-store')
  contact(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.contact(req.user.id, id); }
}
