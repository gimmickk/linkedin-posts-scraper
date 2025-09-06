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

    // Alternative approach: use page.evaluate instead of page.$$eval
    const items = await page.evaluate(() => {
      const posts = document.querySelectorAll('div.feed-shared-update-v2');
      const results = [];
      
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        
        // Get URL
        const linkEl = post.querySelector('a[href*="/posts/"]') || 
                      post.querySelector('a[href*="/activity/"]') ||
                      post.querySelector('a.app-aware-link');
        const url = linkEl ? linkEl.getAttribute('href') || '' : '';
        
        // Get text
        const textEl = post.querySelector('div.update-components-text') || 
                      post.querySelector('div[dir="ltr"]') ||
                      post.querySelector('span.break-words') ||
                      post;
        const text = textEl ? (textEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1500) : '';
        
        // Get date
        const dateEl = post.querySelector('span.update-components-actor__sub-description') ||
                      post.querySelector('span.visually-hidden') ||
                      post.querySelector('time');
        const dateText = dateEl ? (dateEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        
        // Get reactions
        const reactionsEl = post.querySelector('span.social-details-social-counts__reactions-count') ||
                           post.querySelector('span.update-v2-social-activity__summation-count');
        const reactionsText = reactionsEl ? (reactionsEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        
        // Get comments
        const commentsEl = post.querySelector('span.social-details-social-counts__comments') ||
                          post.querySelector('a[href*="comments"]');
        const commentsText = commentsEl ? (commentsEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        
        if (url || text) {
          results.push({
            url: url.startsWith('http') ? url : (url ? `https://www.linkedin.com${url}` : ''),
            text,
            dateText,
            reactionsText,
            commentsText,
          });
        }
      }
      
      return results;
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
