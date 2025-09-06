const items: Post[] = await page.$$eval(POSTS_SEL, (els: Element[]) => {
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
