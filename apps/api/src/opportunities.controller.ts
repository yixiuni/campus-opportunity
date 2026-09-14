import { Controller, Get } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { Public } from './auth/auth.guard';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  @Public()
  findAll() {
    return this.opportunitiesService.findAll();
  }
}
