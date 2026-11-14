# Asteroids-1337

[![Live](https://img.shields.io/badge/play-live-7df9ff?style=flat-square)](https://nwfella.github.io/Asteroids-1337/)

A modernized take on the 1979 arcade classic: same inertia, same screen wrap, same
"one more run" loop — rebuilt with a real-time vector renderer, bloom, shockwaves and
molten rock. One HTML file, zero dependencies, zero network requests.

**▶ Play: https://nwfella.github.io/Asteroids-1337/**

## What's in it

| System | Detail |
|---|---|
| Renderer | Canvas 2D → offscreen scene → quarter-res bloom pass → composite, with additive neon glow strokes |
| Impact FX | Trauma-based screen shake, hitstop, slow-motion, zoom punch, chromatic aberration, radial flash |
| Explosions | Pooled sparks, embers, tumbling shards, smoke, expanding shockwave rings, white core flash — no per-hit allocations |
| Asteroids | Procedurally generated polygons with craters and cracks; icy, violet and molten variants (molten seams pulse) |
| Ship | Afterimage trail, thruster plume particles, rotating shield hex on respawn, warp streaks |
| Surge | Chain kills charge a screen-clearing shockwave (E / touch button) that shreds rock and enemy fire |
| Meta | ×1–×8 chain multiplier, extra ship every 10,000, saucers, waves with splitting rocks |
| Field | Parallax starfield over a baked nebula, vignette, CRT scanlines, proximity danger tint |
| Layout | Canvas-sized HUD (never DOM in the loop), DPR-aware, portrait + landscape, scale-aware speeds |
| Mobile | Pointer Events virtual stick + FIRE / SURGE / HYPER buttons, hand-swappable, tested on coarse pointers |
| Settings | Graphics tier, bloom, scanlines, shake, audio + volume, touch hand — persisted to localStorage |

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Rotate | ← → / A D | drag stick toward heading |
| Thrust | ↑ / W | push stick outward |
| Fire | Space (hold) / click | FIRE |
| Hyperspace | Shift | HYPER |
| Surge bomb | E | SURGE (when charged) |
| Pause | P / Esc | — |

## Tech

Vanilla JavaScript, Canvas 2D and the Web Audio API. No frameworks, no build step, no
external assets — the source is split into parts in `src/` and concatenated by
`build.sh` into the single `index.html` that ships.

## Dev

```bash
bash build.sh                       # src/* -> index.html
# in-page harnesses:
#   index.html?test=1      22 logic + pixel checks, result in <title> and <pre id="testout">
#   index.html?soak=3000   autopilot soak run (wave progress, error count)
#   index.html?shot=menu|play|boom|mobile|settings   deterministic screenshot states
```

Headless verification:

```bash
chrome --headless=new --disable-gpu --enable-unsafe-swiftshader --virtual-time-budget=25000 \
  --dump-dom "file:///$PWD/index.html?test=1" | grep -o '<title>[^<]*'
```

## License

MIT — see [LICENSE](LICENSE).
