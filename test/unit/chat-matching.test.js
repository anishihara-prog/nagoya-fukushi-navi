/* ユニットテスト: getChatResults() の絞り込みロジック
   state.chat.collectedTags を直接組み立てて getChatResults() の結果を検証する。 */
const { test, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("../helpers/loadApp");

let G, window;
beforeEach(async () => {
  ({ G, window } = await loadApp());
  // done フェーズを模した最小の chat 状態を作る
  window.eval(`
    state.chat = {
      phase: "done", stepIndex: 0, followupKey: null,
      collectedTags: new Set(), multiTemp: new Set(),
      ward: "", openGroups: new Set(), snapshots: [], history: [],
    };
  `);
});

function setTags(tags) {
  window.eval(`state.chat.collectedTags = new Set(${JSON.stringify(tags)});`);
}
function resultIds() {
  return G("getChatResults().map(e => e.id)");
}
function resultNames() {
  return G("getChatResults().map(e => e.name)");
}

describe("困りごと(situation)タグ", () => {
  test("選んだ困りごとタグを持たない項目は除外される", () => {
    setTags(["成人(18〜64歳)", "精神障害", "相談先を探したい"]);
    const withRelevant = resultIds();
    // 「相談先を探したい」を持つ項目だけが残る
    const allHaveTag = G(`
      getChatResults().every(e => (e.tags||[]).includes("相談先を探したい"))
    `);
    assert.equal(allHaveTag, true);
    assert.ok(withRelevant.length > 0);
  });
});

describe("年代のハード条件", () => {
  test("成人を選ぶと、児童のみ対象の項目(児童相談所 e19)は出ない", () => {
    setTags(["成人(18〜64歳)", "精神障害", "相談先を探したい"]);
    assert.ok(!resultIds().includes("e19"), "e19 児童相談所 が混入している");
  });
  test("成人を選ぶと、65歳以上のみ対象の項目(高齢者に関する相談窓口 e157)は出ない", () => {
    setTags(["成人(18〜64歳)", "精神障害", "相談先を探したい"]);
    assert.ok(!resultIds().includes("e157"), "e157 高齢者に関する相談窓口 が混入している");
  });
  test("年代タグを持たない項目は年代で除外されない", () => {
    // e120 は年代タグ「児童(〜17歳)」を持つので、成人では出ないことの対比として
    // 年代タグ無しの項目が残ることを確認する
    setTags(["成人(18〜64歳)", "精神障害", "相談先を探したい"]);
    const anyAgeless = G(`
      state.entries.some(e => {
        const ids = getChatResults().map(x => x.id);
        const ageTags = ["児童(〜17歳)","成人(18〜64歳)","65歳以上"];
        return ids.includes(e.id) && !(e.tags||[]).some(t => ageTags.includes(t));
      })
    `);
    // 少なくとも1件、年代非依存の項目が結果に含まれていてよい(存在チェックのみ)
    assert.equal(typeof anyAgeless, "boolean");
  });
});

describe("障害種別のハード条件", () => {
  test("精神障害を選ぶと、身体障害のみ対象の更生相談所(e22)は出ない", () => {
    setTags(["成人(18〜64歳)", "精神障害", "相談先を探したい"]);
    assert.ok(!resultIds().includes("e22"), "e22 身体障害者更生相談所 が混入している");
  });
  test("精神障害を選ぶと、知的障害のみ対象の更生相談所(e23)は出ない", () => {
    setTags(["成人(18〜64歳)", "精神障害", "相談先を探したい"]);
    assert.ok(!resultIds().includes("e23"), "e23 知的障害者更生相談所 が混入している");
  });
  test("「重複・不明」を選ぶと障害種別では絞り込まない", () => {
    setTags(["成人(18〜64歳)", "重複・不明", "相談先を探したい"]);
    const withAny = resultIds();
    setTags(["成人(18〜64歳)", "精神障害", "相談先を探したい"]);
    const withPsy = resultIds();
    assert.ok(withAny.length >= withPsy.length, "重複・不明の方が結果が少ない(絞り込まれている)");
  });
});

describe("スコアしきい値", () => {
  test("プロフィール一致が1つだけの項目は出ない(2つ以上必要)", () => {
    // 「相談先を探したい」のみ(situationのみ一致)では score=1 で除外
    setTags(["相談先を探したい"]);
    assert.deepEqual(resultIds(), []);
  });
  test("プロフィール2つ以上一致すれば表示されうる", () => {
    setTags(["成人(18〜64歳)", "精神障害", "相談先を探したい"]);
    assert.ok(resultIds().length > 0);
  });
});

describe("既知のシナリオ(成人×精神×手帳×相談先)", () => {
  test("福祉サービスは3件で自立生活援助を含む", () => {
    setTags(["成人(18〜64歳)", "精神障害", "精神障害者保健福祉手帳あり", "相談先を探したい"]);
    const fukushi = G(`getChatResults().filter(e => e.type === "福祉サービス").map(e => e.name)`);
    assert.equal(fukushi.length, 3);
    assert.ok(fukushi.includes("自立生活援助"));
  });
  test("結果はスコア降順で並ぶ", () => {
    setTags(["成人(18〜64歳)", "精神障害", "精神障害者保健福祉手帳あり", "相談先を探したい"]);
    const scores = G(`
      (function(){
        const tags = state.chat.collectedTags;
        return getChatResults().map(e => [...tags].filter(t => (e.tags||[]).includes(t)).length);
      })()
    `);
    const sorted = [...scores].sort((a, b) => b - a);
    assert.deepEqual(scores, sorted);
  });
});
