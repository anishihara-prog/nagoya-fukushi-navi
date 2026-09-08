/* 統合テスト: 検索タブの描画とフィルタ操作。 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("../helpers/loadApp");

const clickEv = (window) => new window.MouseEvent("click", { bubbles: true });

async function openSearchTab() {
  const ctx = await loadApp();
  ctx.document.querySelector('[data-tab="search"]').dispatchEvent(clickEv(ctx.window));
  await ctx.wait();
  return ctx;
}

function setSearch(ctx, value) {
  const input = ctx.document.getElementById("search-input");
  input.value = value;
  input.dispatchEvent(new ctx.window.Event("input", { bubbles: true }));
}

describe("キーワード検索", () => {
  test("初期表示で全件のカードが出る", async () => {
    const ctx = await openSearchTab();
    const cards = ctx.document.querySelectorAll("#search-results .card").length;
    const total = ctx.G("state.entries.length");
    assert.equal(cards, total);
  });

  test("『配食』で障害者自立支援配食サービスが絞り込まれる", async () => {
    const ctx = await openSearchTab();
    setSearch(ctx, "配食");
    await ctx.wait();
    const names = [...ctx.document.querySelectorAll("#search-results .card__title")].map((el) =>
      el.textContent
    );
    assert.ok(names.includes("障害者自立支援配食サービス"), names.join(" | "));
  });

  test("『特別支援教育就学奨励費』でも e120 がヒットする(概要に文言追加済み)", async () => {
    const ctx = await openSearchTab();
    setSearch(ctx, "特別支援教育就学奨励費");
    await ctx.wait();
    const names = [...ctx.document.querySelectorAll("#search-results .card__title")].map((el) =>
      el.textContent
    );
    assert.ok(
      names.some((n) => /特別支援学級・通級指導教室・特別支援学校/.test(n)),
      names.join(" | ")
    );
  });

  test("該当なしのときは空状態メッセージ", async () => {
    const ctx = await openSearchTab();
    setSearch(ctx, "ぜったいにヒットしない語xyz");
    await ctx.wait();
    assert.equal(ctx.document.querySelectorAll("#search-results .card").length, 0);
    assert.ok(ctx.document.querySelector("#search-results .empty-state"));
  });
});

describe("種別チップ", () => {
  test("『相談窓口』チップで相談窓口だけになる", async () => {
    const ctx = await openSearchTab();
    const chip = [...ctx.document.querySelectorAll("#type-chip-row .type-chip")].find(
      (b) => b.dataset.type === "相談窓口"
    );
    chip.dispatchEvent(clickEv(ctx.window));
    await ctx.wait();
    const badges = [...ctx.document.querySelectorAll("#search-results .card .badge")].map((el) =>
      el.textContent
    );
    assert.ok(badges.length > 0);
    assert.ok(badges.every((t) => t === "相談窓口" || /^\d+$/.test(t) || t.startsWith("🎯")));
    // 「制度・手帳」バッジが混ざっていないこと
    assert.ok(!badges.includes("制度・手帳"));
  });
});

describe("等級フィルタ", () => {
  test("身体障害者手帳 6級 を選ぶと、等級指定のある不適合項目が消える", async () => {
    const ctx = await openSearchTab();
    const { document, window, wait } = ctx;
    const techo = document.getElementById("grade-techo-select");
    techo.value = "shintai";
    techo.dispatchEvent(new window.Event("change", { bubbles: true }));
    await wait();
    const lvl = document.getElementById("grade-level-select");
    lvl.value = "6";
    lvl.dispatchEvent(new window.Event("change", { bubbles: true }));
    await wait();

    const shown = ctx.G(`filteredSortedEntries().map(e => e.id)`);
    const violating = ctx.G(`
      state.entries.filter(e =>
        Array.isArray(e.gradeShintai) && e.gradeShintai.length && !e.gradeShintai.includes(6)
      ).map(e => e.id)
    `);
    for (const id of violating) {
      assert.ok(!shown.includes(id), `${id} は6級対象外なのに表示されている`);
    }
  });
});
