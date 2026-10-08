import { expect, test } from "@playwright/test";

// M3 acceptance: start a duel and Normal Summon by clicking the card in hand, then its action.
test("Normal Summon a monster by clicks", async ({ page }) => {
  await page.goto("/?seed=7");
  await page
    .getByLabel("Your deck")
    .selectOption({ label: "Vanilla test deck (15)" });
  await page
    .getByLabel("Opponent's deck")
    .selectOption({ label: "Vanilla test deck (15)" });
  await page.getByRole("button", { name: "Start duel" }).click();
  const mine = page.getByRole("region", { name: "Your field" });
  await expect(mine).toBeVisible({ timeout: 30_000 });
  await page.screenshot({
    path: "tests/e2e/artifacts/duel-start.png",
    fullPage: true,
  });

  const action = page.getByRole("button", { name: /^Normal Summon / }).first();
  const name = (await action.textContent())!.replace(/^Normal Summon /, "");
  await mine
    .getByRole("button", { name: `${name}, hand` })
    .first()
    .click();
  await page.getByRole("button", { name: `Normal Summon ${name}` }).click();
  const zone = page.getByRole("button", { name: "Your Monster Zone 1" });
  if (await zone.isVisible()) await zone.click();

  await expect(
    mine.getByRole("button", {
      name: new RegExp(`^${name}, Monster Zone \\d, ATK`),
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("log").getByText(`You Normal Summon ${name}`),
  ).toBeVisible();
  await page.screenshot({
    path: "tests/e2e/artifacts/duel-normal-summon.png",
    fullPage: true,
  });
});
