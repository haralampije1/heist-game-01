// Night Shift entry hand-in for make.fun's best-heist-game-20261122-0559 bounty.
// Runs on Node 22 with the standard library only (type-stripped .ts, nothing
// installed). Copies game/ and screenshots/ from beside this file into /output
// and writes /output/dossier.json with the kit's vendored buildDossier from
// vendor/makefun-game.ts (that file is copied from the kit, unchanged). The
// grader runs this program twice and both runs must write byte-identical
// output: directory copies and the dossier write are deterministic, so they
// are. Output is written under MAKEFUN_OUTPUT_DIR (or /output under the
// grader) and contains game/, screenshots/ and dossier.json only.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

for (const name of ['game', 'screenshots']) {
  const src = join(here, name);
  const dst = join(out, name);
  if (existsSync(dst)) rmSync(dst, { recursive: true });
  if (existsSync(src)) cpSync(src, dst, { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000
  })
);
