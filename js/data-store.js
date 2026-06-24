/* =========================================================
   data-store.js
   -----------------------------------------------------------
   このファイルは「データの読み書き」だけを担当します。
   UI(app.js)は、ここで定義された関数の名前と戻り値の形だけを
   知っていればよく、保存先の実装は意識しません。

   【現在の実装】
     ブラウザの localStorage に保存します。
     - 1人で開発・動作確認する分には十分です。
     - ただし保存先はその人のブラウザの中だけなので、
       他の人とは自動的には共有されません。
     - 「JSONを書き出す」ボタンで現在のデータをファイルに
       保存し、それを data/entries.json に上書きして
       Gitにコミットすれば、チームで共有できます。

   【将来:本当に全相談員で共有する場合】
     下記の関数の中身を fetch() で自分たちのAPIを呼ぶ処理に
     書き換えるだけで、UI側のコードは変更不要です。
     例:
       async function loadEntries(){
         const res = await fetch('/api/entries');
         return await res.json();
       }
       async function saveEntries(entries){
         await fetch('/api/entries', {
           method: 'PUT',
           headers: {'Content-Type':'application/json'},
           body: JSON.stringify(entries)
         });
       }
   ========================================================= */

const DataStore = (() => {
  const STORAGE_KEY = "fukushi-navi-entries-v4";

  // 初回だけ data/entries.json を読み込んで localStorage に保存する
  async function seedFromFileIfNeeded() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return JSON.parse(existing);

    try {
      const res = await fetch("data/entries.json");
      if (!res.ok) throw new Error("entries.json の取得に失敗しました");
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    } catch (e) {
      console.error(e);
      // fetch自体ができない環境(file://を直接開いた場合など)のための最終フォールバック
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
  }

  async function loadEntries() {
    return await seedFromFileIfNeeded();
  }

  async function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  // 現在のデータをJSONファイルとしてダウンロードする
  function exportEntries(entries) {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `entries-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // JSONファイルを読み込んでデータを置き換える
  function importEntriesFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Array.isArray(data)) throw new Error("JSONの形式が正しくありません(配列である必要があります)");
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, "utf-8");
    });
  }

  function resetToSeed() {
    localStorage.removeItem(STORAGE_KEY);
    return seedFromFileIfNeeded();
  }

  return { loadEntries, saveEntries, exportEntries, importEntriesFromFile, resetToSeed };
})();
