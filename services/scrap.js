const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'links.json');

function readLinks(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject('Error reading links.json: ' + err);
        return;
      }
      try {
        const links = JSON.parse(data).links;
        resolve(links);
      } catch (parseError) {
        reject('Error parsing JSON: ' + parseError);
      }
    });
  });
}

async function scrapeWithXPathElle(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2' , timeout: 60000 });

    const results = await page.evaluate(() => {
      const results = [];
      const containerDivs = document.querySelectorAll('#bview > div > div > article > div');
      containerDivs.forEach((div) => {
        const paragraphs = div.querySelectorAll('p');
        paragraphs.forEach((p) => {
          const text = p.innerText.trim();
          if (text.length >= 10) {
            results.push({ text });
          }
        });
      });
      return results;
    });

    return results;
  } catch (error) {
    console.error(`Error in scraping ${url}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function scrapeWithXPathTwitburc(url) {
  // Twitburc scraping kuralları
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    const results = await page.evaluate(async () => {
      // XPath kullanarak elemanları seçiyoruz
      const xpath = '//*[@id="nav-tabContent"]/div[3]/p/big';
      const elements = await document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      const results = [];
      for (let i = 0; i < elements.snapshotLength; i++) {
        const element = elements.snapshotItem(i);
        const text = element.innerText.trim();

        // Boş veya çok kısa metinleri atlayarak sadece yeterli uzunluktaki metinleri ekliyoruz
        if (text.length > 10) {
          results.push({ text });
        }
      }

      return results;
    });

    return results;
  } catch (error) {
    console.error(`Error in scraping ${url}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeWithXPathElle, scrapeWithXPathTwitburc, readLinks };
