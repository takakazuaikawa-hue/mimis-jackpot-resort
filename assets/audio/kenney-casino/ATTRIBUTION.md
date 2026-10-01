# Kenney Casino Audio — complete runtime bank

This directory is the licensed, reviewable baseline for the hybrid audio
engine. On 2026-09-01 the prior 12-file subset was expanded to all 54 OGG files
delivered by the official Casino Audio 1.1 archive. The official page currently
labels the pack as 50 files, but the downloaded archive contains 54 files in its
`Audio/` directory; the archive and each runtime file are therefore pinned by
size and SHA-256 in `manifest.json` rather than trusting the page count.

This is not a claim that the final slot-machine sound direction is finished.
Production reel, stop and payout recordings should be replaced or layered with
a dedicated slot library after that library is licensed and its source files
are available locally.

- Original publisher: Kenney Vleugels (Kenney.nl)
- Official pack: <https://kenney.nl/assets/casino-audio>
- License: Creative Commons Zero 1.0 (CC0)
- Included license text: `License.txt`
- Archive download: 876,839 bytes
- Archive SHA-256:
  `f36250766ac5bc378c13708ddf12a23a8e54a3251f8d482c7536e51b5dbafa18`
- Transfer: byte-for-byte extraction; no transcoding or edits

## Exact files

`manifest.json` is the machine-readable source of truth for the exact 54 OGG
filenames, byte sizes and SHA-256 hashes, plus the downloaded archive identity.
`npm run verify:audio` rejects any missing, extra or byte-drifted OGG file.

## Runtime boundary

`sfx.js` loads these files only after a user gesture unlocks Web Audio. Missing
or undecodable files fall back to a low-volume procedural cue. The continuous
reel motor is procedural and loses one of three voices at each STOP; recorded
samples provide the impact layer.

No music from another Mimi project is included because its generation and
subscription evidence has not yet been established.

## Planned production upgrade

Preferred order for final source selection:

1. A licensed dedicated slot-machine recording pack for reel whir, three stop
   impacts, credit input and payout mechanics.
2. Sonniss GameAudioGDC material for supplementary impacts only, with the exact
   bundle, filename, EULA snapshot and SHA-256 stored beside every adopted file.
3. This complete Kenney CC0 bank for UI, cards, chips and safe fallback texture.
4. Freesound only when the individual item is CC0 and its item URL, author,
   download date, license snapshot and SHA-256 are recorded.

All candidate replacements remain `PRODUCTION UNAPPROVED` until they have been
auditioned against SPIN → STOP1 → STOP2 → STOP3, CHANCE, BONUS, BOSS and
JACKPOT in the independent audio review lab.
