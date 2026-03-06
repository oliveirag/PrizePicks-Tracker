const { chromium } = require("playwright-extra");
const StealthPlugin = require("playwright-extra-plugin-stealth");
chromium.use(StealthPlugin());

/**
 * Launches a headless browser, navigates to the given public lineup page,
 * and extracts all visible entries.
 *
 * @param {string} url - The public open-lineups URL for the user
 * @returns {Promise<Entry[]>} Array of parsed entry objects
 */
async function scrapeEntries(url) {
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    // Block images/fonts to speed up load
    await page.route("**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf}", (route) =>
      route.abort()
    );

    console.log(`[scraper] Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    await page
      .waitForSelector('[class*="entry"], [class*="lineup"], [class*="slip"]', {
        timeout: 15000,
      })
      .catch(() => {
        console.warn("[scraper] Could not find lineup cards with primary selectors, trying fallback...");
      });

    await page.waitForTimeout(500);

    const html = await page.content();

    const entries = await page.evaluate(() => {
      const results = [];

      const cardSelectors = [
        '[class*="entry-card"]',
        '[class*="lineup-card"]',
        '[class*="slip"]',
        '[data-testid*="entry"]',
        '[data-testid*="lineup"]',
      ];

      let cards = [];
      for (const sel of cardSelectors) {
        cards = Array.from(document.querySelectorAll(sel));
        if (cards.length > 0) break;
      }

      if (cards.length === 0) {
        cards = Array.from(
          document.querySelectorAll('[class*="card"], [class*="tile"]')
        ).filter((el) => {
          const text = el.innerText || "";
          return (
            text.includes("More") ||
            text.includes("Less") ||
            text.includes("MORE") ||
            text.includes("LESS")
          );
        });
      }

      for (const card of cards) {
        const text = card.innerText || "";
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        const entryId =
          card.getAttribute("data-entry-id") ||
          card.getAttribute("data-id") ||
          card.id ||
          null;

        const players = [];
        const playerEls = card.querySelectorAll(
          '[class*="player"], [class*="pick"], [class*="prop"]'
        );

        if (playerEls.length > 0) {
          playerEls.forEach((el) => {
            players.push(el.innerText.trim());
          });
        }

        const typeEl = card.querySelector(
          '[class*="type"], [class*="mode"], [class*="play-type"]'
        );
        const amountEl = card.querySelector(
          '[class*="amount"], [class*="wager"], [class*="entry-fee"]'
        );
        const payoutEl = card.querySelector(
          '[class*="payout"], [class*="win"]'
        );

        results.push({
          id: entryId,
          rawText: text,
          rawLines: lines,
          players: players.map((p) => p),
          type: typeEl ? typeEl.innerText.trim() : null,
          amount: amountEl ? amountEl.innerText.trim() : null,
          payout: payoutEl ? payoutEl.innerText.trim() : null,
          scrapedAt: new Date().toISOString(),
        });
      }

      return results;
    });

    console.log(`[scraper] Found ${entries.length} entries at ${url}`);

    if (process.env.DEBUG_HTML === "true") {
      const fs = require("fs");
      const safeName = url.replace(/[^a-z0-9]/gi, "_").slice(-40);
      fs.writeFileSync(`debug_${safeName}.html`, html);
      console.log(`[scraper] Dumped page HTML to debug_${safeName}.html`);
    }

    return entries;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeEntries };