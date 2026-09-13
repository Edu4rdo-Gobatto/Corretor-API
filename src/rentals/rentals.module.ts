import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3Client } from '@aws-sdk/client-s3';
import { AuthModule } from '../auth/auth.module';
import { Property } from '../properties/property.entity';
import { RentalParty } from './rental-party.entity';
import { Lease } from './lease.entity';
import { RentalDocument } from './rental-document.entity';
import { RentalPartiesService } from './rental-parties.service';
import { LeasesService } from './leases.service';
import { RentalDocumentsService, RENTAL_STORAGE } from './rental-documents.service';
import { RentalPartiesController } from './rental-parties.controller';
import { LeasesController } from './leases.controller';
import { RentalDocumentsController } from './rental-documents.controller';
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([RentalParty, Lease, RentalDocument, Property])],
  controllers: [RentalPartiesController, LeasesController, RentalDocumentsController],
  providers: [RentalPartiesService, LeasesService, RentalDocumentsService, {
    provide: RENTAL_STORAGE, inject: [ConfigService], useFactory: (config: ConfigService) => new S3Client({
      region: 'auto', endpoint: config.getOrThrow<string>('R2_ENDPOINT'),
      credentials: { accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'), secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY') },
      requestHandler: { requestTimeout: config.get<number>('R2_REQUEST_TIMEOUT_MS', 30000), connectionTimeout: config.get<number>('R2_CONNECTION_TIMEOUT_MS', 5000) },
    }),
  }],
})
export class RentalsModule {}
