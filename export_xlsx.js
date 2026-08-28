const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const root = __dirname;
const entries = JSON.parse(fs.readFileSync(path.join(root, "data/entries.json"), "utf8"));
const outPath = path.join(root, "entries_export.xlsx");

const columns = [
  ["id", "ID"],
  ["type", "分類"],
  ["name", "名称"],
  ["serviceCodes", "サービスコード"],
  ["target", "対象者"],
  ["overview", "概要"],
  ["procedure", "手続き"],
  ["documents", "必要書類"],
  ["contact", "問い合わせ先"],
  ["notes", "備考"],
  ["welnetUrl", "ウェルネットなごやURL"],
  ["tags", "タグ"],
  ["wardDataType", "区別データ種別"],
  ["updatedBy", "更新元"],
  ["updatedAt", "更新日"],
  ["sortOrder", "並び順"],
];
const COL_WIDTHS = [6, 10, 32, 12, 34, 42, 34, 26, 30, 30, 34, 30, 12, 14, 12, 8];

function toCellValues(e) {
  return columns.map(([key]) => {
    const v = e[key];
    if (Array.isArray(v)) return v.join(", ");
    return v === undefined || v === null ? "" : v;
  });
}

async function main() {
  const wb = new ExcelJS.Workbook();
  let ws;
  let existingIds = new Map(); // id -> row number

  if (fs.existsSync(outPath)) {
    await wb.xlsx.readFile(outPath);
    ws = wb.getWorksheet("項目一覧") || wb.worksheets[0];
    for (let r = 2; r <= ws.rowCount; r++) {
      const idVal = ws.getRow(r).getCell(1).value;
      if (idVal) existingIds.set(String(idVal), r);
    }
    console.log(`既存ファイルを読み込みました(${existingIds.size}行、書式を保持します)`);
  } else {
    wb.creator = "nagoya-fukushi-navi";
    ws = wb.addWorksheet("項目一覧");
    ws.addRow(columns.map((c) => c[1]));
    ws.getRow(1).font = { bold: true };
    ws.columns = COL_WIDTHS.map((w) => ({ width: w }));
    console.log("既存ファイルが無いため新規作成します");
  }

  const newIds = new Set(entries.map((e) => String(e.id)));
  let updated = 0;
  let added = 0;
  let removed = 0;

  // 既存行のうち、entries.json に無くなったIDの行を後ろから削除(行番号がずれないように)
  const rowsToRemove = [...existingIds.entries()]
    .filter(([id]) => !newIds.has(id))
    .map(([, r]) => r)
    .sort((a, b) => b - a);
  for (const r of rowsToRemove) {
    ws.spliceRows(r, 1);
    removed++;
  }
  if (removed > 0) {
    // 削除後は行番号がずれるため、IDマップを作り直す
    existingIds = new Map();
    for (let r = 2; r <= ws.rowCount; r++) {
      const idVal = ws.getRow(r).getCell(1).value;
      if (idVal) existingIds.set(String(idVal), r);
    }
  }

  for (const e of entries) {
    const id = String(e.id);
    const values = toCellValues(e);
    if (existingIds.has(id)) {
      const r = existingIds.get(id);
      const row = ws.getRow(r);
      values.forEach((v, i) => {
        row.getCell(i + 1).value = v; // 値だけ差し替え、既存の書式(セルの色等)はそのまま
      });
      row.commit();
      updated++;
    } else {
      const row = ws.addRow(values);
      row.commit();
      added++;
    }
  }

  await wb.xlsx.writeFile(outPath);
  console.log(`書き出し完了: 更新${updated}件, 追加${added}件, 削除${removed}件, 合計${entries.length}件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
