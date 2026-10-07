#!/usr/bin/env node
/*
 * data/entries.json 内のリンク(welnetUrl / extraLinks)を巡回し、
 * 前回チェック時との差分から次の3種類の変化を検知するスクリプト。
 *    - リンク切れ(HTTPエラー・到達不能)
 *    - リンク先URLの変更(リダイレクト先が変わった)
 *    - ページ本文の更新(本文テキストのハッシュが変わった)
 *
 * 【Gemini AI 連携】
 * ページ内容が更新された場合、GEMINI_API_KEY が存在すれば
 * Gemini API を使用して制度の重要変化（電話番号・対象条件・窓口等）があるかを自動分析する。
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const ENTRIES_PATH = path.join(ROOT, "data/entries.json");
const STATE_PATH = path.join(ROOT, "data/link-check-state.json");
const REPORT_PATH = path.join(ROOT, "link-check-report.md");

const REQUEST_TIMEOUT_MS = 20000;
const REQUEST_DELAY_MS = 500;
const USER_AGENT =
  "nagoya-fukushi-navi-link-checker/1.0 (+https://github.com/anishihara-prog/nagoya-fukushi-navi)";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// entries.json から {url: [{entryId, entryName, label}]} のマップを作る
function extractLinksFromEntries(entries) {
  const map = new Map();
  const add = (url, entryId, entryName, label) => {
    if (!url) return;
    if (!map.has(url)) map.set(url, []);
    map.get(url).push({ entryId, entryName, label });
  };
  for (const e of entries) {
    if (e.welnetUrl) add(e.welnetUrl, e.id, e.name, e.welnetUrlLabel || "ウェルネットで詳しく見る");
    for (const l of e.extraLinks || []) add(l.url, e.id, e.name, l.label || "関連ページ");
  }
  return map;
}

// HTML から比較用の本文テキストを取り出す
function extractVisibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(text) {
  return "sha256:" + crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function fetchLinkInfo(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "ja,en;q=0.5" },
    });
    const ok = res.ok;
    let contentHash = null;
    let textContent = "";
    if (ok) {
      const html = await res.text();
      textContent = extractVisibleText(html);
      contentHash = hashText(textContent);
    }
    return { ok, status: res.status, finalUrl: res.url || url, contentHash, textContent, error: null };
  } catch (err) {
    return { ok: false, status: null, finalUrl: null, contentHash: null, textContent: "", error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

// 前回状態 prev と今回状態 curr を比べて、変化の種類をタグの配列で返す
function classifyChange(prev, curr) {
  if (!prev) return ["new"];
  const tags = [];
  if (prev.ok && !curr.ok) tags.push("newBroken");
  else if (!prev.ok && !curr.ok) tags.push("stillBroken");
  if (!prev.ok && curr.ok) tags.push("fixed");

  const bothResolved = Boolean(prev.finalUrl) && Boolean(curr.finalUrl);
  const urlChanged = bothResolved && prev.finalUrl !== curr.finalUrl;
  if (urlChanged) tags.push("urlChanged");

  if (prev.ok && curr.ok && !urlChanged && prev.contentHash !== curr.contentHash) {
    tags.push("contentChanged");
  }
  return tags;
}

function refLabel(refs) {
  return refs.map((r) => `${r.entryId} ${r.entryName}`).join(" / ");
}

// Gemini API を呼び出して変更重要度を解析
async function analyzeContentWithGemini(url, refs, pageText, apiKey) {
  if (!apiKey || !pageText) return null;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const refNames = refs.map((r) => `${r.entryId}:${r.entryName}`).join(", ");
  
  const prompt = `あなたは福祉ナビゲーションアプリのデータメンテナです。
対象サービス: [${refNames}]
対象URL: ${url}

以下のWebページテキストを確認し、福祉サービス利用者や相談員にとって重要な変更（例: 申請条件・電話番号・担当窓口・金額・受付時間などの変更や制度廃止）が含まれている可能性があるか判定してください。
単なるデザイン変更、定例の年度更新（年号のみ変更）、新着ニュース一覧の更新など、実質的な制度情報に変化がない場合は「対応不要」としてください。

【Webページテキスト（抜粋）】
${pageText.slice(0, 3000)}

【回答フォーマット】
以下の形式で簡潔に1行で出力してください（マークダウンの箇条書き等の余計な文字は不要です）。
ステータス: [要対応 / 対応不要 / 要確認] | 理由: (1〜2文で具体的に解説)`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

function buildReport(results, aiAnalysisMap = {}) {
  const byTag = (tag) => results.filter((r) => r.tags.includes(tag));
  const newBroken = byTag("newBroken");
  const stillBroken = byTag("stillBroken");
  const fixed = byTag("fixed");
  const urlChanged = byTag("urlChanged");
  const contentChanged = byTag("contentChanged");
  const isNew = byTag("new");
  const unchanged = results.filter((r) => r.tags.length === 0);

  const hasChanges = newBroken.length + fixed.length + urlChanged.length + contentChanged.length > 0;

  const lines = [];
  lines.push("# リンクチェック結果");
  lines.push("");
  lines.push(`対象リンク数: ${results.length}件`);
  lines.push("");

  const section = (title, list, describe) => {
    if (list.length === 0) return;
    lines.push(`## ${title} (${list.length}件)`);
    for (const r of list) {
      lines.push(`- ${describe(r)}`);
      lines.push(`  関連: ${refLabel(r.refs)}`);
      if (aiAnalysisMap[r.url]) {
        lines.push(`  └ 🤖 **AI判定**: ${aiAnalysisMap[r.url]}`);
      }
    }
    lines.push("");
  };

  section(
    "⚠️ リンク切れの疑い(新規)",
    newBroken,
    (r) => `${r.url} → status: ${r.curr.status ?? "取得失敗"}${r.curr.error ? ` (${r.curr.error})` : ""}`
  );
  section("🔀 リンク先URLが変わった可能性", urlChanged, (r) => `${r.url} → 現在の到達先: ${r.curr.finalUrl}`);
  section("📝 ページ内容が更新された可能性", contentChanged, (r) => r.url);
  section("✅ 復旧しました", fixed, (r) => r.url);
  section(
    "🔁 引き続きリンク切れ(既知・要対応)",
    stillBroken,
    (r) => `${r.url} → status: ${r.curr.status ?? "取得失敗"}${r.curr.error ? ` (${r.curr.error})` : ""}`
  );

  lines.push(`変化なし: ${unchanged.length}件 / 初回チェック: ${isNew.length}件`);
  lines.push("");

  return { text: lines.join("\n"), hasChanges };
}

async function main() {
  const entries = JSON.parse(fs.readFileSync(ENTRIES_PATH, "utf8"));
  const linkMap = extractLinksFromEntries(entries);
  const prevState = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) : {};

  const apiKey = process.env.GEMINI_API_KEY;
  const nextState = {};
  const results = [];
  const aiAnalysisMap = {};
  const urls = [...linkMap.keys()].sort();

  for (const url of urls) {
    const curr = await fetchLinkInfo(url);
    nextState[url] = { finalUrl: curr.finalUrl, ok: curr.ok, status: curr.status, contentHash: curr.contentHash };
    const tags = classifyChange(prevState[url], nextState[url]);
    results.push({ url, refs: linkMap.get(url), curr, tags });

    // ページ更新が検知され、かつ GEMINI_API_KEY がセットされている場合は AI 判定を実行
    if (tags.includes("contentChanged") && apiKey && curr.textContent) {
      console.log(`[AI Analysis] Analyzing ${url}...`);
      const analysis = await analyzeContentWithGemini(url, linkMap.get(url), curr.textContent, apiKey);
      if (analysis) {
        aiAnalysisMap[url] = analysis;
      }
      await delay(1000); // API レートリミット対策
    } else {
      await delay(REQUEST_DELAY_MS);
    }
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify(nextState, null, 2) + "\n");

  const report = buildReport(results, aiAnalysisMap);
  console.log(report.text);
  fs.writeFileSync(REPORT_PATH, report.text);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_changes=${report.hasChanges}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.text + "\n");
  }
}

module.exports = { extractLinksFromEntries, extractVisibleText, hashText, classifyChange, buildReport };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}