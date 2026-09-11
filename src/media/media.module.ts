import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3Client } from '@aws-sdk/client-s3';
import { AuthModule } from '../auth/auth.module';
import { Property } from '../properties/property.entity';
import { MediaController } from './media.controller';
import { MediaService, R2_S3_CLIENT } from './media.service';
import { PropertyMedia } from './property-media.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Property, PropertyMedia])],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: R2_S3_CLIENT,
      inject: [ConfigService],
      useFactory: (configuration: ConfigService) => new S3Client({
        region: 'auto', endpoint: configuration.getOrThrow<string>('R2_ENDPOINT'),
        credentials: {
          accessKeyId: configuration.getOrThrow<string>('R2_ACCESS_KEY_ID'),
          secretAccessKey: configuration.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
        },
        requestHandler: {
          requestTimeout: configuration.getOrThrow<number>('R2_REQUEST_TIMEOUT_MS'),
          connectionTimeout: configuration.getOrThrow<number>('R2_CONNECTION_TIMEOUT_MS'),
        },
      }),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
