import { expect, test } from "@playwright/test";

// You pass every turn until the AI wins; the end dialog then offers a rematch.
test("play to the end, then rematch", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?seed=7");
  for (const name of ["Your deck", "Opponent's deck"])
    await page
      .getByRole("radiogroup", { name })
      .getByRole("radio", { name: "Vanilla test deck (15)" })
      .check();
  await page.getByRole("button", { name: "Start duel" }).click();
  await expect(page.getByRole("region", { name: "Your field" })).toBeVisible({
    timeout: 30_000,
  });

  const over = page.getByRole("dialog", { name: "Duel over" });
  const endTurn = page.getByRole("button", { name: "End Turn" });
  const pick = page.locator(".pick").first();
  for (let guard = 0; guard < 100; guard++) {
    await over.or(endTurn).or(pick).first().waitFor();
    if (await over.isVisible()) break;
    if (await endTurn.isVisible()) {
      await endTurn.click();
    } else {
      // Hand size limit: discard the first card.
      await pick.click();
      await page.getByRole("button", { name: "Confirm" }).click();
    }
  }

  await expect(over.getByRole("heading")).toHaveText(/You (win|lose)|Draw/);
  await page.screenshot({
    path: "tests/e2e/artifacts/duel-end.png",
    fullPage: true,
  });

  await over.getByRole("button", { name: "Rematch" }).click();
  await expect(page.getByText(/Turn 1\b/)).toBeVisible({ timeout: 30_000 });
  await expect(over).toBeHidden();
});
