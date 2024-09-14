import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as XLSX from 'xlsx';

interface Item {
  title: string;
  price: string;
}

interface ScrappableItem {
  site: string;
  url: string;
  scrapData: {
    container: string;
    title: string;
    price: string;
  };
}

@Injectable()
export class AppService {

  async scrapeData(data: ScrappableItem[], res): Promise<void> {
    const result = await this.scrapeAll(data);
    this.exportExcel(result, res);
  }

  private async scrapeAll(data: ScrappableItem[]): Promise<{ [key: string]: Item[] }> {
    const result: { [key: string]: Item[] } = {};

    for (const item of data) {
      result[item.site] = await this.scrape(item);
    }

    return result;
  }

  private async scrape(item: ScrappableItem): Promise<Item[]> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
      await page.goto(item.url);

      return await page.evaluate(({ container, title, price }) => {
        const itemDivs = document.querySelectorAll(container);
        return Array.from(itemDivs).map(div => ({
          title: (div.querySelector(title)?.textContent || '-').trim(),
          price: (div.querySelector(price)?.textContent || '-').trim(),
        }));
      }, item.scrapData);
    } catch (error) {
      console.error('Error while scraping:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  private exportExcel(data: { [key: string]: Item[] }, res): void {
    const workbook = XLSX.utils.book_new();

    for (const [sheetName, sheetData] of Object.entries(data)) {
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = [{ wch: 50 }, { wch: 20 }]; // Column widths

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  }
}
