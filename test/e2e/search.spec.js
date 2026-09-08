const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-title")).toBeVisible();
});

test("初期表示は検索タブで、全件のカードが並ぶ", async ({ page }) => {
  await expect(page.locator('.tabbar__btn[data-tab="search"]')).toHaveClass(/is-active/);
  const count = await page.locator("#search-results .card").count();
  expect(count).toBeGreaterThan(100);
});

test("キーワード『配食』で配食サービスに絞り込める", async ({ page }) => {
  await page.fill("#search-input", "配食");
  await expect(page.locator("#search-results .card__title")).toHaveText([
    "障害者自立支援配食サービス",
  ]);
});

test("『本文も検索』オフでは概要だけの語はヒットせず、オンでヒットする", async ({ page }) => {
  await page.fill("#search-input", "安否確認");
  await expect(page.locator("#search-results .card")).toHaveCount(0);
  await page.check("#search-in-body");
  await expect(page.locator("#search-results .card__title")).toHaveText([
    "障害者自立支援配食サービス",
  ]);
});

test("種別チップ『相談窓口』で相談窓口だけになる", async ({ page }) => {
  await page.click('.type-chip[data-type="相談窓口"]');
  const badges = page.locator("#search-results .card .badge--相談窓口");
  const cards = page.locator("#search-results .card");
  expect(await badges.count()).toBe(await cards.count());
  await expect(page.locator("#search-results .badge--制度・手帳")).toHaveCount(0);
});

test("手帳種別で絞ると件数が減り、『それ以外』で手帳非依存の項目に切り替わる", async ({ page }) => {
  const total = await page.locator("#search-results .card").count();

  await page.selectOption("#grade-techo-select", "seishin");
  const seishinCount = await page.locator("#search-results .card").count();
  expect(seishinCount).toBeGreaterThan(0);
  expect(seishinCount).toBeLessThan(total);

  await page.selectOption("#grade-techo-select", "other");
  await expect(page.locator(".grade-filter-note")).toContainText("どの手帳");
  await expect(page.locator("#grade-level-select")).toBeDisabled();
  const otherCount = await page.locator("#search-results .card").count();
  expect(otherCount).toBeGreaterThan(0);
  expect(otherCount).toBeLessThan(total);

  await page.click("#grade-clear");
  expect(await page.locator("#search-results .card").count()).toBe(total);
});

test("カードの詳細を開くと窓口情報が表示され、開いた場所にとどまる", async ({ page }) => {
  await page.fill("#search-input", "配食");
  const card = page.locator("#search-results .card").first();
  const head = card.locator(".card__head");
  await head.scrollIntoViewIfNeeded();
  const beforeY = await head.evaluate((el) => el.getBoundingClientRect().top);
  await head.click();
  await expect(card.locator(".card__detail")).toBeVisible();
  const afterY = await page
    .locator("#search-results .card")
    .first()
    .locator(".card__head")
    .evaluate((el) => el.getBoundingClientRect().top);
  // 展開してもクリックした項目の位置が保たれる(最下部などに飛ばない)
  expect(Math.abs(afterY - beforeY)).toBeLessThan(20);
});
