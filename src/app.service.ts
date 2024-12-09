import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as XLSX from 'xlsx';
import items from "./modules/temu-scrap/data.json";

interface Item {
  title: string;
  price: string | number;
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
      result[item.site] = target === 'phone' ? await this.scrape(item) : await this.scrapNotebooks(item, item.site);
    }

    return result;
  }

  transformStringToNumber(str: string): number {
    let cleanedString = str.replace(/[ .a-zA-Z]/g, '');

    let number = parseInt(cleanedString, 10);

    return isNaN(number) ? null : number;
  }


  private async scrape(item: ScrappableItem): Promise<Item[]> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
      await page.goto(item.url);

      const result = await page.evaluate(({ container, title, price }) => {
        const itemDivs = document.querySelectorAll(container);
        return Array.from(itemDivs).map(div => ({
          title: (div.querySelector(title)?.textContent || '-').trim(),
          price: (div.querySelector(price)?.textContent || '-').trim(),
        }));
      }, item.scrapData);

      return result?.map((item) => ({...item, price: this.transformStringToNumber(item.price)}))
    } catch (error) {
      console.error('Error while scraping:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async scrapNotebooks(item, site) {
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

      if(site === 'Darwin'){
        itemsInfo.splice(-2);
      } else if (site === 'Enter') {
        itemsInfo.splice(1, 1);
      }

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

      return results?.map((item) => ({...item, price: this.transformStringToNumber(item.price)}));
    } catch (error) {
      console.error('Error while scraping:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  findMinPrice(data) {
    let minPrice = Infinity;
    let storeName = '';

    for (let store in data) {
      data[store].forEach(item => {
        const price = parseInt(item.price.toString().replace(/\D/g, ''));
        if (price < minPrice) {
          minPrice = price;
          storeName = store;
        }
      });
    }

    return {
      'Magazin': storeName,
      'Pret minim': minPrice
    };
  }


  private exportExcel(data: { [key: string]: Item[] }, res): void {
    const workbook = XLSX.utils.book_new();

    for (const [sheetName, sheetData] of Object.entries(data)) {
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = [{ wch: 50 }, { wch: 20 }];

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // const min = this.findMinPrice(data);
    // const worksheet = XLSX.utils.json_to_sheet([min]);
    // XLSX.utils.book_append_sheet(workbook, worksheet, 'Min price');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  }

  exportExcelTemu(data, res){
    // Filtrează câmpurile necesare (title și price)
    const filteredData = data.map(item => ({ title: item.title, price: item.price }));

    // Creează foaia de lucru
    const worksheet = XLSX.utils.json_to_sheet(filteredData);

    // Setează lățimea coloanelor
    worksheet['!cols'] = [
      { wch: 60 }, // Lățimea coloanei 'title' (50 caractere)
      { wch: 10 }, // Lățimea coloanei 'price' (10 caractere)
    ];

    // Creează un workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    // Scrie workbook-ul în buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Setează antetele pentru răspuns
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="data.xlsx"');

    // Trimite fișierul Excel
    res.send(buffer);
  }


  async scrapeTemu(res) {
    const uniqueItems = items.filter((item, index, self) =>
      index === self.findIndex(t => t.title === item.title && t.price === item.price)
    );

    setTimeout(() => this.exportExcelTemu(uniqueItems, res), 15000)
  }
}
