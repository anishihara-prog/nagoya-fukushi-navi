/* ユニットテスト: app.js の純粋関数
   jsdom 上に app.js を読み込み、グローバル関数を直接呼ぶ(DOM 描画はしない)。 */
const { test, before, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("../helpers/loadApp");

let G;
before(async () => {
  ({ G } = await loadApp());
});

describe("normalizeForSearch", () => {
  test("全角英数を半角化して小文字にする", () => {
    assert.equal(G('normalizeForSearch("ＡＢＣ１２３")'), "abc123");
  });
  test("カタカナをひらがな化する", () => {
    assert.equal(G('normalizeForSearch("グループホーム")'), "ぐるーぷほーむ");
  });
  test("半角カナを全角ひらがな相当に統一する(濁点・半濁点含む)", () => {
    assert.equal(G('normalizeForSearch("ｸﾞﾙｰﾌﾟﾎｰﾑ")'), "ぐるーぷほーむ");
  });
  test("空・null は空文字", () => {
    assert.equal(G("normalizeForSearch('')"), "");
    assert.equal(G("normalizeForSearch(null)"), "");
  });
});

describe("escapeHtml / escapeAttr", () => {
  test("HTML 特殊文字をエスケープ", () => {
    assert.equal(G(`escapeHtml('<a>&"')`), '&lt;a&gt;&amp;"');
  });
  test("escapeAttr は二重引用符も変換", () => {
    assert.equal(G(`escapeAttr('<a>&"')`), "&lt;a&gt;&amp;&quot;");
  });
  test("falsy は空文字", () => {
    assert.equal(G("escapeHtml(undefined)"), "");
  });
});

describe("formatGradeLevels", () => {
  test("連続する等級は範囲表記になる", () => {
    assert.equal(G("formatGradeLevels([1,2,3,4,5,6], '級')"), "1〜6級");
  });
  test("飛び番号は中黒区切り", () => {
    assert.equal(G("formatGradeLevels([1,3], '度')"), "1・3度");
  });
  test("2連番は範囲にせず並べる", () => {
    assert.equal(G("formatGradeLevels([2,3], '級')"), "2・3級");
  });
  test("単一等級", () => {
    assert.equal(G("formatGradeLevels([2], '級')"), "2級");
  });
  test("順不同でも整列される", () => {
    assert.equal(G("formatGradeLevels([3,1,2], '級')"), "1〜3級");
  });
});

describe("substituteWard", () => {
  test("区が未指定なら原文のまま", () => {
    assert.equal(G(`substituteWard("お住まいの区の区役所 福祉課", "")`), "お住まいの区の区役所 福祉課");
  });
  test('"お住まいの区の区役所" が "○○区役所" に置換される', () => {
    assert.equal(
      G(`substituteWard("お住まいの区の区役所 福祉課", "中区")`),
      "中区役所 福祉課"
    );
  });
  test('"お住まいの区" 単体も置換される', () => {
    assert.equal(G(`substituteWard("お住まいの区の保健センター", "南区")`), "南区の保健センター");
  });
});
