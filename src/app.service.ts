import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as XLSX from 'xlsx';

interface Item {
  title: string;
  price: string;
  link?: string;
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

  async scrapeData(data: ScrappableItem[], res, target:string): Promise<void> {
    const result = await this.scrapeAll(data, target);
    this.exportExcel(result, res);
  }

  private async scrapeAll(data: ScrappableItem[], target: string): Promise<{ [key: string]: Item[] }> {
    const result: { [key: string]: Item[] } = {};

    for (const item of data) {
      result[item.site] = target === 'phone' ? await this.scrape(item) : await this.scrapNotebooks(item);
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

  async scrapNotebooks(item) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
      const results = [];

      await page.goto(item.url);

      const itemsInfo =  await page.evaluate(({ container, title, price, linkSelector }) => {
        const itemDivs = document.querySelectorAll(container);
        return Array.from(itemDivs).map(div => ({
          title: (div.querySelector(title)?.textContent || '-').trim(),
          price: (div.querySelector(price)?.textContent || '-').trim(),
          link: div.querySelector(linkSelector)?.href || '-'
        }));
      }, item.scrapData);

      for (const scrapedItem of itemsInfo)
      {
        if (scrapedItem.link !== '-') {
          await page.goto(scrapedItem.link);

          const screenSize = await page.evaluate((tagNumber) => {
            const infoItem = document.querySelectorAll('td')[tagNumber || 3];
            return infoItem?.textContent?.trim() || '-';
          }, item?.scrapData?.tagNumber);

          results.push({
            title: scrapedItem.title,
            price: scrapedItem.price,
            screenSize
          });

          await page.goBack();
        }
      }

      return results;
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
