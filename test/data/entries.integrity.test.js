/* データ整合テスト: data/entries.json の構造チェック(jsdom 不要)。 */
const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const rawText = fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "js/app.js"), "utf8");

let entries;
before(() => {
  entries = JSON.parse(rawText); // ここで壊れていれば即失敗
});

// app.js の CHAT_FLOW / FOLLOWUP_MAP / TAG_GROUPS 定義部から既知タグ語彙を収集
function knownTagVocabulary() {
  const slice = appJs.slice(
    appJs.indexOf("const CHAT_FLOW"),
    appJs.indexOf("// ---------- アプリの状態")
  );
  const set = new Set();
  for (const m of slice.matchAll(/"([^"\\]+)"/g)) set.add(m[1]);
  return set;
}

describe("トップレベル構造", () => {
  test("配列である", () => assert.ok(Array.isArray(entries)));
  test("2スペースインデントで pretty-print されている", () => {
    assert.equal(rawText, JSON.stringify(entries, null, 2) + "\n");
  });
});

describe("各エントリ", () => {
  const REQUIRED = ["id", "name", "type", "tags", "updatedBy", "sortOrder"];
  const TYPES = new Set(["制度・手帳", "福祉サービス", "相談窓口"]);

  test("id が e+数字 で一意", () => {
    const ids = entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, "id の重複がある");
    for (const id of ids) assert.match(id, /^e\d+$/, `不正な id: ${id}`);
  });

  test("必須フィールドが揃っている", () => {
    for (const e of entries) {
      for (const k of REQUIRED) {
        assert.ok(e[k] !== undefined && e[k] !== null, `${e.id}: ${k} が無い`);
      }
    }
  });

  test("type は既定の3種のいずれか", () => {
    for (const e of entries) assert.ok(TYPES.has(e.type), `${e.id}: 不正な type "${e.type}"`);
  });

  test("tags は文字列配列", () => {
    for (const e of entries) {
      assert.ok(Array.isArray(e.tags), `${e.id}: tags が配列でない`);
      for (const t of e.tags) assert.equal(typeof t, "string", `${e.id}: tag が文字列でない`);
    }
  });

  test("sortOrder は数値", () => {
    for (const e of entries) {
      assert.equal(typeof e.sortOrder, "number", `${e.id}: sortOrder が数値でない`);
      assert.ok(Number.isFinite(e.sortOrder), `${e.id}: sortOrder が有限でない`);
    }
  });

  test("updatedAt があれば YYYY-MM-DD 形式", () => {
    for (const e of entries) {
      if (e.updatedAt === undefined) continue;
      assert.match(e.updatedAt, /^\d{4}-\d{2}-\d{2}$/, `${e.id}: updatedAt 形式`);
    }
  });
});

describe("URL フィールド", () => {
  test("welnetUrl は http(s)", () => {
    for (const e of entries) {
      if (!e.welnetUrl) continue;
      assert.match(e.welnetUrl, /^https?:\/\//, `${e.id}: welnetUrl が不正`);
    }
  });

  test("extraLinks は {label,url} の配列で url は http(s)", () => {
    for (const e of entries) {
      if (e.extraLinks === undefined) continue;
      assert.ok(Array.isArray(e.extraLinks), `${e.id}: extraLinks が配列でない`);
      for (const l of e.extraLinks) {
        assert.equal(typeof l.label, "string", `${e.id}: extraLinks.label`);
        assert.match(l.url, /^https?:\/\//, `${e.id}: extraLinks.url が不正`);
      }
    }
  });
});

describe("タグ語彙の整合", () => {
  test("全エントリのタグが app.js の定義語彙に含まれる(全角/半角の取り違え検出)", () => {
    const known = knownTagVocabulary();
    const unknown = new Set();
    for (const e of entries) {
      for (const t of e.tags) if (!known.has(t)) unknown.add(`${t} (${e.id})`);
    }
    assert.equal(unknown.size, 0, "未知タグ:\n  " + [...unknown].join("\n  "));
  });
});

describe("既知の整理済み事項(リグレッション防止)", () => {
  test("e95 は e96 に統合済みで存在しない", () => {
    assert.ok(!entries.some((e) => e.id === "e95"));
  });
  test("e120 の概要に『特別支援教育就学奨励費』が含まれ、対応する extraLink がある", () => {
    const e120 = entries.find((e) => e.id === "e120");
    assert.ok(e120, "e120 が無い");
    assert.match(e120.overview, /特別支援教育就学奨励費/);
    assert.ok((e120.extraLinks || []).some((l) => /就学奨励費/.test(l.label)));
  });
});
