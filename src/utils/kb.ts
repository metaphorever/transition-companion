import type { KBCache, KBItem, Category, Track, Sequence, Jurisdiction } from '../types'
import { readKBCache, writeKBCache, isKBCacheValid } from './storage'

const KB_ORG = 'metaphorever'
const KB_REPO = 'transition-kb'
const KB_BRANCH = 'main'
const KB_BASE = `https://raw.githubusercontent.com/${KB_ORG}/${KB_REPO}/${KB_BRANCH}`

// Bundled snapshot — static import so it never touches localStorage quota.
// Falls back to this when network is unavailable and cache is empty.
import bundledSnapshot from '../../public/kb-snapshot/index.json'

type BundledSnapshot = {
  fetched_at: string
  items: Record<string, KBItem>
  categories: Record<string, Category>
  tracks: Record<string, Track>
  sequences: Record<string, Sequence>
  jurisdictions: Record<string, Jurisdiction>
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`)
  return res.json() as Promise<T>
}

async function fetchIndex(): Promise<{ items: string[]; categories: string[]; tracks: string[]; sequences: string[]; jurisdictions: string[] }> {
  return fetchJSON(`${KB_BASE}/index.json`)
}

async function fetchAllFromNetwork(): Promise<KBCache> {
  const index = await fetchIndex()

  const [items, categories, tracks, sequences, jurisdictions] = await Promise.all([
    Promise.all(index.items.map(slug => fetchJSON<KBItem>(`${KB_BASE}/items/${slug}.json`))),
    Promise.all(index.categories.map(slug => fetchJSON<Category>(`${KB_BASE}/categories/${slug}.json`))),
    Promise.all(index.tracks.map(slug => fetchJSON<Track>(`${KB_BASE}/tracks/${slug}.json`))),
    Promise.all(index.sequences.map(slug => fetchJSON<Sequence>(`${KB_BASE}/sequences/${slug}.json`))),
    Promise.all(index.jurisdictions.map(path => fetchJSON<Jurisdiction>(`${KB_BASE}/jurisdictions/${path}.json`))),
  ])

  const cache: KBCache = {
    fetched_at: new Date().toISOString(),
    items: Object.fromEntries(items.map(i => [i.slug, i])),
    categories: Object.fromEntries(categories.map(c => [c.slug, c])),
    tracks: Object.fromEntries(tracks.map(t => [t.slug, t])),
    sequences: Object.fromEntries(sequences.map(s => [s.slug, s])),
    jurisdictions: Object.fromEntries(jurisdictions.map(j => [`${j.jurisdiction.country}-${j.jurisdiction.region ?? 'null'}`, j])),
  }

  return cache
}

function snapshotToCache(snapshot: BundledSnapshot): KBCache {
  return {
    fetched_at: snapshot.fetched_at,
    items: snapshot.items,
    categories: snapshot.categories,
    tracks: snapshot.tracks,
    sequences: snapshot.sequences,
    jurisdictions: snapshot.jurisdictions,
  }
}

export async function loadKB(): Promise<KBCache> {
  // 1. Valid cache in localStorage — use it.
  const cached = readKBCache()
  if (cached && isKBCacheValid(cached)) return cached

  // 2. Try network.
  try {
    const fresh = await fetchAllFromNetwork()
    writeKBCache(fresh)
    return fresh
  } catch {
    // Network failed — fall through.
  }

  // 3. Stale cache is better than nothing.
  if (cached) return cached

  // 4. Bundled snapshot as last resort.
  return snapshotToCache(bundledSnapshot as BundledSnapshot)
}

export async function refreshKB(): Promise<KBCache> {
  const fresh = await fetchAllFromNetwork()
  writeKBCache(fresh)
  return fresh
}

export function getItemWithJurisdictionOverrides(
  item: KBItem,
  jurisdiction: Jurisdiction | null
): KBItem {
  if (!jurisdiction) return item
  const override = jurisdiction.item_overrides[item.slug]
  if (!override) return item
  return {
    ...item,
    ...(override.label ? { label: override.label } : {}),
    process: item.process
      ? {
          ...item.process,
          ...(override.process_override ?? {}),
          ...(override.url_official ? { url_official: override.url_official } : {}),
        }
      : null,
  }
}
