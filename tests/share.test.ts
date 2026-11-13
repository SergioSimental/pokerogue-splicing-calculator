import { describe, expect, it } from "vitest";
import { decodeItems, decodeSetup, emptyItems, encodeItems, encodeSetup, type Setup } from "../src/share.js";

const items = (over: Partial<ReturnType<typeof emptyItems>> = {}) => ({ ...emptyItems(), ...over });

const setup: Setup = {
  primary: "Garchomp",
  secondary: "Charizard (Mega X)",
  level: 87,
  nature: "Jolly",
  ivs: [31, 25, 0, 31, 12, 31],
  ability: "Solar Power (Hidden)",
  passive: true,
  primaryItems: items({ soulDew: 3, vitamins: [0, 5, 0, 0, 0, 20], sweetJuice: true, species: ["thick-club"] }),
  secondaryItems: items({ machoBrace: 50, foulJuice: true, oldGateau: true, eviolite: true }),
};

describe("encodeItems and decodeItems", () => {
  it("writes nothing for an empty set", () => {
    expect(encodeItems(emptyItems())).toBe("");
    expect(decodeItems("")).toEqual(emptyItems());
  });

  it("writes only what is held, in a fixed order", () => {
    expect(encodeItems(setup.primaryItems)).toBe("sd3,v1-5,v5-20,sweet,thick-club");
    expect(encodeItems(setup.secondaryItems)).toBe("mb50,foul,gateau,eviolite");
  });

  it("reads back exactly what was written", () => {
    for (const held of [setup.primaryItems, setup.secondaryItems, items({ species: ["light-ball", "deep-sea-tooth"] })]) {
      expect(decodeItems(encodeItems(held))).toEqual(held);
    }
  });

  it("writes a single vitamin and a single Soul Dew", () => {
    expect(encodeItems(items({ soulDew: 1, machoBrace: 1, vitamins: [1, 0, 0, 0, 0, 1] }))).toBe("sd1,mb1,v0-1,v5-1");
    expect(decodeItems("sd1,mb1,v0-1,v5-1")).toEqual(items({ soulDew: 1, machoBrace: 1, vitamins: [1, 0, 0, 0, 0, 1] }));
  });

  it("holds every count to the game's limit", () => {
    expect(decodeItems("sd99,mb999,v0-99,v3-40")).toEqual(items({ soulDew: 10, machoBrace: 50, vitamins: [31, 0, 0, 31, 0, 0] }));
  });

  it("skips tokens it does not know and keeps the rest", () => {
    expect(decodeItems("sd2,nonsense,v6-5,v9-5,v1-,sd,mb-4,sd2x,thick-club,thick-club,<b>")).toEqual(items({ soulDew: 2, species: ["thick-club"] }));
  });
});

describe("encodeSetup and decodeSetup", () => {
  it("round-trips a full build", () => {
    expect(decodeSetup(encodeSetup(setup))).toEqual(setup);
  });

  it("round-trips a build with nothing optional", () => {
    const plain: Setup = { ...setup, ability: "", passive: false, primaryItems: emptyItems(), secondaryItems: emptyItems() };
    const query = encodeSetup(plain);
    expect(query).toBe("p=Garchomp&s=Charizard%20(Mega%20X)&l=87&n=Jolly&iv=31,25,0,31,12,31");
    const { ability: _ability, ...rest } = plain; // an empty ability is simply left out of the link
    expect(decodeSetup(query)).toEqual(rest);
  });

  it("keeps names with spaces, brackets, ampersands and non-ASCII characters intact", () => {
    for (const name of ["Mr. Mime", "Farfetch'd", "Flabébé", "A&B=C?D#E %20 +", `<img src=x onerror="alert(1)">`]) {
      const back = decodeSetup(encodeSetup({ ...setup, primary: name, secondary: name, ability: name }));
      expect(back.primary).toBe(name);
      expect(back.secondary).toBe(name);
      expect(back.ability).toBe(name);
    }
  });

  it("is safe to put after a question mark and has no characters that end a link", () => {
    const query = encodeSetup({ ...setup, primary: "A&B=C?D#E" });
    expect(query).not.toMatch(/[#\s<>"]/);
    expect(query.split("&").length).toBe(9);
  });

  it("accepts a leading question mark", () => {
    expect(decodeSetup(`?${encodeSetup(setup)}`)).toEqual(setup);
  });

  it("holds level and IVs to their ranges", () => {
    expect(decodeSetup("l=0&iv=99,31,0,31,31,31")).toMatchObject({ level: 1, ivs: [31, 31, 0, 31, 31, 31] });
    expect(decodeSetup("l=99999999999999999999").level).toBeUndefined();
  });

  it("drops anything malformed instead of throwing", () => {
    const damaged = decodeSetup("p=&l=abc&iv=1,2,3&n=&ab=&pp=yes&pi=%E0%A4%A&junk=1&l=-5");
    expect(damaged.primary).toBeUndefined();
    expect(damaged.level).toBeUndefined();
    expect(damaged.ivs).toBeUndefined();
    expect(damaged.nature).toBeUndefined();
    expect(damaged.ability).toBeUndefined();
    expect(damaged.passive).toBe(false);
    expect(decodeSetup("")).toEqual({ passive: false, primaryItems: emptyItems(), secondaryItems: emptyItems() });
  });

  it("cuts very long names", () => {
    expect(decodeSetup(`p=${"x".repeat(500)}`).primary?.length).toBe(80);
  });

  it("does not depend on the order of the parts", () => {
    const shuffled = encodeSetup(setup).split("&").reverse().join("&");
    expect(decodeSetup(shuffled)).toEqual(setup);
  });

  it("changes when any single setting changes", () => {
    const base = encodeSetup(setup);
    const variants: Setup[] = [
      { ...setup, primary: "Other" }, { ...setup, secondary: "Other" }, { ...setup, level: 88 }, { ...setup, nature: "Timid" },
      { ...setup, ivs: [30, 25, 0, 31, 12, 31] }, { ...setup, ability: "" }, { ...setup, passive: false },
      { ...setup, primaryItems: items() }, { ...setup, secondaryItems: items() },
    ];
    for (const v of variants) expect(encodeSetup(v)).not.toBe(base);
  });
});
