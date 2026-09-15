/* =========================================================
   data-store.js
   -----------------------------------------------------------
   このファイルは「データの読み込み」だけを担当します。
   UI(app.js)は、ここで定義された関数の名前と戻り値の形だけを
   知っていればよく、取得方法の実装は意識しません。

   このアプリは検索専用(読み取り専用)です。データの追加・修正は
   data/entries.json を直接編集してコミットする運用に統一しています。

   【将来:アプリ内からの編集を復活させる場合】
     ブラウザだけでは全員に反映される保存先を持てないため、
     簡単なAPIサーバー(Node.js + Express など)を用意し、
     この関数の中身を fetch('/api/entries') 呼び出しに書き換える形になります。
     例:
       async function loadEntries(){
         const res = await fetch('/api/entries');
         return await res.json();
       }
   ========================================================= */

const DataStore = (() => {
  async function loadEntries() {
    try {
      const res = await fetch("data/entries.json");
      if (!res.ok) throw new Error("entries.json の取得に失敗しました");
      return JSON.parse(await res.text());
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  return { loadEntries };
})();
