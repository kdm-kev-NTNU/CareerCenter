import { expect, test } from "@playwright/test";

test("user creates courses and saves a custom path", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Master Plan" }).click();
  await page.getByLabel("Fagkode").fill("TDT4173");
  await page.getByLabel("Tittel").fill("Machine Learning");
  await page.getByLabel("Notater").fill("Relevant for forecasting og quant.");
  await page.getByRole("button", { name: "Legg til fag" }).click();
  await expect(page.getByText("TDT4173 · Machine Learning")).toBeVisible();

  await page.getByRole("button", { name: "Custom Paths" }).click();
  await page.getByPlaceholder("Søk etter selskap, rolle eller geografi").fill("Statkraft");
  await page.getByRole("button", { name: "Legg til" }).first().click();
  await page.getByPlaceholder("Søk etter selskap, rolle eller geografi").fill("InCommodities");
  await page.getByRole("button", { name: "Legg til" }).first().click();
  await page.getByRole("button", { name: "Lagre custom path" }).click();
  await expect(page.getByText("NTNU KI").last()).toBeVisible();
  await expect(page.getByText("Statkraft").last()).toBeVisible();
  await expect(page.getByText("InCommodities").last()).toBeVisible();
});
