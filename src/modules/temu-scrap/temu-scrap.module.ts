import { Module } from '@nestjs/common';
import { TemuScrapController } from './temu-scrap.controller';
import { TemuScrapService } from './temu-scrap.service';

@Module({
  controllers: [TemuScrapController],
  providers: [TemuScrapService]
})
export class TemuScrapModule {}
