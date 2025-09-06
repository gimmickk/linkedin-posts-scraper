import { Actor, log } from 'apify';

await Actor.init();

const input = await Actor.getInput() as { profileUrl?: string; maxPosts?: number };
if (!input?.profileUrl) {
  throw new Error('profileUrl est requis dans l’input.');
}

log.info(`Profil ciblé: ${input.profileUrl} | maxPosts=${input.maxPosts ?? 5}`);

// TODO: ici tu mettras le vrai scraping. Pour l’instant, on renvoie un stub.
await Actor.pushData({
  profileUrl: input.profileUrl,
  maxPosts: input.maxPosts ?? 5,
  posts: []
});

await Actor.exit();
