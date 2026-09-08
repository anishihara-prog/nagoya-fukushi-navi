/* 統合テスト: data-store.js の localStorage キャッシュ挙動。 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("../helpers/loadApp");

describe("seedFromFileIfNeeded / resetToSeed", () => {
  test("初回読み込みで localStorage にシードされる", async () => {
    const { window, G } = await loadApp();
    const key = "fukushi-navi-entries-v4";
    assert.ok(window.localStorage.getItem(key), "エントリがキャッシュされていない");
    assert.ok(window.localStorage.getItem(key + "-source"), "ソーススナップショットが無い");
    assert.equal(
      JSON.parse(window.localStorage.getItem(key)).length,
      G("state.entries.length")
    );
  });

  test("2回目の loadEntries はキャッシュを返す(ファイル内容が同じなら)", async () => {
    const { window } = await loadApp();
    // ローカル編集を1件加えて保存 → 再読込でその編集が保持される
    await window.eval(`(async () => {
      const list = await DataStore.loadEntries();
      list[0].name = "___EDITED___";
      await DataStore.saveEntries(list);
    })()`);
    const again = await window.eval(`DataStore.loadEntries()`);
    assert.equal(again[0].name, "___EDITED___");
  });

  test("resetToSeed でキャッシュが破棄されファイル内容に戻る", async () => {
    const { window } = await loadApp();
    await window.eval(`(async () => {
      const list = await DataStore.loadEntries();
      list[0].name = "___EDITED___";
      await DataStore.saveEntries(list);
    })()`);
    const reset = await window.eval(`DataStore.resetToSeed()`);
    assert.notEqual(reset[0].name, "___EDITED___");
  });
});
