// Real engine + real card data, driven by clicks: the M3 acceptance flow without a browser.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { passiveResponse } from "@ygo/ai";
import { loadCatalog } from "@ygo/cards/node";
import { DuelSession, parseStringsConf } from "@ygo/engine";
import { createNodeEngine, loadYdk } from "@ygo/engine/node";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ImageSource } from "../cards/CardImage";
import { DuelScreen } from "./DuelScreen";
import { textSource } from "./loadDuel";

const DATA = join(__dirname, "..", "..", "..", "..", "data");
const catalog = loadCatalog({
  cdb: join(DATA, "cdb", "cards.cdb"),
  localeDir: join(DATA, "missing"),
});
const texts = textSource(
  catalog,
  parseStringsConf(readFileSync(join(DATA, "strings.conf"), "utf8")),
);
const deck = loadYdk(join(DATA, "decks", "m1-vanilla.ydk"));

/** Same cards with a fake French table, so the screen has a language to switch to. */
function frenchCatalog() {
  const dir = mkdtempSync(join(tmpdir(), "ygo-fr-"));
  const fr = Object.fromEntries(
    deck.main.map((code) => [
      code,
      { name: `FR ${catalog.get(code)!.name}`, desc: "Texte en français." },
    ]),
  );
  writeFileSync(join(dir, "fr.json"), JSON.stringify(fr));
  return loadCatalog({ cdb: join(DATA, "cdb", "cards.cdb"), localeDir: dir });
}

async function setup(cards = catalog, images?: ImageSource) {
  const engine = await createNodeEngine({ dataDir: DATA });
  const duel = engine.startDuel({
    seed: [1n, 2n, 3n, 4n],
    decks: [deck, deck],
  });
  const session = new DuelSession(duel, {
    human: 0,
    opponent: passiveResponse,
    texts,
  });
  render(
    <DuelScreen
      session={session}
      catalog={cards}
      texts={texts}
      images={images}
    />,
  );
  return session;
}

describe("DuelScreen", () => {
  it("Normal Summons a monster by clicking it in hand, then its action", async () => {
    const session = await setup();
    const mine = screen.getByRole("region", { name: "Your field" });
    const idle = session.prompt as {
      summons: { code: number; sequence: number }[];
    };
    const target = catalog.get(idle.summons[0].code)!.name;

    fireEvent.click(
      within(mine).getAllByRole("button", { name: `${target}, hand` })[0],
    );
    fireEvent.click(
      screen.getByRole("button", { name: `Normal Summon ${target}` }),
    );
    const zone = screen.queryByRole("button", { name: "Your Monster Zone 1" });
    if (zone) fireEvent.click(zone);

    expect(
      within(mine).getByRole("button", {
        name: new RegExp(`^${target}, Monster Zone \\d, ATK`),
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("log")).getByText(`You Normal Summon ${target}`),
    ).toBeInTheDocument();
  });

  it("shows card text when you hover a card", async () => {
    await setup();
    const mine = screen.getByRole("region", { name: "Your field" });
    const first = within(mine).getAllByRole("button", { name: /, hand$/ })[0];
    fireEvent.mouseEnter(first);
    const name = first.getAttribute("aria-label")!.replace(/, hand$/, "");
    expect(
      within(
        screen.getByRole("complementary", { name: "Card details" }),
      ).getByRole("heading", { name }),
    ).toBeInTheDocument();
  });

  it("ends your turn and comes back after the opponent passes", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(screen.getByText(/Turn 3/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("log")).getByText("Opponent's turn"),
    ).toBeInTheDocument();
  });

  it("switches card names and text to French, but not the log", async () => {
    await setup(frenchCatalog());
    fireEvent.change(
      screen.getByRole("combobox", { name: "Card text language" }),
      { target: { value: "fr" } },
    );
    const mine = screen.getByRole("region", { name: "Your field" });
    const first = within(mine).getAllByRole("button", { name: /, hand$/ })[0];
    expect(first.getAttribute("aria-label")).toMatch(/^FR /);
    fireEvent.mouseEnter(first);
    const details = screen.getByRole("complementary", { name: "Card details" });
    expect(within(details).getByText("Texte en français.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("log")).queryByText(/FR /),
    ).not.toBeInTheDocument();
  });

  it("shows the hovered card's art next to its text", async () => {
    const images = { get: vi.fn(async () => new Uint8Array([1])) };
    URL.createObjectURL = vi.fn(() => "blob:art");
    URL.revokeObjectURL = vi.fn();
    await setup(catalog, images);
    const mine = screen.getByRole("region", { name: "Your field" });
    const first = within(mine).getAllByRole("button", { name: /, hand$/ })[0];
    fireEvent.mouseEnter(first);
    const name = first.getAttribute("aria-label")!.replace(/, hand$/, "");
    expect(
      await within(
        screen.getByRole("complementary", { name: "Card details" }),
      ).findByRole("img", { name }),
    ).toHaveAttribute("src", "blob:art");
  });
});
