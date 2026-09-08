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

  test("『特別支援教育就学奨励費』でも e120 がヒットする(関連リンク名に含まれる)", async () => {
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

describe("検索範囲（本文も検索チェックボックス）", () => {
  test("既定では概要にしか無い語(安否確認)はヒットしない", async () => {
    const ctx = await openSearchTab();
    assert.equal(ctx.G("state.searchInBody"), false);
    setSearch(ctx, "安否確認");
    await ctx.wait();
    assert.equal(ctx.document.querySelectorAll("#search-results .card").length, 0);
  });

  test("チェックを入れると概要も対象になり、配食サービスがヒットする", async () => {
    const ctx = await openSearchTab();
    setSearch(ctx, "安否確認");
    await ctx.wait();
    const box = ctx.document.getElementById("search-in-body");
    box.checked = true;
    box.dispatchEvent(new ctx.window.Event("change", { bubbles: true }));
    await ctx.wait();
    const names = [...ctx.document.querySelectorAll("#search-results .card__title")].map((el) =>
      el.textContent
    );
    assert.ok(names.includes("障害者自立支援配食サービス"), names.join(" | "));
  });

  test("チェックの有無で結果は「本文あり ⊇ 本文なし」の関係", async () => {
    const ctx = await openSearchTab();
    setSearch(ctx, "相談");
    await ctx.wait();
    const narrow = ctx.G(`filteredSortedEntries().map(e => e.id)`);
    ctx.window.eval("state.searchInBody = true;");
    const wide = ctx.G(`filteredSortedEntries().map(e => e.id)`);
    assert.ok(wide.length >= narrow.length);
    for (const id of narrow) assert.ok(wide.includes(id), `${id} が本文ありで消えた`);
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

describe("年代しぼり込み", () => {
  const AGE_TAGS = ["児童(〜17歳)", "成人(18〜64歳)", "65歳以上"];

  function clickAge(ctx, value) {
    const btn = [...ctx.document.querySelectorAll("#age-chip-row .type-chip")].find(
      (b) => b.dataset.age === value
    );
    btn.dispatchEvent(clickEv(ctx.window));
  }

  test("チップが4つ（全年代 / 子ども / 成人 / 高齢者）", async () => {
    const ctx = await openSearchTab();
    const labels = [...ctx.document.querySelectorAll("#age-chip-row .type-chip")].map((b) =>
      b.textContent
    );
    assert.deepEqual(labels, ["全年代", "子ども", "成人", "高齢者"]);
  });

  test("「子ども」を選ぶと児童向けだけになり、件数が減る", async () => {
    const ctx = await openSearchTab();
    const before = ctx.document.querySelectorAll("#search-results .card").length;
    clickAge(ctx, "児童(〜17歳)");
    await ctx.wait();
    const after = ctx.document.querySelectorAll("#search-results .card").length;
    assert.ok(after < before);
    const ok = ctx.G(`
      filteredSortedEntries().every(e => {
        const a = (e.tags||[]).filter(t => ${JSON.stringify(AGE_TAGS)}.includes(t));
        return a.length === 0 || a.includes("児童(〜17歳)");
      })
    `);
    assert.equal(ok, true);
    // アクティブ表示
    const active = [...ctx.document.querySelectorAll("#age-chip-row .type-chip")].find((b) =>
      b.classList.contains("is-active")
    );
    assert.equal(active.dataset.age, "児童(〜17歳)");
  });

  test("「全年代」に戻すと全件に戻る", async () => {
    const ctx = await openSearchTab();
    const total = ctx.G("state.entries.length");
    clickAge(ctx, "65歳以上");
    await ctx.wait();
    assert.ok(ctx.document.querySelectorAll("#search-results .card").length < total);
    clickAge(ctx, "");
    await ctx.wait();
    assert.equal(ctx.document.querySelectorAll("#search-results .card").length, total);
  });

  test("種別チップと併用できる（制度・手帳 × 子ども）", async () => {
    const ctx = await openSearchTab();
    const typeBtn = [...ctx.document.querySelectorAll("#type-chip-row .type-chip")].find(
      (b) => b.dataset.type === "制度・手帳"
    );
    typeBtn.dispatchEvent(clickEv(ctx.window));
    await ctx.wait();
    clickAge(ctx, "児童(〜17歳)");
    await ctx.wait();
    const ok = ctx.G(`
      filteredSortedEntries().every(e => {
        if (e.type !== "制度・手帳") return false;
        const a = (e.tags||[]).filter(t => ${JSON.stringify(AGE_TAGS)}.includes(t));
        return a.length === 0 || a.includes("児童(〜17歳)");
      })
    `);
    assert.equal(ok, true);
    assert.ok(ctx.G("filteredSortedEntries().length") > 0);
  });
});

describe("手帳・等級フィルタ", () => {
  async function selectTecho(ctx, techo, level) {
    const { document, window, wait } = ctx;
    const t = document.getElementById("grade-techo-select");
    t.value = techo;
    t.dispatchEvent(new window.Event("change", { bubbles: true }));
    await wait();
    if (level != null) {
      const l = document.getElementById("grade-level-select");
      l.value = String(level);
      l.dispatchEvent(new window.Event("change", { bubbles: true }));
      await wait();
    }
  }

  test("手帳種別を選ぶだけで、その手帳用の項目だけに絞られる", async () => {
    const ctx = await openSearchTab();
    await selectTecho(ctx, "seishin");
    const shown = ctx.G(`filteredSortedEntries().map(e => e.id)`);
    assert.ok(shown.length > 0 && shown.length < ctx.G("state.entries.length"));
    // すべて「精神障害者保健福祉手帳あり」タグ か gradeSeishin を持つ
    const allForSeishin = ctx.G(`
      filteredSortedEntries().every(e =>
        (e.tags||[]).includes("精神障害者保健福祉手帳あり") ||
        (Array.isArray(e.gradeSeishin) && e.gradeSeishin.length > 0)
      )
    `);
    assert.equal(allForSeishin, true);
    // 身体手帳専用(身体タグのみ・精神と無関係)の項目は出ない
    const bodyOnly = ctx.G(`
      state.entries.find(e =>
        (e.tags||[]).includes("身体障害者手帳あり") &&
        !(e.tags||[]).includes("精神障害者保健福祉手帳あり") &&
        !(Array.isArray(e.gradeSeishin) && e.gradeSeishin.length)
      )?.id
    `);
    if (bodyOnly) assert.ok(!shown.includes(bodyOnly), `${bodyOnly} が混入`);
  });

  test("身体障害者手帳 6級 を選ぶと、身体手帳向けかつ6級対象の項目だけになる", async () => {
    const ctx = await openSearchTab();
    await selectTecho(ctx, "shintai", 6);
    const shown = ctx.G(`filteredSortedEntries().map(e => e.id)`);

    // 6級対象外の等級記載がある項目は消える
    const violating = ctx.G(`
      state.entries.filter(e =>
        Array.isArray(e.gradeShintai) && e.gradeShintai.length && !e.gradeShintai.includes(6)
      ).map(e => e.id)
    `);
    for (const id of violating) assert.ok(!shown.includes(id), `${id} が残っている`);

    // 残ったものは全て身体手帳向け
    const allForShintai = ctx.G(`
      filteredSortedEntries().every(e =>
        (e.tags||[]).includes("身体障害者手帳あり") ||
        (Array.isArray(e.gradeShintai) && e.gradeShintai.length > 0)
      )
    `);
    assert.equal(allForShintai, true);
  });

  test("『それ以外』でどの手帳にも紐づかない項目だけ表示（手帳の等級・手帳ありタグを持たない）", async () => {
    const ctx = await openSearchTab();
    await selectTecho(ctx, "other");
    const ok = ctx.G(`
      filteredSortedEntries().every(e => {
        const tags = e.tags || [];
        const boundTag = ["身体障害者手帳あり","愛護手帳あり","精神障害者保健福祉手帳あり"].some(t => tags.includes(t));
        const boundField = ["gradeShintai","gradeAigo","gradeSeishin"].some(f => Array.isArray(e[f]) && e[f].length);
        return !boundTag && !boundField;
      })
    `);
    assert.equal(ok, true);
    // 相談窓口系(e4 障害者基幹相談支援センター)は含まれる
    assert.ok(ctx.G(`filteredSortedEntries().some(e => e.id === "e4")`));
    // レベル選択は無効化されている
    assert.equal(ctx.document.getElementById("grade-level-select").disabled, true);
  });

  test("『それ以外』選択時に注意書きが出て、解除で全件に戻る", async () => {
    const ctx = await openSearchTab();
    await selectTecho(ctx, "other");
    assert.match(
      ctx.document.querySelector(".grade-filter-note").textContent,
      /どの手帳.*紐づかない/
    );
    ctx.document.getElementById("grade-clear").dispatchEvent(clickEv(ctx.window));
    await ctx.wait();
    assert.equal(
      ctx.document.querySelectorAll("#search-results .card").length,
      ctx.G("state.entries.length")
    );
  });
});
