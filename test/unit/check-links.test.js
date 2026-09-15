/* リンクチェックスクリプト(scripts/check-links.js)の純粋関数テスト。ネットワークアクセスはしない。 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { extractLinksFromEntries, extractVisibleText, hashText, classifyChange, buildReport } = require("../../scripts/check-links.js");

describe("extractLinksFromEntries", () => {
  test("welnetUrl と extraLinks の両方を拾う", () => {
    const entries = [
      { id: "e1", name: "手当A", welnetUrl: "https://example.com/a", extraLinks: [{ label: "詳細", url: "https://example.com/a-detail" }] },
      { id: "e2", name: "手当B", welnetUrl: "https://example.com/b" },
    ];
    const map = extractLinksFromEntries(entries);
    assert.equal(map.size, 3);
    assert.ok(map.has("https://example.com/a"));
    assert.ok(map.has("https://example.com/a-detail"));
    assert.ok(map.has("https://example.com/b"));
  });

  test("同じURLを複数エントリが参照する場合は関連先をまとめる", () => {
    const entries = [
      { id: "e1", name: "手当A", welnetUrl: "https://example.com/shared" },
      { id: "e2", name: "手当B", welnetUrl: "https://example.com/shared" },
    ];
    const map = extractLinksFromEntries(entries);
    assert.equal(map.size, 1);
    const refs = map.get("https://example.com/shared");
    assert.equal(refs.length, 2);
    assert.deepEqual(refs.map((r) => r.entryId), ["e1", "e2"]);
  });

  test("welnetUrl も extraLinks も無ければ何も拾わない", () => {
    const map = extractLinksFromEntries([{ id: "e1", name: "手当C" }]);
    assert.equal(map.size, 0);
  });
});

describe("extractVisibleText", () => {
  test("script/style/タグを除去し、実体参照をデコードする", () => {
    const html = `<html><head><style>.a{color:red}</style></head>
      <body><script>alert(1)</script><p>本文だよ &amp; &nbsp; テスト</p></body></html>`;
    assert.equal(extractVisibleText(html), "本文だよ & テスト");
  });

  test("空白の連続を1つにまとめる", () => {
    assert.equal(extractVisibleText("<p>a</p>\n\n  <p>b</p>"), "a b");
  });
});

describe("hashText", () => {
  test("同じ文字列は同じハッシュになる", () => {
    assert.equal(hashText("同じ内容"), hashText("同じ内容"));
  });

  test("違う文字列は違うハッシュになる", () => {
    assert.notEqual(hashText("内容A"), hashText("内容B"));
  });

  test("sha256: プレフィックスが付く", () => {
    assert.match(hashText("x"), /^sha256:[0-9a-f]{64}$/);
  });
});

describe("classifyChange", () => {
  const ok = (finalUrl, contentHash) => ({ ok: true, status: 200, finalUrl, contentHash });
  const broken = (status = 404) => ({ ok: false, status, finalUrl: null, contentHash: null });

  test("前回情報が無ければ new", () => {
    assert.deepEqual(classifyChange(undefined, ok("https://a", "h1")), ["new"]);
  });

  test("変化なしなら空配列", () => {
    const curr = ok("https://a", "h1");
    assert.deepEqual(classifyChange(ok("https://a", "h1"), curr), []);
  });

  test("正常→異常は newBroken", () => {
    assert.deepEqual(classifyChange(ok("https://a", "h1"), broken()), ["newBroken"]);
  });

  test("異常→異常は stillBroken(既知)", () => {
    assert.deepEqual(classifyChange(broken(404), broken(500)), ["stillBroken"]);
  });

  test("異常→正常は fixed", () => {
    assert.deepEqual(classifyChange(broken(), ok("https://a", "h1")), ["fixed"]);
  });

  test("到達先URLが変われば urlChanged", () => {
    assert.deepEqual(classifyChange(ok("https://old", "h1"), ok("https://new", "h1")), ["urlChanged"]);
  });

  test("本文ハッシュが変われば contentChanged", () => {
    assert.deepEqual(classifyChange(ok("https://a", "h1"), ok("https://a", "h2")), ["contentChanged"]);
  });

  test("URL変更時は本文差分をcontentChangedとして重複報告しない", () => {
    const tags = classifyChange(ok("https://old", "h1"), ok("https://new", "h2"));
    assert.deepEqual(tags, ["urlChanged"]);
  });
});

describe("buildReport", () => {
  function result(url, tags, curr = { ok: true, status: 200 }) {
    return { url, refs: [{ entryId: "e1", entryName: "テスト項目" }], curr, tags };
  }

  test("変化があれば hasChanges が true になる", () => {
    const report = buildReport([result("https://a", ["newBroken"], { ok: false, status: 404 })]);
    assert.equal(report.hasChanges, true);
    assert.match(report.text, /リンク切れの疑い/);
  });

  test("stillBroken だけでは hasChanges は false(既知の問題を毎回通知しない)", () => {
    const report = buildReport([result("https://a", ["stillBroken"], { ok: false, status: 404 })]);
    assert.equal(report.hasChanges, false);
  });

  test("変化が無ければ hasChanges は false", () => {
    const report = buildReport([result("https://a", [])]);
    assert.equal(report.hasChanges, false);
    assert.match(report.text, /変化なし: 1件/);
  });
});
