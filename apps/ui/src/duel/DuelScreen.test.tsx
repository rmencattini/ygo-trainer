// Real engine + real card data, driven by clicks: the M3 acceptance flow without a browser.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { passiveResponse } from "@ygo/ai";
import { loadCatalog } from "@ygo/cards/node";
import { DuelSession, parseStringsConf } from "@ygo/engine";
import { createNodeEngine, loadYdk } from "@ygo/engine/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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

async function setup() {
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
  render(<DuelScreen session={session} catalog={catalog} texts={texts} />);
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
});
