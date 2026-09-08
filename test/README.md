# テスト

素の静的サイト（ビルドなし）なので、テストランナーは Node 標準の `node --test`、
DOM は jsdom、E2E は Playwright を使う。**本番コード（`js/*.js`）は改変していない** —
jsdom 側で `index.html` からスクリプトタグを外し、`js/data-store.js` → `js/app.js`
の順に手動注入して `fetch` をスタブしている（`test/helpers/loadApp.js`）。

## 実行方法

```bash
npm install            # 初回のみ（jsdom, @playwright/test）
npx playwright install chromium   # E2E を回すなら初回のみ

npm test               # ユニット + 統合 + データ整合（jsdom、ブラウザ不要）
npm run test:unit
npm run test:integration
npm run test:data
npm run test:e2e       # Playwright（内部で `npx serve -l 4173 .` を起動）
npm run test:all       # 上記すべて
```

## 構成

| 階層 | 場所 | 内容 |
|---|---|---|
| ユニット | `test/unit/` | `app.js` の純粋関数（`normalizeForSearch` / `formatGradeLevels` / `substituteWard` / `escapeHtml`）と `getChatResults()` の絞り込みロジック（年代・障害種別のハード条件、困りごと必須、スコアしきい値、`重複・不明` の扱い、並び順） |
| 統合 | `test/integration/` | jsdom 上でタブ操作・描画を検証。ケース相談フル、カテゴリー別グループの折り畳み、詳細カード開閉、検索タブ（キーワード / 種別チップ / 等級フィルタ）、`data-store` の localStorage キャッシュ |
| データ整合 | `test/data/` | `data/entries.json` の構造（id 一意・必須項目・type・URL 形式・extraLinks 形状・pretty-print）、タグ語彙が `app.js` の定義と一致するか（全角/半角の取り違え検出）、整理済み事項のリグレッション防止 |
| E2E | `test/e2e/` | 実ブラウザ（Chromium）で検索と ケース相談の主要フロー |

## メモ

- jsdom は `scrollIntoView` 等を実装しないため、ヘルパーで no-op スタブしている。
- jsdom realm の配列は prototype が異なり `deepStrictEqual` が通らないので、
  ヘルパーの `G()` は評価結果を JSON ラウンドトリップして返す。
- `node --test` はテストごとに jsdom を新規生成するため、統合テストは 1 本あたり
  100〜300ms かかる（全体で 20 秒前後）。
