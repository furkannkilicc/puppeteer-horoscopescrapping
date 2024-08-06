const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const { scrapeWithXPathElle, scrapeWithXPathTwitburc, readLinks } = require('./services/scrap');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3005;

app.use(express.json());
app.use(cookieParser());

const zodiacSigns = [
  { id: 1, name: 'koc' },
  { id: 2, name: 'boga' },
  { id: 3, name: 'ikizler' },
  { id: 4, name: 'yengec' },
  { id: 5, name: 'aslan' },
  { id: 6, name: 'basak' },
  { id: 7, name: 'terazi' },
  { id: 8, name: 'akrep' },
  { id: 9, name: 'yay' },
  { id: 10, name: 'oglak' },
  { id: 11, name: 'kova' },
  { id: 12, name: 'balik' }
];

const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

const filePath = path.join(__dirname, 'links.json');

let connection;

(async function initializeDB() {
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWD,
      port: process.env.DB_PORT
    });
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Error connecting to database:', error);
    process.exit(1); // Uygulamanın çalışmasını durdur
  }
})();

app.get('/', async (req, res) => {
  try {
    const links = await readLinks(filePath);

    for (const link of links) {
      for (const sign of zodiacSigns) {
        const url = `${link.base_url}${sign.name}`;
        let scrapeResults;

        // Site türüne göre uygun scraping fonksiyonunu çağır
        if (link.site === 'elle') {
          scrapeResults = await scrapeWithXPathElle(url);
        } else if (link.site === 'twitburc') {
          scrapeResults = await scrapeWithXPathTwitburc(url);
        } else {
          console.log(`No scraping function for site ${link.site}. Skipping...`);
          continue;
        }

        // Eğer sonuçlar boşsa, bu URL'yi atla
        if (!scrapeResults || scrapeResults.length === 0) {
          console.log(`No data found for ${sign.name} from ${url}. Skipping...`);
          continue;
        }

        const details = scrapeResults
          .map(r => r.text.trim())
          .filter(text => text.length >= 20) // Uzunluğu 20'den az olanları filtrele
          .join(' ');

        if (details.length > 0) {
          // Insert into DB
          const query = `INSERT INTO ${process.env.DB_TABLE} (zodiac_id, details) VALUES (?, ?)`;
          await connection.execute(query, [sign.id, details]);
        }

        console.log(`Scraped ${sign.name} from ${url}:`, scrapeResults);
      }
    }

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000
    });

    res.json({ message: 'Scraping completed.' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Hata var: ' + error.message);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
