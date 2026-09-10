# Ninja del teclado — media assets

Local copies of fruit / SFX / sprite sheets for `/juegos/ninja/`.

## Layout

```
fruits/     apple, banana, coconut, lime, orange, strawberry (sprite sheets)
sounds/     error, pop, intro, game, sounds
sprites/    bg.jpg, stage, effects, slashes, splatter, monkey
```

## Sounds (`sounds/`)

| File | Role |
|------|------|
| `pop.mp3` | Correct slice / hit |
| `error.mp3` | Miss / wrong key |
| `intro.mp3` | Title / start sting |
| `game.mp3` | In-game music loop |
| `sounds.mp3` | Extra SFX bank (may be a packed strip — inspect before slicing cues) |

## Fruits (`fruits/`)

Each PNG is a **sprite sheet** (black = transparent key), not a single frame:

| File | Size | Notes |
|------|------|--------|
| `apple.png` | 784×668 | Whole angles + halves + cross-sections |
| `banana.png` | 704×511 | Whole + halves + round slices |
| `strawberry.png` | 716×668 | Whole + halves |
| `lime.png` | 520×516 | Whole + halves |
| `orange.png` | 668×338 | Likely whole + halves strip |
| `coconut.png` | 668×338 | Likely whole + halves strip |

Falling objects use a whole frame; on hit, swap to two half frames + slash / splatter.

## Sprites (`sprites/`)

| File | Size | Notes |
|------|------|--------|
| `bg.jpg` | 1500×750 | Playfield background |
| `stage.png` | 344×344 | Stage / platform piece |
| `effects.png` | 871×680 | Misc VFX sheet |
| `slashes.png` | 1022×710 | Slash / spark / confetti sheet |
| `splatter.png` | 640×379 | Juice splash on wall |
| `monkey.png` | 675×670 | Modular monkey (head, torso, legs, arms, mouths) |

## Public URLs

- `/assets/games/ninja/fruits/apple.png`
- `/assets/games/ninja/sounds/pop.mp3`
- `/assets/games/ninja/sprites/bg.jpg`
- …

The letter-only game lives at `/juegos/letras/` (`assets/js/games/letras.js`) so this folder can be wired into the fruit Ninja rewrite without breaking it.
