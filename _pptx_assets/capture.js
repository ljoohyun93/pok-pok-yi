/* Capture various game screens for the portfolio PPT */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT = path.dirname(__filename);
const URL = 'https://pok-pok-yi.onrender.com';

async function shoot(page, file, opts = {}) {
  const fp = path.join(OUT, file);
  await page.screenshot({ path: fp, type: 'png', ...opts });
  console.log('saved', file);
}

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  /* Desktop landscape capture for slides */
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

  /* 1. Lobby */
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  await shoot(page, '01-lobby.png');

  /* 2. SOLO mode toggled */
  await page.click('.mode-btn[data-mode="single"]');
  await new Promise(r => setTimeout(r, 400));
  await shoot(page, '02-lobby-solo.png');

  /* 3. Solo game in progress */
  await page.type('#inp-nick', 'PORTFOLIO');
  await page.click('#btn-create');
  await new Promise(r => setTimeout(r, 4500));
  await shoot(page, '03-game-solo.png');

  /* 4. Click some bubbles to populate effects */
  for (let i = 0; i < 25; i++) {
    const target = await page.$(`[data-id="${10 + i * 7}"]`);
    if (target) await target.click({ delay: 5 });
    await new Promise(r => setTimeout(r, 30));
  }
  await new Promise(r => setTimeout(r, 600));
  await shoot(page, '04-game-popping.png');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
