import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AgentProfile } from '../agents/dto/agent-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyQueryDto, ManagedPropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';
import { ParseSlugPipe } from './pipes/parse-slug.pipe';

type AuthenticatedRequest = Request & { user: AgentProfile };

@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(@Query() query: PropertyQueryDto) { return this.properties.listPublic(query); }

  @Get(':slug')
  detail(@Param('slug', ParseSlugPipe) slug: string) { return this.properties.findPublic(slug); }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePropertyDto, @Req() request: AuthenticatedRequest) {
    return this.properties.create(dto, request.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePropertyDto, @Req() request: AuthenticatedRequest) {
    return this.properties.update(id, dto, request.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: AuthenticatedRequest) {
    return this.properties.remove(id, request.user);
  }
}

@Controller('admin/properties')
@UseGuards(JwtAuthGuard)
export class ManagedPropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(@Query() query: ManagedPropertyQueryDto, @Req() request: AuthenticatedRequest) {
    return this.properties.listManaged(query, request.user);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: AuthenticatedRequest) {
    return this.properties.findManaged(id, request.user);
  }
}
