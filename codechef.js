const puppeteer = require('puppeteer-core');
const chromePaths = require('chrome-paths');

async function getCodeChefUserDetails(username) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePaths.chrome,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(`https://www.codechef.com/users/${username}`, {
    waitUntil: 'networkidle2',
  });

  const data = await page.evaluate(() => {
    const getText = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.innerText.trim() : 'N/A';
    };

    const stars = document.querySelector('.rating-star')?.innerText.trim().length || 0;
    const username = window.location.pathname.split('/').pop() || 'N/A';
    const rating = getText('.rating-number');
    const fullySolved = getText('.rating-data-section.problems-solved h5:nth-of-type(1) + p') || '0';
    const partiallySolved = getText('.rating-data-section.problems-solved h5:nth-of-type(2) + p') || '0';

    const globalRank = getText('.rating-ranks ul li:nth-of-type(1) strong');
    const countryRank = getText('.rating-ranks ul li:nth-of-type(2) strong');

    // Heatmap - Extracting SVG content as string (you can use this in frontend to render)
    const heatmap = document.querySelector('#heatmap-graph')?.outerHTML || '';

    return {
      userName: username,
      rating,
      stars,
      globalRank,
      countryRank,
      fullySolved,
      partiallySolved,
      heatmap,
    };
  });

  await browser.close();
  return data;
}

// Example usage
getCodeChefUserDetails('sathvikch')
  .then(data => {
    console.log('✅ CodeChef User Details:', data);
  })
  .catch(err => {
    console.error('❌ Failed to fetch CodeChef user details:', err);
  });
