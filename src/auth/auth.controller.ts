import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AgentProfile } from '../agents/dto/agent-profile.dto';
import { AgentsService } from '../agents/agents.service';
import { ChangePasswordDto } from '../agents/dto/change-password.dto';
import { UpdateProfileDto } from '../agents/dto/update-profile.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { BrowserOriginGuard } from './browser-origin.guard';
import { LoginRateGuard } from './login-rate.guard';
import { SESSION_MAX_AGE } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly agents: AgentsService, private readonly configuration: ConfigService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(BrowserOriginGuard, LoginRateGuard)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.setSession(await this.auth.login(dto), response);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(BrowserOriginGuard)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.setSession(await this.auth.refresh(this.readCookie(request)), response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BrowserOriginGuard)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(this.readCookie(request));
    response.clearCookie('corretor_refresh', this.cookieOptions());
  }

  private readCookie(request: Request): string {
    return request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('corretor_refresh='))?.slice(17) ?? '';
  }

  private cookieOptions() {
    return { httpOnly: true, secure: this.configuration.get('NODE_ENV') === 'production', sameSite: 'strict' as const, path: '/' };
  }

  private setSession(session: Awaited<ReturnType<AuthService['login']>>, response: Response) {
    const { refreshToken, ...publicSession } = session;
    response.cookie('corretor_refresh', refreshToken, { ...this.cookieOptions(), maxAge: SESSION_MAX_AGE });
    return publicSession;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  me(@Req() request: Request & { user: AgentProfile }): AgentProfile {
    return request.user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  updateProfile(@Req() request: Request & { user: AgentProfile }, @Body() dto: UpdateProfileDto): Promise<AgentProfile> {
    return this.agents.updateProfile(request.user.id, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  changePassword(@Req() request: Request & { user: AgentProfile }, @Body() dto: ChangePasswordDto): Promise<AgentProfile> {
    return this.agents.changePassword(request.user.id, dto);
  }
}
