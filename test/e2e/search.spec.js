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

test("よみがな『ほそうぐ』で『補装具費の支給』がヒットする", async ({ page }) => {
  await page.fill("#search-input", "ほそうぐ");
  await expect(
    page.locator("#search-results .card__title", { hasText: "補装具費の支給" })
  ).toBeVisible();
});

test("検索すると『◯件を表示しました』のフィードバックが出る", async ({ page }) => {
  await expect(page.locator("#search-count")).toContainText("全");
  await page.fill("#search-input", "配食");
  await expect(page.locator("#search-count")).toContainText("「配食」の検索結果：1件を表示しました");
  await page.fill("#search-input", "");
  await expect(page.locator("#search-count")).toContainText("件を表示しています");
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

test("『目的・場面で絞り込む』で福祉サービスをさらに絞れる", async ({ page }) => {
  await page.click('#type-chip-row [data-type="福祉サービス"]');
  const fukushi = await page.locator("#search-results .card").count();

  await page.selectOption("#purpose-select", "在宅での生活支援");
  const narrowed = await page.locator("#search-results .card").count();
  expect(narrowed).toBeGreaterThan(0);
  expect(narrowed).toBeLessThan(fukushi);

  await page.click("#purpose-clear");
  expect(await page.locator("#search-results .card").count()).toBe(fukushi);
});

test("年代チップ（子ども / 高齢者）で検索結果を絞れる", async ({ page }) => {
  const total = await page.locator("#search-results .card").count();

  await page.click('#age-chip-row [data-age="児童(〜17歳)"]');
  const child = await page.locator("#search-results .card").count();
  expect(child).toBeGreaterThan(0);
  expect(child).toBeLessThan(total);
  await expect(page.locator('#age-chip-row [data-age="児童(〜17歳)"]')).toHaveClass(/is-active/);

  await page.click('#age-chip-row [data-age="65歳以上"]');
  const senior = await page.locator("#search-results .card").count();
  expect(senior).not.toBe(child);

  await page.click('#age-chip-row [data-age=""]');
  expect(await page.locator("#search-results .card").count()).toBe(total);
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
