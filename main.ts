import { Actor, log } from 'apify';

type Input = {
  profileUrl: string;
  maxPosts?: number;
  linkedinSessionCookie?: string; // li_at (optionnel)
};

type Post = {
  url: string;
  text: string;
  dateText?: string;
  reactionsText?: string;
  commentsText?: string;
};

function toActivityUrl(profileUrl: string) {
  const u = profileUrl.trim();
  const base = u.endsWith('/') ? u.slice(0, -1) : u;
  return `${base}/detail/recent-activity/shares/`;
}

function parseLiAt(raw?: string) {
  if (!raw) return null;
  const m = raw.includes('li_at=')
    ? raw.match(/li_at=([^;]+)/)
    : [, raw.trim()];
  return m?.[1] || null;
}

async function autoScroll(page: any, maxMs = 8000) {
  const start = Date.now();
  let last = 0;
  while (Date.now() - start < maxMs) {
    const cur = await page.evaluate('document.body.scrollHeight');
    if (cur === last) break;
    last = cur;
    await page.mouse.wheel(0, 12000);
    await page.waitForTimeout(600);
  }
}

async function extractPosts(page: any, wanted: number): Promise<Post[]> {
  // Sélecteurs tolérants aux changements LinkedIn
  const POSTS_SEL = [
    'div.feed-shared-update-v2',             // ancien layout
    'div[data-urn*="activity"]',             // nouveau layout
    'article:has(a[href*="/activity/"])'     // fallback
  ].join(',');

  await page.waitForSelector(POSTS_SEL, { timeout: 15000 });

  // charge plus si besoin
  await autoScroll(page, 4000);

  const items: Post[] = await page.$$eval(POSTS_SEL, (els) => {
    const takeText = (el: Element) =>
      (el.textContent || '').replace(/\s+/g, ' ').trim();

    const pick = (root: Element, selectors: string[]) => {
      for (const s of selectors) {
        const n = root.querySelector(s);
        if (n) return n as HTMLElement;
      }
      return null;
    };

    const out: Post[] = [];
    for (const el of els) {
      const linkEl =
        pick(el, ['a[href*="/posts/"]', 'a[href*="/activity/"]']) ||
        pick(el, ['a.app-aware-link']);
      const url = linkEl?.getAttribute('href') || '';

      // contenu (texte principal)
      const textEl =
        pick(el, ['div.update-components-text', 'div[dir="ltr"]', 'span.break-words']) || el;
      const text = takeText(textEl).slice(0, 1500);

      // date
      const dateEl = pick(el, ['span.update-components-actor__sub-description', 'span.visually-hidden', 'time']);
      const dateText = dateEl ? takeText(dateEl) : undefined;

      // métriques visibles
      const reactionsEl = pick(el, ['span.social-details-social-counts__reactions-count', 'span.update-v2-social-activity__summation-count']);
      const commentsEl  = pick(el, ['span.social-details-social-counts__comments', 'a[href*="comments"]']);
      const reactionsText = reactionsEl ? takeText(reactionsEl) : undefined;
      const commentsText  = commentsEl ? takeText(commentsEl)  : undefined;

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

  return items.slice(0, Math.max(1, wanted));
}

await Actor.init();
try {
  const input = (await Actor.getInput()) as Input;
  if (!input?.profileUrl) throw new Error('`profileUrl` est requis dans l’input.');

  const maxPosts = Math.max(1, input.maxPosts ?? 5);
  const targetUrl = toActivityUrl(input.profileUrl);
  const liAt = parseLiAt(input.linkedinSessionCookie);

  log.info(`profil: ${input.profileUrl} → ${targetUrl} | maxPosts=${maxPosts}${liAt ? ' | cookie: oui' : ''}`);

  // playwright est préinstallé dans l’image apify/actor-node-playwright
  const { chromium }: any = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });

  // cookie optionnel pour posts non publics / métriques privées
  if (liAt) {
    await context.addCookies([
      {
        name: 'li_at',
        value: liAt,
        domain: '.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
  }

  const page = await context.newPage();
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });

  const posts = await extractPosts(page, maxPosts);
  await Actor.pushData(posts);

  log.info(`ok: ${posts.length} post(s) extrait(s).`);
  await browser.close();
} catch (err: any) {
  log.exception(err, 'scrape_failed');
  throw err;
} finally {
  await Actor.exit();
}
