import got from 'got';
import { CookieJar } from 'tough-cookie';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';
import { writeFile } from 'fs/promises';

class WNCPlanningRegisterScraper {
  constructor() {
    this.baseUrl = 'https://wnc.planning-register.co.uk';
    this.cookieJar = new CookieJar();

    this.client = got.extend({
      agent: {
        http: new HttpCookieAgent({ cookies: { jar: this.cookieJar } }),
        https: new HttpsCookieAgent({ cookies: { jar: this.cookieJar } }),
      },
      followRedirect: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  }

  async acceptDisclaimer(returnUrl) {

    const acceptUrl = `${this.baseUrl}/Disclaimer/Accept?returnUrl=${encodeURIComponent(returnUrl)}`;
    const response = await this.client.post(acceptUrl);

    return response;
  }

  async scrapeApplication(applicationRef) {
    const returnUrl = `/BuildingControl/Display/${applicationRef}`;

    await this.acceptDisclaimer(returnUrl);

    const pageUrl = `${this.baseUrl}${returnUrl}`;

    const response = await this.client.get(pageUrl);

    return response.body;
  }

  parseData(html) {
    const data = {};

    const tableRegex = /<table[^>]*class="[^"]*summaryTbl[^"]*table[^"]*fixed[^"]*"[^>]*>([\s\S]*?)<\/table>/i;
    const tableMatch = html.match(tableRegex);

    if (!tableMatch) {
      console.log('Table not found');
      return data;
    }

    const tableContent = tableMatch[1];

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [...tableContent.matchAll(trRegex)];

    for (const row of rows) {
      const rowContent = row[1];

      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [...rowContent.matchAll(tdRegex)];

      for (const cell of cells) {
        const cellContent = cell[1];

        // Split by <br /> to separate label from value
        const parts = cellContent.split(/<br\s*\/?>/i);

        if (parts.length >= 2) {
          // First part is the label
          const label = parts[0].replace(/<[^>]*>/g, '').trim();

          // Extract value from the div/span
          const valueMatch = cellContent.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
          const value = valueMatch ? valueMatch[1].trim() : '';

          if (label) {
            data[label] = value;
          }
        }
      }
    }

    return data;
  }

  async saveToJSON(data, filename = 'output.json') {
    await writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filename}`);
    return filename;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new WNCPlanningRegisterScraper();
  const applicationRef = 'FP/2025/0159';

  try {
    const html = await scraper.scrapeApplication(applicationRef);

    const data = scraper.parseData(html);
    await scraper.saveToJSON(data, 'output.json');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.statusCode);
    }
    process.exit(1);
  }
}

export default WNCPlanningRegisterScraper;
