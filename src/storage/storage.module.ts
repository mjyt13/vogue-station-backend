import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageController } from './storage.controller';
import { STORAGE_PROVIDER } from './storage-provider.interface';

/**
 * Factory Method: STORAGE_DRIVER (.env) picks the concrete StorageProvider.
 * Everything else injects STORAGE_PROVIDER and never knows the backend.
 */
@Global()
@Module({
  controllers: [StorageController],
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider],
      useFactory: (config: ConfigService, local: LocalStorageProvider) =>
        config.get<string>('STORAGE_DRIVER') === 's3'
          ? new S3StorageProvider(config)
          : local,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
