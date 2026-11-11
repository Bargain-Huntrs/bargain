#!/usr/bin/env node
/**
 * Blog → social queue bridge.
 *
 * Fetches bargainhuntrs.com/feed.xml and appends any blog article not already
 * in content_queue.json as a new queue entry, dated one-per-day after the
 * last queued entry. The existing social-daily workflow then posts them to
 * every configured platform and commits the updated queue.
 *
 * Runs inside the social-daily GitHub Action before social_poster.py.
 * Safe to run repeatedly — already-queued articles (matched by link) are
 * skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUEUE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'content_queue.json');
const FEED_URL = process.env.FEED_URL || 'https://bargainhuntrs.com/feed.xml';

function parseFeed(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  const unesc = (s) =>
    s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const pick = (block, tag) => {
    const t = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return t ? unesc(t[1]).trim() : '';
  };
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    items.push({
      title: pick(block, 'title'),
      link: pick(block, 'link'),
      pubDate: pick(block, 'pubDate'),
      description: pick(block, 'description'),
    });
  }
  return items;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const res = await fetch(FEED_URL).catch(() => null);
  if (!res || !res.ok) { console.log(`Feed unavailable (${res?.status ?? 'offline'}) — skipping.`); return; }
  const articles = parseFeed(await res.text());
  if (!articles.length) {
    console.log('Feed empty — nothing to queue.');
    return;
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const queuedLinks = new Set(queue.map((q) => q.link).filter(Boolean));
  const newArticles = articles.filter((a) => a.link && !queuedLinks.has(a.link));

  if (!newArticles.length) {
    console.log('No new blog articles to queue.');
    return;
  }

  // Schedule after the last queued date (or today if the queue is behind),
  // one article per day.
  const lastDate = queue.reduce(
    (max, q) => (q.date && q.date > max ? q.date : max),
    todayISO(),
  );

  newArticles.forEach((a, i) => {
    const entry = {
      date: addDays(lastDate, i + 1),
      text: `New on the blog: ${a.title}\n\n${a.description}`.slice(0, 2000),
      link: a.link,
      platforms: {
        reddit: {
          subreddit: 'bargainhuntrs',
          title: a.title.slice(0, 290),
        },
      },
    };
    queue.push(entry);
    console.log(`Queued "${a.title}" for ${entry.date}`);
  });

  // Escape non-ASCII as \uXXXX so the file stays in the same style Python's
  // json.dump (ensure_ascii=True) produces — otherwise every run reformats
  // the whole file and the CI commit diff is noise.
  const json = JSON.stringify(queue, null, 2).replace(/[\u0080-\uffff]/g, (c) =>
    `\\u${c.codePointAt(0).toString(16).padStart(4, '0')}`);
  fs.writeFileSync(QUEUE_PATH, json + '\n');
  console.log(`content_queue.json updated (+${newArticles.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
