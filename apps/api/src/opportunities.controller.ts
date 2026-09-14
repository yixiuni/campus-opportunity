import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { AuthenticatedRequest, Public } from './auth/auth.guard';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  @Public()
  findAll() {
    return this.opportunitiesService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) { return this.opportunitiesService.findOne(id); }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.opportunitiesService.create(request.user.id, body);
  }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.opportunitiesService.update(request.user.id, id, body);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.opportunitiesService.transition(request.user.id, id, 'publish');
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.opportunitiesService.transition(request.user.id, id, 'close');
  }
}
