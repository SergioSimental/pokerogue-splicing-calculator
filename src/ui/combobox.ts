export interface Choice {
  label: string;
  /** Lowercase, accent-free text that typing is matched against. */
  text: string;
}

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * A single text box that works as both filter and selector: click it to see the full list,
 * type to narrow the list, then click an item or press Enter to choose it.
 */
export class Combobox {
  private choices: Choice[] = [];
  private selected = -1;
  private matches: number[] = [];
  private active = -1; // position inside `matches`
  private query = "";

  constructor(
    private readonly input: HTMLInputElement,
    private readonly list: HTMLUListElement,
    private readonly onChange: () => void,
  ) {
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");
    list.setAttribute("role", "listbox");
    list.hidden = true;

    input.addEventListener("focus", () => { this.open(); input.select(); });
    input.addEventListener("click", () => { if (list.hidden) { this.open(); input.select(); } });
    input.addEventListener("input", () => { this.query = input.value; this.refresh(); });
    input.addEventListener("keydown", e => this.onKey(e));
    input.addEventListener("blur", () => this.close());
    // Keep focus in the text box while the list is clicked.
    list.addEventListener("mousedown", e => e.preventDefault());
    list.addEventListener("click", e => {
      const item = (e.target as HTMLElement).closest<HTMLElement>("li[data-index]");
      if (item) this.choose(Number(item.dataset.index));
    });
  }

  /** Index of the chosen entry in the choices array, or -1 when nothing is loaded yet. */
  get index(): number {
    return this.selected;
  }

  setChoices(choices: Choice[], index = 0): void {
    this.choices = choices;
    this.input.disabled = false;
    this.input.placeholder = "Type to search";
    this.setIndex(index);
  }

  setIndex(index: number): void {
    this.selected = this.choices[index] ? index : -1;
    this.input.value = this.choices[this.selected]?.label ?? "";
  }

  private open(): void {
    this.query = "";
    this.refresh();
    this.list.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.setActive(this.active);
  }

  private close(): void {
    this.list.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this.input.value = this.choices[this.selected]?.label ?? "";
  }

  private choose(index: number): void {
    this.selected = index;
    this.close();
    this.onChange();
  }

  private refresh(): void {
    const q = normalize(this.query.trim());
    this.matches = [];
    this.choices.forEach((c, i) => { if (c.text.includes(q)) this.matches.push(i); });
    const items = this.matches.map(i => {
      const item = document.createElement("li");
      item.id = `${this.list.id}-opt-${i}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(i === this.selected));
      item.dataset.index = String(i);
      item.textContent = this.choices[i]?.label ?? "";
      return item;
    });
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.setAttribute("role", "presentation");
      empty.textContent = "No matches";
      items.push(empty);
    }
    this.list.replaceChildren(...items);
    // With no typing, start on the current choice (like a normal dropdown); otherwise the best match.
    this.active = this.matches.length === 0 ? -1 : q === "" ? Math.max(0, this.matches.indexOf(this.selected)) : 0;
    if (!this.list.hidden) this.setActive(this.active);
  }

  private setActive(position: number): void {
    this.list.querySelector(".active")?.classList.remove("active");
    this.active = position;
    const item = this.list.children[position] as HTMLElement | undefined;
    if (!item || position < 0 || !item.dataset.index) {
      this.input.removeAttribute("aria-activedescendant");
      return;
    }
    item.classList.add("active");
    this.input.setAttribute("aria-activedescendant", item.id);
    item.scrollIntoView?.({ block: "nearest" });
  }

  private onKey(e: KeyboardEvent): void {
    const isOpen = !this.list.hidden;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!isOpen) { this.open(); return; }
        if (this.matches.length === 0) return;
        const step = e.key === "ArrowDown" ? 1 : -1;
        this.setActive(Math.min(this.matches.length - 1, Math.max(0, this.active + step)));
        return;
      }
      case "Enter": {
        const choice = this.matches[this.active];
        if (isOpen && choice !== undefined) {
          e.preventDefault();
          this.choose(choice);
        }
        return;
      }
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          this.close();
        }
        return;
    }
  }
}
