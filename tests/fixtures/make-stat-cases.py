# Writes tests/fixtures/stat-cases.json: stats worked out by an independent Python port of PokeRogue's
# Pokemon.calculateStats (written from the game source, not from our TypeScript), so that tests/fuse.test.ts
# can check src/fuse.ts against it. Each row is
#   [stat index (0 = HP), fused base stat, level, IV, nature multiplier, vitamin stacks, Macho Brace stacks, Soul Dew stacks, expected stat]
# Run: python3 tests/fixtures/make-stat-cases.py > tests/fixtures/stat-cases.json
import json, math, random

def ref(stat, base, level, iv, nature, vit, brace, dew):
    vit = min(vit, iv)                                  # BaseStatModifier: at most IV stacks
    base = math.floor(base * (1 + vit * 0.1))           # BaseStatModifier.apply
    v = math.floor((2 * base + iv) * level * 0.01)
    if stat == 0:
        v = v + level + 10
        v += 2 * brace                                  # PokemonIncrementingStatModifier (HP)
        if brace == 50:
            v = math.floor(v * 1.1)
        return max(v, 1)
    v += 5
    m = nature
    if m != 1:                                          # PokemonNatureWeightModifier.apply
        m += 0.1 * dew * (1 if m > 1 else -1)
    if m != 1:
        v = max((math.ceil if m > 1 else math.floor)(v * m), 1)
    v += brace                                          # PokemonIncrementingStatModifier (other stats)
    if brace == 50:
        v = math.floor(v * 1.05)
    return max(v, 1)

random.seed(2024)
cases = []
for _ in range(600):
    stat = random.randint(0, 5)
    base = random.randint(1, 255)
    level = random.choice([1, 5, 50, 100, 250, random.randint(1, 2000), random.randint(1, 100000)])
    iv = random.randint(0, 31)
    nature = random.choice([1, 1.1, 0.9])
    vit = random.choice([0, 0, random.randint(0, 31)])
    brace = random.choice([0, 0, 50, random.randint(0, 50)])
    dew = random.choice([0, 0, 10, random.randint(0, 10)])
    cases.append([stat, base, level, iv, nature, vit, brace, dew, ref(stat, base, level, iv, nature, vit, brace, dew)])
print("[\n" + ",\n".join(json.dumps(c) for c in cases) + "\n]")
