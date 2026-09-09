/* 統合テスト: ケース相談タブを実際にクリック操作し、描画された DOM を検証する。 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, runChatFlow } = require("../helpers/loadApp");

const clickEv = (window) => new window.MouseEvent("click", { bubbles: true });

describe("質問フロー", () => {
  test("最後まで回答すると結果セクションが表示される", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx);
    assert.ok(ctx.document.getElementById("chat-results-top"), "結果先頭アンカーが無い");
    assert.match(
      ctx.document.querySelector(".chat-results__header").textContent,
      /利用できる可能性のあるサービス（\d+件）/
    );
  });

  test("収集タグに各ステップの選択が反映される", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx);
    const tags = ctx.G("[...state.chat.collectedTags]");
    assert.deepEqual(
      new Set(tags),
      new Set(["成人(18〜64歳)", "精神障害", "精神障害者保健福祉手帳あり", "相談先を探したい"])
    );
  });
});

describe("結果のカテゴリー別グループ表示", () => {
  test("相談窓口 / 制度・手帳 / 福祉サービス の見出しが件数付きで出る", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx);
    const titles = [...ctx.document.querySelectorAll(".chat-results__group-title")].map((el) =>
      el.textContent.trim()
    );
    assert.ok(titles.some((t) => /^相談窓口（\d+件）$/.test(t)), titles.join(" | "));
    assert.ok(titles.some((t) => /^制度・手帳（\d+件）$/.test(t)), titles.join(" | "));
    assert.ok(titles.some((t) => /^福祉サービス（\d+件）$/.test(t)), titles.join(" | "));
  });

  test("初期状態は全グループ折り畳み(本文が描画されていない)", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx);
    assert.equal(ctx.document.querySelectorAll(".chat-results__group-body").length, 0);
  });

  test("見出しを押すとそのグループだけ開き、件数どおりのカードが出る", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx);
    const { document, window, wait } = ctx;

    const toggle = [...document.querySelectorAll(".chat-results__group-toggle")].find((t) =>
      /福祉サービス/.test(t.textContent)
    );
    const headerCount = Number(toggle.textContent.match(/（(\d+)件）/)[1]);
    toggle.dispatchEvent(clickEv(window));
    await wait(10);

    const group = [...document.querySelectorAll(".chat-results__group")].find((g) =>
      /福祉サービス/.test(g.querySelector(".chat-results__group-toggle").textContent)
    );
    const cards = group.querySelectorAll(".chat-results__group-body .card").length;
    assert.equal(cards, headerCount, "カード枚数が見出しの件数と一致しない");
    assert.equal(cards, 4, "既知シナリオでは福祉サービスは4件");
    assert.equal(
      document.querySelectorAll(".chat-results__group-body").length,
      1,
      "開いているグループは1つだけのはず"
    );
    // 再描画後の新しいボタンで aria-expanded を確認(旧参照はデタッチ済み)
    assert.equal(
      document.querySelector('[data-group-toggle="福祉サービス"]').getAttribute("aria-expanded"),
      "true"
    );
  });

  test("もう一度押すと閉じる", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx);
    const { document, window, wait } = ctx;
    const sel = '[data-group-toggle="福祉サービス"]';
    document.querySelector(sel).dispatchEvent(clickEv(window));
    await wait(10);
    assert.equal(document.querySelectorAll(".chat-results__group-body").length, 1);
    document.querySelector(sel).dispatchEvent(clickEv(window));
    await wait(10);
    assert.equal(document.querySelectorAll(".chat-results__group-body").length, 0);
  });
});

describe("結果カードの詳細開閉", () => {
  test("詳細トグルで card__detail が現れ、再クリックで消える", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx);
    const { document, window, wait } = ctx;

    document
      .querySelector('[data-group-toggle="相談窓口"]')
      .dispatchEvent(clickEv(window));
    await wait(10);

    const head = document.querySelector(".chat-results__group-body [data-toggle]");
    const id = head.dataset.toggle;
    head.dispatchEvent(clickEv(window));
    await wait(10);
    assert.ok(
      document.querySelector(`[data-card="${id}"] .card__detail`),
      "詳細が開かない"
    );
    assert.equal(ctx.G("state.expandedId"), id);

    document.querySelector(`[data-card="${id}"] [data-toggle]`).dispatchEvent(clickEv(window));
    await wait(10);
    assert.equal(
      document.querySelector(`[data-card="${id}"] .card__detail`),
      null,
      "詳細が閉じない"
    );
    assert.equal(ctx.G("state.expandedId"), null);
  });
});

describe("区を選んだ場合の窓口補完", () => {
  test("区を選ぶと結果ヘッダーに区名が出る", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx, { ward: "中区" });
    assert.match(
      ctx.document.querySelector(".chat-results__header").textContent,
      /中区/
    );
  });
});

describe("やり直し", () => {
  test("『最初からやり直す』で質問1に戻る", async () => {
    const ctx = await loadApp();
    await runChatFlow(ctx);
    const { document, window, wait } = ctx;
    document.getElementById("btn-chat-restart").dispatchEvent(clickEv(window));
    await wait(10);
    assert.equal(document.querySelectorAll(".chat-results__group").length, 0);
    assert.match(
      document.querySelector(".chat-msg--bot .chat-bubble").textContent,
      /相談者のプロフィール/
    );
  });
});
