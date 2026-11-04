// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fusedSpeciesName } from "../src/fusionName.js";

// A name full of characters that would break or inject markup if it were ever treated as HTML.
const HOSTILE = `<img src=x onerror="alert(1)"> & <script>alert(2)</script> "quoted" 'single'`;

const HOSTILE_PASSIVE = `Passive <b>A</b> & <img src=x>`;
const HOSTILE_ABILITY = `Ability <i>A</i> & <img src=x>`;

const dex = [
  { name: HOSTILE, stats: [100, 90, 80, 70, 60, 50], types: ["Fire", "Flying"], passive: HOSTILE_PASSIVE, abilities: { regular: [HOSTILE_ABILITY], hidden: null }, fusionName: HOSTILE },
  { name: "Safe Mon", stats: [50, 50, 50, 50, 50, 50], types: ["Water"], passive: "Passive B", abilities: { regular: ["Ability B", "Ability C"], hidden: "Hidden B" }, fusionName: "Safe Mon" },
  { name: "Pikachu (Cosplay)", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Pikachu (Cosplay)" },
  { name: "Raichu", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Raichu" },
  { name: "Ditto", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Ditto" },
  { name: "Alolan Marowak", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Alolan Marowak" },
  { name: "Clamperl", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Clamperl" },
];

const $ = (selector: string) => document.querySelector(selector);

beforeAll(async () => {
  // Load the real page structure (without its script tag), serve a fake dex, then start the app.
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../index.html"), "utf8");
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => dex }));

  await import("../src/main.js");
  await vi.waitFor(() => expect($("#result h2")).not.toBeNull());

  // Pick the hostile entry as the primary Pokémon by typing part of its name.
  const primary = $("#primary") as HTMLInputElement;
  primary.dispatchEvent(new Event("focus"));
  primary.value = "img";
  primary.dispatchEvent(new Event("input", { bubbles: true }));
  primary.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

  // And the other entry as the secondary Pokémon.
  const secondary = $("#secondary") as HTMLInputElement;
  secondary.dispatchEvent(new Event("focus"));
  secondary.value = "safe";
  secondary.dispatchEvent(new Event("input", { bubbles: true }));
  secondary.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
});

describe("results card renders names as plain text", () => {
  it("shows the fused name in the heading and the exact parent names under it", () => {
    expect($("#result h2")?.textContent).toBe(fusedSpeciesName(HOSTILE, "Safe Mon"));
    expect($("#result .parents")?.textContent).toBe(`${HOSTILE} + Safe Mon`);
  });

  it("creates no elements from the name", () => {
    expect($("#result h2")?.children.length).toBe(0);
    expect($("#result .parents")?.children.length).toBe(0);
    expect($("#result img, #result script")).toBeNull();
    expect(document.querySelectorAll("img, script")).toHaveLength(0);
  });

  it("keeps the exact name in the marker tooltips", () => {
    expect(($(".tick.p") as HTMLElement).title).toBe(`${HOSTILE}: 100`);
  });

  it("shows the name as text in the dropdown list too", () => {
    const primary = $("#primary") as HTMLInputElement;
    primary.dispatchEvent(new Event("focus"));
    const item = [...document.querySelectorAll("#primary-list li")].find(li => li.textContent === HOSTILE);
    expect(item).toBeDefined();
    expect(item?.children.length).toBe(0);
  });
});

describe("results card content", () => {
  it("shows six stat rows plus a header row", () => {
    expect(document.querySelectorAll("#result .stat")).toHaveLength(7);
  });

  it("shows the primary Pokémon's first type as the first chip", () => {
    expect($("#result .type")?.textContent).toBe("Fire");
  });

  it("shows a total at the chosen level", () => {
    expect($("#result .total")?.textContent).toMatch(/^Total at Lv 50: [\d,]+$/);
  });
});

describe("passive ability", () => {
  const toggle = () => $("#passive-unlocked") as HTMLInputElement;
  const setUnlocked = (value: boolean) => {
    toggle().checked = value;
    toggle().dispatchEvent(new Event("change", { bubbles: true }));
  };
  const passiveText = () => $("#result .passive")?.textContent;

  it("is locked by default and shows nothing", () => {
    expect(toggle().checked).toBe(false);
    expect($("#result .passive")).toBeNull();
  });

  it("shows the primary Pokémon's passive once unlocked, never the secondary's", () => {
    setUnlocked(true);
    expect(passiveText()).toBe(`Passive: ${HOSTILE_PASSIVE}`);
    expect(passiveText()).not.toContain("Passive B");
  });

  it("shows the passive as plain text, never as HTML", () => {
    expect($("#result .passive")?.querySelectorAll("b")).toHaveLength(1); // only the bold "Passive:" label
    expect($("#result .passive img")).toBeNull();
  });

  it("follows the primary Pokémon when the two are swapped", () => {
    ($("#swap") as HTMLButtonElement).click();
    expect(passiveText()).toBe("Passive: Passive B");
    ($("#swap") as HTMLButtonElement).click();
    expect(passiveText()).toBe(`Passive: ${HOSTILE_PASSIVE}`);
  });

  it("disappears again when locked", () => {
    setUnlocked(false);
    expect($("#result .passive")).toBeNull();
  });
});

describe("fused ability (taken from the secondary Pokémon)", () => {
  const select = () => $("#ability") as HTMLSelectElement;
  const options = () => [...select().options].map(o => o.textContent);
  const abilityText = () => $("#result .ability")?.textContent;
  const choose = (value: string) => {
    select().value = value;
    select().dispatchEvent(new Event("change", { bubbles: true }));
  };
  const swap = () => ($("#swap") as HTMLButtonElement).click();

  it("offers the secondary Pokémon's regular and hidden abilities", () => {
    expect(select().disabled).toBe(false);
    expect(options()).toEqual(["Ability B", "Ability C", "Hidden B (Hidden)"]);
  });

  it("starts on the first ability and shows it on the fused Pokémon", () => {
    expect(abilityText()).toBe("Ability: Ability B");
  });

  it("shows whichever ability the user picks, including the hidden one", () => {
    choose("1");
    expect(abilityText()).toBe("Ability: Ability C");
    choose("2");
    expect(abilityText()).toBe("Ability: Hidden B (Hidden)");
  });

  it("keeps the choice when other inputs change", () => {
    const level = $("#level") as HTMLInputElement;
    level.value = "70";
    level.dispatchEvent(new Event("input", { bubbles: true }));
    expect(select().value).toBe("2");
    expect(abilityText()).toBe("Ability: Hidden B (Hidden)");
  });

  it("is shown whether or not the passive is unlocked, and next to it when it is", () => {
    expect($("#result .passive")).toBeNull();
    const toggle = $("#passive-unlocked") as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(abilityText()).toBe("Ability: Hidden B (Hidden)");
    expect($("#result .passive")?.textContent).toBe(`Passive: ${HOSTILE_PASSIVE}`);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
  });

  it("switches to the new secondary Pokémon's abilities when swapped, never the old one's", () => {
    swap();
    expect(options()).toEqual([HOSTILE_ABILITY]);
    expect(abilityText()).toBe(`Ability: ${HOSTILE_ABILITY}`);
    expect(abilityText()).not.toContain("Ability B");
  });

  it("shows ability names as plain text, never as HTML", () => {
    expect($("#result .ability")?.querySelectorAll("b")).toHaveLength(1); // only the bold "Ability:" label
    expect($("#result .ability i, #result .ability img")).toBeNull();
    expect(select().querySelector("option i, option img")).toBeNull();
  });

  it("resets to the first ability after swapping back", () => {
    swap();
    expect(options()).toEqual(["Ability B", "Ability C", "Hidden B (Hidden)"]);
    expect(select().value).toBe("0");
    expect(abilityText()).toBe("Ability: Ability B");
  });
});

describe("fused name", () => {
  const headline = () => $("#result h2")?.textContent;
  const swap = () => ($("#swap") as HTMLButtonElement).click();

  it("is built from the primary Pokémon's name first, then the secondary's", () => {
    expect(headline()).toBe(fusedSpeciesName(HOSTILE, "Safe Mon"));
  });

  it("changes order when the two are swapped", () => {
    swap();
    expect(headline()).toBe(fusedSpeciesName("Safe Mon", HOSTILE));
    expect($("#result .parents")?.textContent).toBe(`Safe Mon + ${HOSTILE}`);
    swap();
    expect(headline()).toBe(fusedSpeciesName(HOSTILE, "Safe Mon"));
  });

  it("is plain text, never HTML", () => {
    expect($("#result h2 img, #result h2 script")).toBeNull();
  });
});

describe("held items (inputs only for now)", () => {
  const input = (id: string) => $(`#${id}`) as HTMLInputElement;
  const ids = ["soul-dew", "macho-brace", "vitamin0", "vitamin1", "vitamin2", "vitamin3", "vitamin4", "vitamin5"];
  const maxes = [10, 50, 31, 31, 31, 31, 31, 31];
  const change = (id: string, value: string) => {
    input(id).value = value;
    input(id).dispatchEvent(new Event("input", { bubbles: true }));
    input(id).dispatchEvent(new Event("change", { bubbles: true }));
  };

  it("has a Soul Dew box, a Macho Brace box and six vitamin boxes, all starting at 0", () => {
    expect($(".itemrow fieldset legend")?.textContent).toBe("Held items of the primary Pokémon");
    expect(document.querySelectorAll(".itemrow input[type=number], .itemrow input[inputmode]")).toHaveLength(8);
    for (const id of ids) expect(input(id).value, id).toBe("0");
  });

  it("limits each box to the game's stack limit", () => {
    ids.forEach((id, i) => expect(input(id).max, id).toBe(String(maxes[i])));
  });

  it("labels the vitamins in stat order: HP Up, Protein, Iron, Calcium, Zinc, Carbos", () => {
    const labels = [0, 1, 2, 3, 4, 5].map(i => input(`vitamin${i}`).closest("label")?.textContent);
    expect(labels).toEqual(["HP Up", "Protein", "Iron", "Calcium", "Zinc", "Carbos"]);
  });

  it("says plainly that they do not change the results yet", () => {
    expect($(".itemrow .hint")?.textContent).toContain("do not change the results yet");
  });

  it("pulls too-large, negative, empty and fractional entries back into range", () => {
    change("soul-dew", "99");
    expect(input("soul-dew").value).toBe("10");
    change("macho-brace", "75");
    expect(input("macho-brace").value).toBe("50");
    change("vitamin3", "40");
    expect(input("vitamin3").value).toBe("31");
    change("vitamin0", "-5");
    expect(input("vitamin0").value).toBe("0");
    change("vitamin1", "");
    expect(input("vitamin1").value).toBe("0");
    change("vitamin2", "7.9");
    expect(input("vitamin2").value).toBe("7");
  });

  it("accepts digits but blocks letters and symbols as they are typed", () => {
    const press = (key: string) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      input("soul-dew").dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press("5")).toBe(false);
    for (const key of ["e", "-", "+", "."]) expect(press(key), key).toBe(true);
  });

  it("leaves the results card exactly as it was, whatever is entered", () => {
    const before = $("#result")?.textContent;
    for (const [i, id] of ids.entries()) change(id, String(maxes[i]));
    expect($("#result")?.textContent).toBe(before);
    for (const id of ids) change(id, "0");
    expect($("#result")?.textContent).toBe(before);
  });
});

describe("Eviolite and species items (inputs only for now)", () => {
  const box = (id: string) => $(`#${id}`) as HTMLInputElement;
  const pick = (selector: string, text: string) => {
    const input = $(selector) as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  };
  const visibleSpecies = () =>
    [...document.querySelectorAll<HTMLLabelElement>("#species-items label")].filter(l => !l.hidden).map(l => l.querySelector("b")?.textContent);
  const section = () => $("#species-items") as HTMLElement;
  const tick = (id: string, on = true) => {
    box(id).checked = on;
    box(id).dispatchEvent(new Event("change", { bubbles: true }));
  };

  it("always shows Eviolite, unticked, with its Gigantamax note", () => {
    expect(box("eviolite").type).toBe("checkbox");
    expect(box("eviolite").checked).toBe(false);
    expect(box("eviolite").closest("label")?.textContent).toContain("No effect on Gigantamaxed Pokémon");
  });

  it("shows no species items, and no heading for them, when neither picked Pokémon can use one", () => {
    expect(section().hidden).toBe(true);
    expect(visibleSpecies()).toEqual([]);
  });

  it("offers Light Ball for a Pikachu form picked as the primary Pokémon", () => {
    pick("#primary", "pikachu (cosplay)");
    expect(section().hidden).toBe(false);
    expect(visibleSpecies()).toEqual(["Light Ball"]);
  });

  it("offers it when the Pikachu is the secondary Pokémon instead, as the game does", () => {
    pick("#primary", "img");
    pick("#secondary", "pikachu");
    expect(visibleSpecies()).toEqual(["Light Ball"]);
  });

  it("offers each item only for its own species", () => {
    pick("#secondary", "ditto");
    expect(visibleSpecies()).toEqual(["Metal Powder", "Quick Powder"]);
    pick("#secondary", "clamperl");
    expect(visibleSpecies()).toEqual(["Deep Sea Tooth", "Deep Sea Scale"]);
    pick("#secondary", "alolan marowak");
    expect(visibleSpecies()).toEqual(["Thick Club"]);
    pick("#secondary", "raichu");
    expect(visibleSpecies()).toEqual([]);
    expect(section().hidden).toBe(true);
  });

  it("combines the items of both Pokémon", () => {
    pick("#primary", "pikachu");
    pick("#secondary", "ditto");
    expect(visibleSpecies()).toEqual(["Light Ball", "Metal Powder", "Quick Powder"]);
  });

  it("keeps a ticked item while the Pokémon that unlocks it stays picked, even if the two are swapped", () => {
    tick("item-light-ball");
    ($("#swap") as HTMLButtonElement).click();
    expect(visibleSpecies()).toContain("Light Ball");
    expect(box("item-light-ball").checked).toBe(true);
    ($("#swap") as HTMLButtonElement).click();
    expect(box("item-light-ball").checked).toBe(true);
  });

  it("hides and unticks an item once no picked Pokémon can use it, and it stays unticked afterwards", () => {
    pick("#primary", "img");
    expect(visibleSpecies()).toEqual(["Metal Powder", "Quick Powder"]);
    expect(box("item-light-ball").checked).toBe(false);
    pick("#primary", "pikachu");
    expect(box("item-light-ball").checked).toBe(false);
  });

  it("does not touch Eviolite when the Pokémon change", () => {
    tick("eviolite");
    pick("#primary", "img");
    pick("#secondary", "safe");
    expect(box("eviolite").checked).toBe(true);
  });

  it("leaves the results card exactly as it was, whatever is ticked", () => {
    pick("#primary", "pikachu");
    pick("#secondary", "ditto");
    const before = $("#result")?.textContent;
    for (const id of ["eviolite", "item-light-ball", "item-metal-powder", "item-quick-powder"]) tick(id);
    expect($("#result")?.textContent).toBe(before);
    for (const id of ["eviolite", "item-light-ball", "item-metal-powder", "item-quick-powder"]) tick(id, false);
    expect($("#result")?.textContent).toBe(before);
    pick("#primary", "img");
    pick("#secondary", "safe");
  });
});
