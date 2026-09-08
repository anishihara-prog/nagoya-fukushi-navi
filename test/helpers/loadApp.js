/* テスト用ヘルパー: index.html + data-store.js + app.js を jsdom に読み込み、
   init() 完了後の window / document と、グローバル字句束縛へアクセスする eval を返す。
   本番コードは一切改変しない(スクリプトタグを外して手動注入するだけ)。 */
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

async function loadApp({ entriesJson } = {}) {
  const html = read("index.html")
    .replace('<script src="js/data-store.js"></script>', "")
    .replace('<script src="js/app.js"></script>', "");
  const dataStoreJs = read("js/data-store.js");
  const appJs = read("js/app.js");
  const entries = entriesJson ?? read("data/entries.json");

  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => {
    if (/Not implemented/.test(e.message)) return; // scrollIntoView 等は無視
    throw e;
  });

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
    virtualConsole,
  });
  const { window } = dom;
  const { document } = window;

  // fetch と スクロール系のスタブ
  window.fetch = async (url) => {
    if (String(url).includes("entries.json")) {
      return { ok: true, text: async () => entries };
    }
    return { ok: false, status: 404, text: async () => "" };
  };
  window.Element.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
  window.scrollTo = () => {};

  const inject = (code) => {
    const s = document.createElement("script");
    s.textContent = code;
    document.body.appendChild(s);
  };
  inject(dataStoreJs);
  inject(appJs);

  // init() は async。state.entries が入るまで待つ
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const n = window.eval("Array.isArray(state.entries) ? state.entries.length : 0");
    if (n > 0) break;
    await new Promise((r) => setTimeout(r, 5));
  }

  // グローバル字句束縛(state, getChatResults 等)を評価する。
  // 戻り値は JSON ラウンドトリップして Node realm 側のプレーン値にする
  // (jsdom realm の配列/オブジェクトは prototype が異なり deepStrictEqual が通らないため)。
  const G = (expr) => {
    const v = window.eval(expr);
    if (v === undefined || typeof v === "function") return v;
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return v;
    }
  };
  const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));

  return { dom, window, document, G, wait };
}

/** ケース相談タブを開いて質問フローを最後まで回す。
 *  answers 未指定時は「成人/精神障害/精神手帳/中程度/区スキップ/まず相談先を探したい」。 */
async function runChatFlow(ctx, answers = {}) {
  const { document, window, wait } = ctx;
  const a = {
    age: "成人（18〜64歳）",
    disability: ["精神障害"],
    certificate: "精神障害者保健福祉手帳あり",
    severity: "中程度（多くの場面でサポートが必要）",
    ward: null, // null ならスキップ
    situation: "まず相談先を探したい",
    followup: null,
    ...answers,
  };
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const opt = (label) => {
    const b = [...document.querySelectorAll(".chat-option-btn[data-option]")].find(
      (x) => x.dataset.option === label
    );
    if (!b) {
      const avail = [...document.querySelectorAll(".chat-option-btn[data-option]")]
        .map((x) => x.dataset.option)
        .join(" / ");
      throw new Error(`選択肢が無い: "${label}"  候補: ${avail}`);
    }
    click(b);
  };
  const byId = (id) => {
    const b = document.getElementById(id);
    if (!b) throw new Error(`#${id} が無い`);
    click(b);
  };

  click(document.querySelector('[data-tab="chat"]'));
  await wait();

  opt(a.age);
  await wait();

  a.disability.forEach(opt);
  await wait();
  byId("btn-multi-next");
  await wait();

  opt(a.certificate);
  await wait();

  opt(a.severity);
  await wait();

  if (a.ward) {
    const sel = document.getElementById("chat-select-input");
    sel.value = a.ward;
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    byId("btn-text-next");
  } else {
    byId("btn-text-skip");
  }
  await wait();

  opt(a.situation);
  await wait(10);

  if (a.followup) {
    opt(a.followup);
    await wait(10);
  }
}

module.exports = { loadApp, runChatFlow, ROOT };
