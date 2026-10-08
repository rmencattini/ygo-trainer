import { expect, test } from "@playwright/test";

test("app opens on the title screen", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "YGO Trainer" }),
  ).toBeVisible();
  await page.screenshot({ path: "tests/e2e/artifacts/smoke.png" });
});
