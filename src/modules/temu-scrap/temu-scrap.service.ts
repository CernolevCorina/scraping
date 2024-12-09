import { Injectable } from '@nestjs/common';
import items from './data.json';
import puppeteer from "puppeteer";
@Injectable()
export class TemuScrapService {
	async scrapeData() {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();

		await page.goto('https://aliexpress.ru/?gatewayAdapt=glo2rus', {
			waitUntil: 'networkidle2', // Ensures the page is fully loaded
		});

		await page.waitForSelector('.product-snippet_ProductSnippet__container__1llogj', { timeout: 10000 }).catch(() => {
			console.log("Selector not found within 10 seconds");
		});

		const result = await Promise.race([
			page.evaluate(() => {
				const items = document.querySelectorAll('.product-snippet_ProductSnippet__container__1llogj');
				return Array.from(items).map(item => item.textContent);
			}),
			new Promise((_, reject) => setTimeout(() => reject(new Error('Evaluation timed out')), 10000))
		]).catch(err => {
			console.error(err.message);
			return []; // Default to an empty array if evaluation times out
		});

		await browser.close();
		return result;
	}

	scrapeData() {
		const uniqueItems = items.filter((item, index, self) =>
			index === self.findIndex(t => t.title === item.title && t.price === item.price)
		);
		//
		// console.log(uniqueItems?.length, items?.length)
		return 'hello'

		// return uniqueItems;

	}
}
