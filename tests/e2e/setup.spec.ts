import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const DECKS = join(import.meta.dirname, "..", "..", "data", "decks");
const mainSize = (file: string) => {
  const text = readFileSync(join(DECKS, file), "utf8");
  return text
    .split("#extra")[0]
    .split("\n")
    .filter((l) => /^\d+$/.test(l.trim())).length;
};

// M4 acceptance: the setup choices decide who goes first and which decks play.
test("go second with a tournament preset against the test deck", async ({
  page,
}) => {
  await page.goto("/?seed=3");
  await page.getByLabel("I go second").check();
  await page
    .getByRole("radiogroup", { name: "Your deck" })
    .getByRole("radio", {
      name: `Elfnote (${mainSize("presets/elfnote.ydk")})`,
    })
    .check();
  await page
    .getByRole("radiogroup", { name: "Opponent's deck" })
    .getByRole("radio", { name: "Vanilla test deck (15)" })
    .check();
  await page.screenshot({
    path: "tests/e2e/artifacts/setup.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start duel" }).click();

  const mine = page.getByRole("region", { name: "Your field" });
  const theirs = page.getByRole("region", { name: "Opponent's field" });
  await expect(mine).toBeVisible({ timeout: 30_000 });
  // Handtraps in your hand open chain windows on the opponent's turn: pass them.
  const yourTurn = page.getByText(/^Turn 2 · Your /);
  const pass = page.getByRole("button", { name: "Don't chain" });
  for (let i = 0; i < 20 && !(await yourTurn.isVisible()); i++) {
    if (await pass.isVisible()) await pass.click();
    else await page.waitForTimeout(100);
  }
  // The opponent went first (no draw), then you drew for turn 2.
  await expect(yourTurn).toBeVisible();
  await expect(theirs.getByText("Deck 10")).toBeVisible();
  await expect(
    mine.getByText(`Deck ${mainSize("presets/elfnote.ydk") - 6}`),
  ).toBeVisible();
  await page.screenshot({
    path: "tests/e2e/artifacts/setup-duel.png",
    fullPage: true,
  });
});

test("import a .ydk file and play with it", async ({ page }) => {
  await page.goto("/?seed=3");
  const ydk = readFileSync(join(DECKS, "m1-vanilla.ydk"), "utf8").replace(
    "#name Vanilla test deck",
    "#name My import",
  );
  await page.getByLabel("Import a .ydk file").setInputFiles({
    name: "mine.ydk",
    mimeType: "text/plain",
    buffer: Buffer.from(ydk),
  });
  await expect(
    page
      .getByRole("radiogroup", { name: "Your deck" })
      .getByRole("radio", { name: "My import (15)" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Start duel" }).click();
  await expect(
    page.getByRole("region", { name: "Your field" }).getByText("Deck 10"),
  ).toBeVisible({ timeout: 30_000 });
});
