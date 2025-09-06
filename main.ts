import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

interface Post {
  url: string;
  text: string;
  dateText?: string;
  reactionsText?: string;
  commentsText?: string;
}

interface Input {
  profileUrl: string;
  maxPosts?: number;
  linkedinSessionCookie?: string;
}

const POSTS_SEL = 'div.feed-shared-update-v2';

await Actor.init();

const input = await Actor.getInput<Input>();
if (!input?.profileUrl) {
  throw new Error('Missing profileUrl in input');
}

const { profileUrl, maxPosts = 10, linkedinSessionCookie } = input;

// Convert profile URL to recent activity URL
const activityUrl = profileUrl.replace(/\/$/, '') + '/detail/recent-activity/shares/';

const crawler = new PlaywrightCrawler({
  launchContext: {
    launchOptions: {
      headless: true,
    },
  },
  async requestHandler({ page, request }) {
    console.log(`Processing ${request.url}`);

    // Set LinkedIn session cookie if provided
    if (linkedinSessionCookie) {
      await page.context().addCookies([
        {
          name: 'li_at',
          value: linkedinSessionCookie,
          domain: '.linkedin.com',
          path: '/',
        },
      ]);
    }

    await page.goto(request.url, { waitUntil: 'networkidle' });
    
    // Wait for posts to load
    await page.waitForSelector(POSTS_SEL, { timeout: 15000 });
    
    // Scroll to load more posts
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('End');
      await page.waitForTimeout(2000);
    }

    const items: Post[] = await page.$$eval(POSTS_SEL, (els: any) => {
      const takeText = (el: Element) =>
        (el.textContent || '').replace(/\s+/g, ' ').trim();
      const pick = (root: Element, selectors: string[]) => {
        for (const s of selectors) {
          const n = root.querySelector(s);
          if (n) return n as HTMLElement;
        }
        return null;
      };
      const out: any[] = [];
      for (const el of els) {
        const linkEl =
          pick(el, ['a[href*="/posts/"]', 'a[href*="/activity/"]']) ||
          pick(el, ['a.app-aware-link']);
        const url = linkEl?.getAttribute('href') || '';
        const textEl =
          pick(el, ['div.update-components-text', 'div[dir="ltr"]', 'span.break-words']) || el;
        const text = takeText(textEl).slice(0, 1500);
        const dateEl = pick(el, [
          'span.update-components-actor__sub-description',
          'span.visually-hidden',
          'time',
        ]);
        const dateText = dateEl ? takeText(dateEl) : undefined;
        const reactionsEl = pick(el, [
          'span.social-details-social-counts__reactions-count',
          'span.update-v2-social-activity__summation-count',
        ]);
        const commentsEl = pick(el, [
          'span.social-details-social-counts__comments',
          'a[href*="comments"]',
        ]);
        const reactionsText = reactionsEl ? takeText(reactionsEl) : undefined;
        const commentsText = commentsEl ? takeText(commentsEl) : undefined;
        if (url || text) {
          out.push({
            url: url.startsWith('http') ? url : (url ? `https://www.linkedin.com${url}` : ''),
            text,
            dateText,
            reactionsText,
            commentsText,
          });
        }
      }
      return out;
    });

    console.log(`Found ${items.length} posts`);
    
    // Limit to maxPosts
    const limitedItems = items.slice(0, maxPosts);
    
    // Save to dataset
    await Actor.pushData(limitedItems);
  },
});

await crawler.run([activityUrl]);

await Actor.exit();
