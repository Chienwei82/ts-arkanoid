#!/usr/bin/env node
/**
 * Song curation: explores thousands of seeds, scores each one with `songScore`
 * (variety + motion + anti-repetition) and prints the seeds used by
 * `LEVEL_SONG_SEEDS` / `MENU_SONG_SEED`, greedy-selected so the four campaign
 * levels cover different progression × groove styles. Copy the printed list
 * into `src/audio/musicConstants.ts`.
 *
 * Usage: `npm run curate`. This is a development tool: it is never bundled and
 * the game does not depend on it.
 *
 * Why the /tmp round-trip: Node's type stripping does not resolve the
 * extensionless relative imports this project uses, so the pure modules are
 * copied to /tmp with an explicit `.ts` extension before being imported.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { CURATED_MIN_SCORE } from '../src/audio/musicConstants.ts'

interface SongProfile {
  progression: number
  groove: number
  rotation: number
}

interface MusicPatterns {
  songScore(seed: number): number
  songProfile(seed: number): SongProfile
}

/** Rewrites extensionless relative imports (`.ts` is required by strip-types). */
function loadableSource(path: string): string {
  return readFileSync(path, 'utf8').replace(/from '(\.[^']*)'/g, "from '$1.ts'")
}

const tmp = '/tmp/arkanoid-curate'
writeFileSync(tmp + '-constants.ts', loadableSource('src/audio/musicConstants.ts'))
writeFileSync(tmp + '-rng.ts', loadableSource('src/audio/musicRng.ts'))
writeFileSync(
  tmp + '-patterns.ts',
  loadableSource('src/audio/musicPatterns.ts')
    .replace("from './musicConstants.ts'", "from '" + tmp + "-constants.ts'")
    .replace("from './musicRng.ts'", "from '" + tmp + "-rng.ts'"),
)

const patterns = (await import(tmp + '-patterns.ts')) as unknown as MusicPatterns

const CANDIDATES = 4000
const WANTED = 4

const scored: { seed: number; score: number; profile: SongProfile }[] = []
for (let seed = 1; seed <= CANDIDATES; seed++) {
  scored.push({ seed, score: patterns.songScore(seed), profile: patterns.songProfile(seed) })
}
scored.sort((a, b) => b.score - a.score)

// Greedy selection with style diversity: the progression×groove styles first.
const picked: typeof scored = []
const styles = new Set<string>()
for (const entry of scored) {
  if (picked.length >= WANTED) break
  const key = entry.profile.progression + '-' + entry.profile.groove
  if (!styles.has(key) && entry.score >= CURATED_MIN_SCORE) {
    styles.add(key)
    picked.push(entry)
  }
}
for (const entry of scored) {
  if (picked.length >= WANTED) break
  if (!picked.includes(entry)) picked.push(entry)
}
picked.sort((a, b) => b.score - a.score)

const minScore = picked.length > 0 ? Math.min(...picked.map((p) => p.score)) : 0
const covered = new Set(picked.map((p) => p.profile.progression + '-' + p.profile.groove))
console.log(
  '// ' +
    picked.length +
    ' semillas (nota mínima ' +
    minScore +
    ', ' +
    covered.size +
    '/18 estilos).',
)
console.log('// Generado con `npm run curate` — ver tools/curate-seeds.ts.')
console.log(
  'export const LEVEL_SONG_SEEDS = [' + picked.map((p) => p.seed).join(', ') + '] as const',
)
const used = new Set(picked.map((p) => p.seed))
const menu = scored.find((s) => !used.has(s.seed) && s.score >= CURATED_MIN_SCORE)
console.log('export const MENU_SONG_SEED = ' + (menu?.seed ?? 0) + ' // → ' + (menu?.score ?? 0))
for (const p of picked) {
  console.log(
    '// ' +
      p.seed +
      ' → ' +
      p.score +
      ' (P' +
      p.profile.progression +
      ' G' +
      p.profile.groove +
      ' R' +
      p.profile.rotation +
      ')',
  )
}
