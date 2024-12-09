import {Controller, Get, Res} from '@nestjs/common';
import {Response} from "express";
import {TemuScrapService} from "./temu-scrap.service";
import {ApiTags} from "@nestjs/swagger";

@ApiTags('Scraping')
@Controller('temu-scrap')
export class TemuScrapController {
	constructor(private readonly temuScrapService: TemuScrapService ){}

	@Get('TemuData')
	async scrapeData(@Res() res: Response) {
		return this.temuScrapService.scrapeData();
	}
}
