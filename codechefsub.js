const puppeteer = require('puppeteer');

async function getRecentSubmissions(username) {
  const url = `https://www.codechef.com/users/${username}`;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto(url, { waitUntil: 'networkidle2' });

  const submissions = await page.evaluate(() => {
    const rows = document.querySelectorAll('#content > div > div:nth-child(2) table tbody tr');
    const data = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        data.push({
          time: cells[0].innerText.trim(),
          problem: cells[1].innerText.trim(),
          language: cells[2].innerText.trim(),
          result: cells[3].innerText.trim(),
          points: cells[4].innerText.trim(),
        });
      }
    });
    return data;
  });

  await browser.close();
  return submissions;
}

(async () => {
  const username = 'sathvikch'; 
  const submissions = await getRecentSubmissions(username);
  console.log('Recent Submissions:', submissions);
})();
