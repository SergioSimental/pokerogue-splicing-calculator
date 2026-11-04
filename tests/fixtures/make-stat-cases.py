# Writes tests/fixtures/stat-cases.json: stats worked out by an independent Python port of PokeRogue's
# Pokemon.calculateStats (written from the game source, not from our TypeScript), so that tests/fuse.test.ts
# can check src/fuse.ts against it. Each row is
#   [stat index (0 = HP), fused base stat, level, IV, nature multiplier, vitamin stacks, Macho Brace stacks, Soul Dew stacks, expected stat]
# Run: python3 tests/fixtures/make-stat-cases.py > tests/fixtures/stat-cases.json
#
# With the argument "base" it writes tests/fixtures/base-stat-cases.json instead: a Pokémon's own base stats after
# Sweet/Foul Shuckle Juice and Old Gateau (PokeRogue's Pokemon.calculateBaseStats), each row being
#   [six base stats, sweet juice held, foul juice held, old gateau held, six expected base stats]
# Run: python3 tests/fixtures/make-stat-cases.py base > tests/fixtures/base-stat-cases.json
import json, math, random, sys

def ref(stat, base, level, iv, nature, vit, brace, dew):
    vit = min(vit, 31)                                  # the formula counts the stacks held (holding limits are the caller's job)
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

def ref_base(base, sweet, foul, gateau):
    stats = list(base)

    def shuckle(modifier):                              # PokemonBaseStatTotalModifier.apply: once, whatever the stack
        for i, v in enumerate(stats):
            new = math.floor(v + modifier / 2) if i == 0 else math.floor(v + modifier)
            stats[i] = min(max(new, 1), 999999)

    if sweet:
        shuckle(10)
    if foul:
        shuckle(-15)
    if gateau:                                          # PokemonBaseStatFlatModifier: picks from the species' own base stats
        picks = [0 if base[0] < base[5] else 5, 1 if base[1] < base[3] else 3, 2 if base[2] < base[4] else 4]
        for i in picks:
            stats[i] = min(max(math.floor(stats[i] + 20), 1), 999999)
    return stats

if len(sys.argv) > 1 and sys.argv[1] == "base":
    random.seed(77)
    rows = []
    for _ in range(600):
        top = random.choice([20, 60, 255])
        base = [random.randint(1, top) for _ in range(6)]
        if random.random() < 0.3:                       # force ties in the pairs Old Gateau compares
            base[5] = base[0]
            base[3] = base[1]
        sweet, foul, gateau = (random.random() < 0.5 for _ in range(3))
        rows.append([base, sweet, foul, gateau, ref_base(base, sweet, foul, gateau)])
    print("[\n" + ",\n".join(json.dumps(r) for r in rows) + "\n]")
    sys.exit(0)

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
