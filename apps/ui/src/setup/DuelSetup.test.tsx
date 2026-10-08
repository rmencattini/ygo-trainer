import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DeckEntry } from "./deckLibrary";
import { DuelSetup } from "./DuelSetup";

const full = (code: number) => Array.from({ length: 40 }, () => code);
const library: DeckEntry[] = [
  {
    id: "presets/a.ydk",
    name: "Alpha",
    kind: "preset",
    deck: { main: full(1), extra: [], side: [] },
  },
  {
    id: "presets/b.ydk",
    name: "Beta",
    kind: "preset",
    deck: { main: full(2), extra: [], side: [] },
  },
  {
    id: "test.ydk",
    name: "Test",
    kind: "test",
    deck: { main: [3], extra: [], side: [] },
  },
];
const known = (code: number) => code < 100;

function setup(importer = vi.fn()) {
  const onStart = vi.fn();
  render(
    <DuelSetup
      library={library}
      known={known}
      onStart={onStart}
      importer={importer}
      storage={null}
    />,
  );
  return { onStart, importer };
}

describe("DuelSetup", () => {
  it("starts with you going first and the first preset on both sides", () => {
    const { onStart } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Start duel" }));
    expect(onStart).toHaveBeenCalledWith({
      goFirst: true,
      mine: library[0],
      theirs: library[0],
    });
  });

  it("lets you go second and pick both decks", () => {
    const { onStart } = setup();
    fireEvent.click(screen.getByLabelText("I go second"));
    fireEvent.change(screen.getByLabelText("Your deck"), {
      target: { value: "presets/b.ydk" },
    });
    fireEvent.change(screen.getByLabelText("Opponent's deck"), {
      target: { value: "test.ydk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start duel" }));
    expect(onStart).toHaveBeenCalledWith({
      goFirst: false,
      mine: library[1],
      theirs: library[2],
    });
  });

  it("warns about decks with problems but still lets you start", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Opponent's deck"), {
      target: { value: "test.ydk" },
    });
    expect(
      screen.getByText("Main Deck has 1 cards (needs 40 to 60)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start duel" })).toBeEnabled();
  });

  it("imports a .ydk file and selects it as your deck", async () => {
    const importer = vi.fn(async () => ({
      name: "Mine",
      deck: { main: full(4), extra: [], side: [] },
    }));
    const { onStart } = setup(importer);
    const file = new File(["#main\n4\n"], "mine.ydk");
    fireEvent.change(screen.getByLabelText("Import a .ydk file"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Your deck") as HTMLSelectElement).value,
      ).toMatch(/^imported:/),
    );
    expect(importer).toHaveBeenCalledWith("#main\n4\n", "mine.ydk");
    fireEvent.click(screen.getByRole("button", { name: "Start duel" }));
    expect(onStart.mock.calls[0][0].mine).toMatchObject({
      name: "Mine",
      kind: "imported",
    });
  });

  it("imports a deck link and shows import errors", async () => {
    const importer = vi.fn(async () => {
      throw new Error("No deck list found on that page");
    });
    setup(importer);
    fireEvent.change(screen.getByLabelText("Deck link"), {
      target: { value: "https://ygoprodeck.com/deck/x-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No deck list found on that page",
    );
    expect(importer).toHaveBeenCalledWith("https://ygoprodeck.com/deck/x-1");
  });
});
