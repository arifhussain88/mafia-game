# Audio

- `dark.mp3`: lobby music track already in the project.
- Everything else is synthesized at runtime in `src/lib/audio.ts` (Web Audio). That covers countdown ticks, the night-report keyboard, the Mafia gunshot (crack + boom + street-echo reverb), the vote-out impact, and the Mafia's private "target locked" click. There are no third-party sample files and no copyright claims on those effects.

## Optional recorded gunshot

If `gunshot.mp3` exists in this folder, the game uses it instead of the synthesized shot. It plays on the same clock as the night-report typing, still exactly on the victim's name. To add one:

1. Use only **CC0 / public domain** audio (for example OpenGameArt or Freesound with the licence filter set to CC0). Check the licence on the file's own page.
2. Trim it to one short shot (about 1–1.5 s, including its echo), export it as MP3 under 60 KB, and save it here as `gunshot.mp3`.
3. Record the source below.

| File | Source URL | Author | Licence |
|------|-----------|--------|---------|
| _(none yet; the synthesized shot is used)_ | | | |
