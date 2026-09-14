import { Body, Controller, Get, Header, HttpCode, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, Public } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Get('dev/accounts')
  accounts() { return this.auth.accounts(); }

  @Public()
  @Post('dev/login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  login(@Body() body: unknown) { return this.auth.login(body); }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest) { await this.auth.logout(request.sessionId); }
}
