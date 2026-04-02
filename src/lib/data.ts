// JSON-based data layer using Vercel Blob for read/write
import { put } from '@vercel/blob';

const BLOB_BASE = 'https://tgbsyi4o90fqlezu.public.blob.vercel-storage.com/data';

// In-memory cache with TTL
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 10_000; // 10 seconds — serverless instances are short-lived

// Write mutex per JSON file — prevents concurrent read-modify-write races
const writeLocks = new Map<string, Promise<void>>();
async function withWriteLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(name) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>(r => { resolve = r; });
  writeLocks.set(name, next);
  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

async function fetchJson<T>(name: string, skipCache = false): Promise<T> {
  const now = Date.now();
  if (!skipCache) {
    const cached = cache.get(name);
    if (cached && now - cached.ts < CACHE_TTL) {
      return cached.data as T;
    }
  }

  try {
    const res = await fetch(
      skipCache ? `${BLOB_BASE}/${name}.json?t=${now}` : `${BLOB_BASE}/${name}.json`,
      skipCache ? { cache: 'no-store' } : { next: { revalidate: 10 } },
    );
    if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
    const data = await res.json();
    cache.set(name, { data, ts: now });
    return data as T;
  } catch {
    // Fallback only when Blob fetch is unavailable (e.g. build/network issue)
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'src', 'data', `${name}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        cache.set(name, { data, ts: now });
        return data as T;
      }
    } catch {
      // ignore and rethrow below
    }
    throw new Error(`Failed to fetch ${name}`);
  }
}

async function writeJson(name: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await put(`data/${name}.json`, content, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  // Update cache immediately so next read within same instance gets fresh data
  cache.set(name, { data, ts: Date.now() });
}

// ============ READ ============

export async function getPortfolio(): Promise<AnyData[]> {
  const data = await fetchJson<AnyData[]>('portfolio');
  return data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getPortfolioById(id: string): Promise<AnyData | undefined> {
  const data = await fetchJson<AnyData[]>('portfolio');
  return data.find(a => a.id === id);
}

export async function getFeaturedArtworks(): Promise<AnyData[]> {
  const data = await getPortfolio();
  return data.filter(a => a.is_featured);
}

export async function getCategories(): Promise<AnyData[]> {
  return fetchJson<AnyData[]>('categories');
}

export async function getCategoryById(id: string): Promise<AnyData | undefined> {
  const data = await fetchJson<AnyData[]>('categories');
  return data.find(c => c.id === id);
}

export async function getTags(): Promise<AnyData[]> {
  return fetchJson<AnyData[]>('tags');
}

export async function getTagById(id: string): Promise<AnyData | undefined> {
  const data = await fetchJson<AnyData[]>('tags');
  return data.find(t => t.id === id);
}

export async function addTag(tag: AnyData): Promise<AnyData> {
  return withWriteLock('tags', async () => {
    const tags = await fetchJson<AnyData[]>('tags', true);
    const newTag = {
      ...tag,
      id: tag.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    tags.push(newTag);
    await writeJson('tags', tags);
    return newTag;
  });
}

export async function getAbout(): Promise<AnyData> {
  return fetchJson<AnyData>('about');
}

export async function getExhibitions(): Promise<AnyData[]> {
  return fetchJson<AnyData[]>('exhibitions');
}

export async function getExhibitionById(id: string): Promise<AnyData | undefined> {
  const data = await fetchJson<AnyData[]>('exhibitions');
  return data.find(e => e.id === id);
}

export async function getNews(): Promise<AnyData[]> {
  return fetchJson<AnyData[]>('news');
}

export async function getNewsById(id: string): Promise<AnyData | undefined> {
  const data = await fetchJson<AnyData[]>('news');
  return data.find(n => n.id === id);
}

export async function getAdminSettings(): Promise<AnyData> {
  return fetchJson<AnyData>('admin_settings');
}

// ============ WRITE ============

export async function updatePortfolio(artworks: AnyData[]): Promise<void> {
  await writeJson('portfolio', artworks);
}

export async function addArtwork(artwork: AnyData): Promise<AnyData> {
  return withWriteLock('portfolio', async () => {
    const artworks = await fetchJson<AnyData[]>('portfolio', true);
    const maxOrder = Math.max(...artworks.map(a => a.order ?? 0), -1);
    const newArtwork = {
      ...artwork,
      id: artwork.id || crypto.randomUUID(),
      order: maxOrder + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    artworks.push(newArtwork);
    await writeJson('portfolio', artworks);
    return newArtwork;
  });
}

export async function updateArtwork(id: string, updates: Partial<AnyData>): Promise<AnyData | null> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await withWriteLock('portfolio', async () => {
      // Always fetch fresh from Blob (bypass all caches)
      const res = await fetch(`${BLOB_BASE}/portfolio.json?t=${Date.now()}_${Math.random()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch portfolio: ${res.status}`);
      const artworks = await res.json() as AnyData[];
      
      const idx = artworks.findIndex((a: AnyData) => a.id === id);
      if (idx === -1) return null;
      artworks[idx] = { ...artworks[idx], ...updates, updated_at: new Date().toISOString() };
      await writeJson('portfolio', artworks);
      return artworks[idx];
    });
    
    if (result === null) return null;
    
    // Verify write: re-read and check our update is there
    await new Promise(r => setTimeout(r, 200)); // small delay for Blob propagation
    const verifyRes = await fetch(`${BLOB_BASE}/portfolio.json?verify=${Date.now()}`, { cache: 'no-store' });
    if (verifyRes.ok) {
      const verified = await verifyRes.json() as AnyData[];
      const found = verified.find((a: AnyData) => a.id === id);
      if (found && found.updated_at === result.updated_at) {
        cache.set('portfolio', { data: verified, ts: Date.now() });
        return result; // Write confirmed
      }
      console.warn(`updateArtwork retry ${attempt + 1}: write not verified for ${id}`);
    }
  }
  throw new Error(`updateArtwork failed after ${MAX_RETRIES} retries for ${id}`);
}

export async function deleteArtwork(id: string): Promise<boolean> {
  return withWriteLock('portfolio', async () => {
    const artworks = await fetchJson<AnyData[]>('portfolio', true);
    const filtered = artworks.filter(a => a.id !== id);
    if (filtered.length === artworks.length) return false;
    await writeJson('portfolio', filtered);
    return true;
  });
}

export async function updateCategories(categories: AnyData[]): Promise<void> {
  await writeJson('categories', categories);
}

export async function updateTags(tags: AnyData[]): Promise<void> {
  await writeJson('tags', tags);
}

export async function updateAbout(about: AnyData): Promise<void> {
  await writeJson('about', about);
}

export async function updateExhibitions(exhibitions: AnyData[]): Promise<void> {
  await writeJson('exhibitions', exhibitions);
}

export async function updateNews(news: AnyData[]): Promise<void> {
  await writeJson('news', news);
}

export async function updateAdminSettings(settings: AnyData): Promise<void> {
  await writeJson('admin_settings', settings);
}
