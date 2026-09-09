const { test, expect } = require("@playwright/test");

/** ケース相談を「成人 / 精神障害 / 精神手帳 / 中程度 / 区スキップ / まず相談先を探したい」で回す。 */
async function runFlow(page) {
  await page.goto("/");
  await page.click('.tabbar__btn[data-tab="chat"]');
  await page.click('.chat-option-btn:has-text("成人（18〜64歳）")');
  await page.click('.chat-option-btn:has-text("精神障害")');
  await page.click("#btn-multi-next");
  await page.click('.chat-option-btn:has-text("精神障害者保健福祉手帳あり")');
  await page.click('.chat-option-btn:has-text("中程度")');
  await page.click("#btn-text-skip");
  await page.click('.chat-option-btn:has-text("まず相談先を探したい")');
  await expect(page.locator(".chat-results__header")).toBeVisible();
}

test("結果がカテゴリー別の折り畳み見出しで表示される", async ({ page }) => {
  await runFlow(page);

  const titles = page.locator(".chat-results__group-title");
  await expect(titles.filter({ hasText: "相談窓口" })).toBeVisible();
  await expect(titles.filter({ hasText: "制度・手帳" })).toBeVisible();
  await expect(titles.filter({ hasText: "福祉サービス" })).toBeVisible();

  // 既定は閉じている
  await expect(page.locator(".chat-results__group-body")).toHaveCount(0);
});

test("福祉サービス見出しを押すと件数どおりのカードが開く", async ({ page }) => {
  await runFlow(page);

  const toggle = page.locator('[data-group-toggle="福祉サービス"]');
  const text = await toggle.textContent();
  const n = Number(text.match(/（(\d+)件）/)[1]);
  expect(n).toBe(3);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const group = page
    .locator(".chat-results__group")
    .filter({ has: page.locator('[data-group-toggle="福祉サービス"]') });
  await expect(group.locator(".chat-results__group-body .card")).toHaveCount(n);

  // 開いているのは1グループだけ
  await expect(page.locator(".chat-results__group-body")).toHaveCount(1);

  // もう一度押すと閉じる
  await page.locator('[data-group-toggle="福祉サービス"]').click();
  await expect(page.locator(".chat-results__group-body")).toHaveCount(0);
});

test("年齢・障害種別に合わない項目は結果に出ない", async ({ page }) => {
  await runFlow(page);
  // すべてのグループを開く(クリックごとに再描画されるので毎回引き直す)
  const groupCount = await page.locator(".chat-results__group-toggle").count();
  for (let i = 0; i < groupCount; i++) {
    await page.locator(".chat-results__group-toggle").nth(i).click();
  }
  const bodyText = await page.locator("#app").innerText();
  expect(bodyText).not.toContain("児童相談所");
  expect(bodyText).not.toContain("高齢者に関する相談窓口");
  expect(bodyText).not.toContain("身体障害者更生相談所");
  expect(bodyText).not.toContain("知的障害者更生相談所");
});

test("『最初からやり直す』で最初の質問に戻る", async ({ page }) => {
  await runFlow(page);
  await page.click("#btn-chat-restart");
  await expect(page.locator(".chat-results__group")).toHaveCount(0);
  await expect(page.locator(".chat-msg--bot").first()).toContainText("相談者のプロフィール");
});
