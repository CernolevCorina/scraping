import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import data from './data.json';
import notebooksData from './notebooksData.json';
import {ApiTags} from "@nestjs/swagger";

@ApiTags('Scraping')
@Controller('scrape')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('S24Ultra')
  async scrapeData(@Res() res: Response): Promise<void> {
    await this.appService.scrapeData(data, res, 'phone');
  }

  @Get('HuaweiNotebook')
  async scrapeSamsungNotebook(@Res() res: Response): Promise<void> {
    await this.appService.scrapeData(notebooksData, res, 'notebook');
  }
}
