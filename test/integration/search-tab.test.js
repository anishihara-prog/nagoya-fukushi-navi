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

  test("障害者向け→一般制度の順に並び、境目に見出しが入る", async () => {
    const ctx = await openSearchTab();

    // filteredSortedEntries: general は必ず非 general の後ろ
    const flags = ctx.G("filteredSortedEntries().map(e => !!e.general)");
    const firstGeneral = flags.indexOf(true);
    const lastNonGeneral = flags.lastIndexOf(false);
    assert.ok(firstGeneral > lastNonGeneral, "general 項目が途中に混ざっている");

    // #search-results に区切り見出しが1つだけ
    const dividers = ctx.document.querySelectorAll("#search-results .results-divider");
    assert.equal(dividers.length, 1);
    assert.equal(dividers[0].textContent, "障害の有無を問わず利用できる制度");

    // 見出しより前は general でない / 後は全部 general
    const nodes = [...ctx.document.querySelectorAll("#search-results > *")];
    const di = nodes.findIndex((n) => n.classList.contains("results-divider"));
    const idOf = (n) => n.getAttribute("data-card");
    const isGeneral = (id) => ctx.G(`!!state.entries.find(e => e.id === ${JSON.stringify(id)}).general`);
    for (const n of nodes.slice(0, di)) if (idOf(n)) assert.equal(isGeneral(idOf(n)), false);
    for (const n of nodes.slice(di + 1)) if (idOf(n)) assert.equal(isGeneral(idOf(n)), true);
  });

  test("一般制度だけに絞られたときは見出しを出さない", async () => {
    const ctx = await openSearchTab();
    setSearch(ctx, "ひとり親家庭手当"); // general な e146 だけがヒット
    await ctx.wait();
    assert.ok(ctx.document.querySelectorAll("#search-results .card").length >= 1);
    assert.equal(ctx.document.querySelectorAll("#search-results .results-divider").length, 0);
  });

  test("よみがな（aliases）でも検索できる：「ほそうぐ」→ 補装具費の支給", async () => {
    const ctx = await openSearchTab();
    setSearch(ctx, "ほそうぐ");
    await ctx.wait();
    const names = [...ctx.document.querySelectorAll("#search-results .card__title")].map((el) =>
      el.textContent
    );
    assert.ok(names.includes("補装具費の支給"), names.join(" | "));
    // カタカナ「ホソウグ」でも同じ（normalizeForSearch でかな統一）
    setSearch(ctx, "ホソウグ");
    await ctx.wait();
    assert.ok(
      [...ctx.document.querySelectorAll("#search-results .card__title")]
        .map((el) => el.textContent)
        .includes("補装具費の支給")
    );
  });

  test("検索するたびに件数フィードバック（「◯件を表示しました」）が出る", async () => {
    const ctx = await openSearchTab();
    const countEl = ctx.document.getElementById("search-count");
    assert.ok(countEl, "#search-count が無い");
    assert.match(countEl.textContent, /全\d+件を表示しています/);

    setSearch(ctx, "配食");
    await ctx.wait();
    assert.match(countEl.textContent, /「配食」の検索結果：\d+件を表示しました/);
    assert.equal(
      Number(countEl.textContent.match(/(\d+)件/)[1]),
      ctx.document.querySelectorAll("#search-results .card").length
    );
    assert.equal(countEl.getAttribute("aria-live"), "polite");
    assert.ok(countEl.classList.contains("is-flash"), "更新時のハイライトが付かない");

    setSearch(ctx, "ヒットしない語zzz");
    await ctx.wait();
    assert.match(countEl.textContent, /0件を表示しました/);
  });

  test("スペース区切りは AND 検索（すべての語を含むものだけ）", async () => {
    const ctx = await openSearchTab();
    setSearch(ctx, "グループホーム");
    await ctx.wait();
    const one = ctx.document.querySelectorAll("#search-results .card").length;
    setSearch(ctx, "グループホーム 精神");
    await ctx.wait();
    const two = ctx.document.querySelectorAll("#search-results .card").length;
    assert.ok(two > 0 && two < one, `AND で件数が減るはず (${one} -> ${two})`);
    // 全角スペースでも同じ
    setSearch(ctx, "グループホーム　精神");
    await ctx.wait();
    assert.equal(ctx.document.querySelectorAll("#search-results .card").length, two);
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

describe("目的・場面しぼり込み", () => {
  function setPurpose(ctx, value) {
    const sel = ctx.document.getElementById("purpose-select");
    sel.value = value;
    sel.dispatchEvent(new ctx.window.Event("change", { bubbles: true }));
  }

  test("選択肢は TAG_GROUPS.situation の12件", async () => {
    const ctx = await openSearchTab();
    const values = [...ctx.document.querySelectorAll("#purpose-select option")]
      .map((o) => o.value)
      .filter(Boolean);
    assert.deepEqual(values, ctx.G("TAG_GROUPS.situation.tags"));
  });

  test("目的を選ぶと、そのタグを持つ項目だけになる（もう1段階の絞り込み）", async () => {
    const ctx = await openSearchTab();
    // まず種別で福祉サービスに
    [...ctx.document.querySelectorAll("#type-chip-row .type-chip")]
      .find((b) => b.dataset.type === "福祉サービス")
      .dispatchEvent(clickEv(ctx.window));
    await ctx.wait();
    const beforeCount = ctx.G("filteredSortedEntries().length");

    setPurpose(ctx, "在宅での生活支援");
    await ctx.wait();
    const afterCount = ctx.G("filteredSortedEntries().length");
    assert.ok(afterCount > 0 && afterCount < beforeCount);
    assert.equal(
      ctx.G(`filteredSortedEntries().every(e => (e.tags||[]).includes("在宅での生活支援"))`),
      true
    );
    // 種別の条件も維持されている
    assert.equal(ctx.G(`filteredSortedEntries().every(e => e.type === "福祉サービス")`), true);
  });

  test("「✕ 解除」で目的の絞り込みだけ外れる（種別は維持）", async () => {
    const ctx = await openSearchTab();
    [...ctx.document.querySelectorAll("#type-chip-row .type-chip")]
      .find((b) => b.dataset.type === "福祉サービス")
      .dispatchEvent(clickEv(ctx.window));
    await ctx.wait();
    const fukushiOnly = ctx.G("filteredSortedEntries().length");

    setPurpose(ctx, "就労の支援");
    await ctx.wait();
    assert.ok(ctx.G("filteredSortedEntries().length") < fukushiOnly);

    ctx.document.getElementById("purpose-clear").dispatchEvent(clickEv(ctx.window));
    await ctx.wait();
    assert.equal(ctx.G("filteredSortedEntries().length"), fukushiOnly);
    assert.equal(ctx.G("state.searchPurpose"), "");
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

  test("手帳種別を選ぶだけで、その障害(手帳)向けの項目だけに絞られる", async () => {
    const ctx = await openSearchTab();
    await selectTecho(ctx, "seishin");
    const shown = ctx.G(`filteredSortedEntries().map(e => e.id)`);
    assert.ok(shown.length > 0 && shown.length < ctx.G("state.entries.length"));
    // すべて「精神障害者保健福祉手帳あり」タグ か「精神障害」タグ か gradeSeishin を持つ
    const allForSeishin = ctx.G(`
      filteredSortedEntries().every(e =>
        (e.tags||[]).includes("精神障害者保健福祉手帳あり") ||
        (e.tags||[]).includes("精神障害") ||
        (Array.isArray(e.gradeSeishin) && e.gradeSeishin.length > 0)
      )
    `);
    assert.equal(allForSeishin, true);
    // 精神と無関係(身体タグのみ・精神障害タグも精神手帳タグも等級も無い)の項目は出ない
    const bodyOnly = ctx.G(`
      state.entries.find(e =>
        (e.tags||[]).includes("身体障害") &&
        !(e.tags||[]).includes("精神障害") &&
        !(e.tags||[]).includes("精神障害者保健福祉手帳あり") &&
        !(Array.isArray(e.gradeSeishin) && e.gradeSeishin.length)
      )?.id
    `);
    if (bodyOnly) assert.ok(!shown.includes(bodyOnly), `${bodyOnly} が混入`);
  });

  test("身体障害者手帳 6級: 等級記載のある項目は6級対象のみ、記載の無い身体障害向けは全等級で表示", async () => {
    const ctx = await openSearchTab();
    await selectTecho(ctx, "shintai", 6);
    const shown = ctx.G(`filteredSortedEntries().map(e => e.id)`);

    // 6級対象外の「等級記載がある」項目は消える
    const violating = ctx.G(`
      state.entries.filter(e =>
        Array.isArray(e.gradeShintai) && e.gradeShintai.length && !e.gradeShintai.includes(6)
      ).map(e => e.id)
    `);
    for (const id of violating) assert.ok(!shown.includes(id), `${id} が残っている`);

    // 残ったものは全て身体障害向け(身体手帳タグ / 身体障害タグ / 等級記載)
    const allForShintai = ctx.G(`
      filteredSortedEntries().every(e =>
        (e.tags||[]).includes("身体障害者手帳あり") ||
        (e.tags||[]).includes("身体障害") ||
        (Array.isArray(e.gradeShintai) && e.gradeShintai.length > 0)
      )
    `);
    assert.equal(allForShintai, true);

    // 「身体障害」タグあり・等級記載なし の項目は、どの等級を選んでも表示される
    const disNoGrade = ctx.G(`
      state.entries.find(e =>
        (e.tags||[]).includes("身体障害") &&
        !(Array.isArray(e.gradeShintai) && e.gradeShintai.length)
      )?.id
    `);
    assert.ok(disNoGrade && shown.includes(disNoGrade), `${disNoGrade} が6級で消えた`);
    // 1級でも同じく表示される
    await selectTecho(ctx, "shintai", 1);
    assert.ok(ctx.G(`filteredSortedEntries().map(e=>e.id)`).includes(disNoGrade));
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
