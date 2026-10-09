import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ui = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ui, path), "utf8");

function filesUnder(dir: string, ext: string): string[] {
  return readdirSync(join(ui, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f));
}

describe("Arena theme", () => {
  // The Tauri app must work offline, so fonts ship with the bundle.
  it("loads its fonts from the bundle, not from a font service", () => {
    const sources = [
      "index.html",
      "src/main.tsx",
      ...filesUnder("src", ".css"),
    ];
    for (const file of sources) {
      expect(read(file), file).not.toMatch(/fonts\.(googleapis|gstatic)/);
    }
    const main = read("src/main.tsx");
    expect(main).toMatch(/@fontsource\/cinzel/);
    expect(main).toMatch(/@fontsource\/inter/);
  });

  it("defines the Arena colours as CSS variables", () => {
    const css = read("src/App.css");
    for (const token of ["--gold", "--ink", "--panel", "--line", "--mine"]) {
      expect(css).toContain(`${token}:`);
    }
  });
});
