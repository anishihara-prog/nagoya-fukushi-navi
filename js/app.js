/* =========================================================
   app.js ― UIロジック本体 (2026-06-24)
   ========================================================= */

// ---------- 各区 基幹相談支援センター 情報 ----------
const WARD_KIKAN_INFO = {
  "千種区": { tel: "052-753-3567", url: "http://www.chikusa1.info/center/center1.html" },
  "東区":   { tel: "052-325-6193", url: "https://higashi-kikan.com/" },
  "北区":   { tel: "052-910-3133", url: "https://nagoyakita-kikancenter.jp/" },
  "西区":   { tel: "052-504-2102", url: "https://www.nishiku-kyougikai.com/nishikukikansoudansien/" },
  "中村区": { tel: "052-462-1500", url: "https://shin-ai1996.org/nagoya/nakamura" },
  "中区":   { tel: "052-253-5855", url: "https://mutsumi-f.jp/naka-center/" },
  "昭和区": { tel: "052-741-8800", url: "https://aju-cil.com/talk/johoc/supportcenter.html" },
  "瑞穂区": { tel: "052-680-7111", url: "https://www.city.nagoya.jp/kenkofukushi/shougaisha/1016662/1016664.html" },
  "熱田区": { tel: "052-228-3630", url: "https://www.nagoya-rehab.or.jp/1002864/1002870.html" },
  "中川区": { tel: "052-354-4521", url: "https://nagoyaikuseikai.or.jp/ikuseikaijigyousyo/" },
  "港区":   { tel: "052-653-2801", url: "https://nagoya-lighthouse.jp/kikan/" },
  "南区":   { tel: "052-883-9257", url: "http://minamiku-kyogikai.nagoya/?page_id=323" },
  "守山区": { tel: "052-737-0221", url: "https://www.ne.jp/asahi/moriyama/shien/" },
  "緑区":   { tel: "052-892-6333", url: "https://www.city.nagoya.jp/kenkofukushi/shougaisha/1016662/1016664.html" },
  "名東区": { tel: "052-739-7524", url: "https://www.city.nagoya.jp/kenkofukushi/shougaisha/1016662/1016664.html" },
  "天白区": { tel: "052-804-8587", url: "https://www.city.nagoya.jp/kenkofukushi/shougaisha/1016662/1016664.html" },
};

// ---------- 各区 区役所 福祉課（障害担当）電話番号 ----------
const WARD_KUYAKUSHO_INFO = {
  "千種区": { tel: "052-753-1844" },
  "東区":   { tel: "052-934-1182" },
  "北区":   { tel: "052-917-6516" },
  "西区":   { tel: "052-523-4585" },
  "中村区": { tel: "052-433-2932" },
  "中区":   { tel: "052-265-2322" },
  "昭和区": { tel: "052-735-3893" },
  "瑞穂区": { tel: "052-852-9384" },
  "熱田区": { tel: "052-683-9917" },
  "中川区": { tel: "052-363-4403" },
  "港区":   { tel: "052-654-9718" },
  "南区":   { tel: "052-823-9392" },
  "守山区": { tel: "052-796-4584" },
  "緑区":   { tel: "052-625-3956" },
  "名東区": { tel: "052-778-3092" },
  "天白区": { tel: "052-807-3882" },
};

// ---------- サービス種別コード参照表 ----------
const SERVICE_CODE_MAP = {
  "11": "居宅介護",
  "12": "重度訪問介護",
  "13": "同行援護",
  "14": "行動援護",
  "15": "療養介護",
  "16": "生活介護",
  "20": "短期入所",
  "22": "重度障害者等包括支援",
  "31": "施設入所支援",
  "41": "自立訓練(機能訓練)",
  "42": "自立訓練(生活訓練)",
  "43": "就労移行支援",
  "44": "就労継続支援A型",
  "45": "就労継続支援B型",
  "46": "就労定着支援",
  "51": "共同生活援助",
  "61": "計画相談支援",
  "62": "地域移行支援",
  "63": "地域定着支援",
  "65": "自立生活援助",
  "71": "児童発達支援",
  "73": "放課後等デイサービス",
  "74": "保育所等訪問支援",
  "75": "居宅訪問型児童発達支援",
  "76": "障害児相談支援",
};

// ---------- ケース相談 質問フロー ----------
const CHAT_FLOW = [
  {
    id: "age",
    botText: "相談者の年代を教えてください。",
    type: "single",
    options: [
      { label: "児童（〜17歳）",    tags: ["児童(〜17歳)"] },
      { label: "成人（18〜64歳）",  tags: ["成人(18〜64歳)"] },
      { label: "65歳以上",          tags: ["65歳以上"] },
    ],
  },
  {
    id: "disability",
    botText: "障害の種別を教えてください（複数選択可）。",
    type: "multi",
    options: [
      { label: "身体障害",   tags: ["身体障害"] },
      { label: "知的障害",   tags: ["知的障害"] },
      { label: "精神障害",   tags: ["精神障害"] },
      { label: "発達障害",   tags: ["発達障害"] },
      { label: "難病",       tags: ["難病"] },
      { label: "不明・複数", tags: ["重複・不明"] },
    ],
  },
  {
    id: "certificate",
    botText: "障害者手帳はお持ちですか？",
    type: "single",
    options: [
      { label: "身体障害者手帳あり",            tags: ["身体障害者手帳あり"] },
      { label: "愛護手帳（療育手帳）あり",      tags: ["愛護手帳あり"] },
      { label: "精神障害者保健福祉手帳あり",    tags: ["精神障害者保健福祉手帳あり"] },
      { label: "手帳はない・まだ未申請",        tags: ["手帳なし・未申請"] },
    ],
  },
  {
    id: "severity",
    botText: "日常生活での介護・支援の必要度を教えてください。",
    type: "single",
    options: [
      { label: "ほぼ自立（一部サポートで生活できる）",  tags: [] },
      { label: "中程度（多くの場面でサポートが必要）",   tags: [] },
      { label: "重度（常時介護・強い行動障害がある）",   tags: [] },
    ],
  },
  {
    id: "ward",
    botText: "お住まいの区を教えてください（窓口の問合せ先に使います。スキップも可）。",
    type: "select",
    options: [
      "千種区", "東区", "北区", "西区", "中村区", "中区",
      "昭和区", "瑞穂区", "熱田区", "中川区", "港区", "南区",
      "守山区", "緑区", "名東区", "天白区",
    ],
  },
  {
    id: "situation",
    botText: "今、一番お困りのこと・希望を教えてください。",
    type: "single",
    options: [
      { label: "仕事がしたい・就労したい",            tags: ["就労の支援"],            followup: "work" },
      { label: "日中の活動の場がほしい",              tags: ["日中の活動先"],          followup: "day" },
      { label: "自宅での生活支援がほしい",            tags: ["在宅での生活支援"],      followup: "home" },
      { label: "外出・移動のサポートがほしい",        tags: ["外出・移動の支援"],      followup: null },
      { label: "住む場所（グループホーム等）を探している", tags: ["住まい(グループホーム等)"], followup: null },
      { label: "医療費を減らしたい",                  tags: ["医療・医療費"],          followup: null },
      { label: "手帳を取りたい・更新したい",          tags: ["手帳の取得・更新"],      followup: null },
      { label: "年金・手当のことを知りたい",          tags: ["年金・手当などお金"],    followup: null },
      { label: "緊急で困っている",                    tags: ["緊急時の対応"],          followup: null },
      { label: "まず相談先を探したい",                tags: ["相談先を探したい"],      followup: null },
    ],
  },
];

// ---------- 深掘り質問（困りごとに応じて1問） ----------
const FOLLOWUP_MAP = {
  work: {
    botText: "就労について、もう少し教えてください。",
    type: "single",
    options: [
      { label: "一般企業への就職を目指したい",              addTags: [] },
      { label: "支援を受けながら働く福祉的就労でよい",      addTags: [] },
      { label: "すでに就職済み・職場定着が不安",            addTags: [] },
    ],
    hint: {
      "一般企業への就職を目指したい":          "就労移行支援(コード43)が主な選択肢です。就職後は就労定着支援(コード46)も利用できます。",
      "支援を受けながら働く福祉的就労でよい":  "就労継続支援B型(コード45)またはA型(コード44)が主な選択肢です。",
      "すでに就職済み・職場定着が不安":        "就労定着支援(コード46)が利用できます。就労移行支援等を経て就職後6ヶ月から利用可能です。",
    },
  },
  day: {
    botText: "日中活動について、もう少し教えてください。",
    type: "single",
    options: [
      { label: "作業や軽労働ができる（就労継続支援）",      addTags: [] },
      { label: "介護を受けながら活動したい（生活介護）",    addTags: [] },
      { label: "訓練・リハビリがしたい（自立訓練）",        addTags: [] },
    ],
    hint: {
      "作業や軽労働ができる（就労継続支援）":    "就労継続支援B型(コード45)が適しています。能力によってはA型(コード44)も検討できます。",
      "介護を受けながら活動したい（生活介護）":  "生活介護(コード16)が主な選択肢です。障害支援区分3以上が目安です。",
      "訓練・リハビリがしたい（自立訓練）":      "自立訓練 機能訓練(コード41)または生活訓練(コード42)が利用できます。",
    },
  },
  home: {
    botText: "在宅での支援について、もう少し教えてください。",
    type: "single",
    options: [
      { label: "家事・身体介護のヘルパーがほしい",              addTags: [] },
      { label: "介護者が一時的にいない・短期入所が必要",        addTags: ["緊急時の対応"] },
    ],
    hint: {
      "家事・身体介護のヘルパーがほしい":            "居宅介護(コード11)が利用できます。重度の方は重度訪問介護(コード12)も対象となる場合があります。",
      "介護者が一時的にいない・短期入所が必要":      "短期入所(コード20: ショートステイ)が利用できます。緊急の場合は基幹相談支援センターへの相談もお勧めします。",
    },
  },
};

// ---------- タグの分類(編集フォームで共通利用) ----------
const TYPE_OPTIONS = ["すべて", "サービス", "制度", "手続き", "相談窓口"];

const TAG_GROUPS = {
  disability: {
    label: "障害種別(複数選択可)",
    tags: ["身体障害", "知的障害", "精神障害", "発達障害", "難病", "重複・不明"],
  },
  age: {
    label: "年代",
    tags: ["児童(〜17歳)", "成人(18〜64歳)", "65歳以上"],
  },
  certificate: {
    label: "手帳の状況(複数選択可)",
    tags: ["身体障害者手帳あり", "愛護手帳あり", "精神障害者保健福祉手帳あり", "手帳なし・未申請"],
  },
  situation: {
    label: "お困りのこと・場面(複数選択可)",
    tags: [
      "相談先を探したい", "在宅での生活支援", "外出・移動の支援", "日中の活動先",
      "住まい(グループホーム等)", "就労の支援", "年金・手当などお金", "医療・医療費",
      "手帳の取得・更新", "緊急時の対応",
    ],
  },
};

// ---------- アプリの状態 ----------
const state = {
  entries: [],
  activeTab: "search",
  searchKeyword: "",
  searchType: "すべて",
  expandedId: null,
  chat: null,
};

const appEl = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const toastRoot = document.getElementById("toast-root");

// ---------- 初期化 ----------
async function init() {
  state.entries = await DataStore.loadEntries();
  bindTabbar();
  render();
}
init();

function bindTabbar() {
  document.querySelectorAll(".tabbar__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      state.expandedId = null;
      document.querySelectorAll(".tabbar__btn").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      render();
    });
  });
}

// ---------- レンダリング振り分け ----------
function render() {
  if (state.activeTab === "search") return renderSearchTab();
  if (state.activeTab === "chat")   return renderChatTab();
  if (state.activeTab === "manage") return renderManageTab();
}

// =====================================================
// 🔍 検索タブ
// =====================================================
function renderSearchTab() {
  const kw = state.searchKeyword.trim();
  let list = state.entries.filter((e) => {
    if (state.searchType !== "すべて" && e.type !== state.searchType) return false;
    if (!kw) return true;
    const codes = (e.serviceCodes || []).join(" ");
    const codeNames = (e.serviceCodes || []).map(c => SERVICE_CODE_MAP[c] || "").join(" ");
    const hay = normalizeForSearch([e.name, e.overview, e.target, codes, codeNames, ...(e.tags || [])].join(" "));
    return hay.includes(normalizeForSearch(kw));
  });
  list = list.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  appEl.innerHTML = `
    <div class="search-row">
      <input id="search-input" class="search-input" type="text" placeholder="サービス名・コード番号・キーワードで検索(例: 11, グループホーム)" value="${escapeAttr(state.searchKeyword)}">
    </div>
    <div class="chip-row" id="type-chip-row">
      ${TYPE_OPTIONS.map((t) => `<button class="type-chip ${t === state.searchType ? "is-active" : ""}" data-type="${t}">${t}</button>`).join("")}
    </div>
    <div id="search-results">${list.length ? list.map((e) => entryCardHtml(e)).join("") : emptyStateHtml("「" + (kw || "条件") + "」に一致する情報が見つかりません。")}</div>
  `;

  document.getElementById("search-input").addEventListener("input", (ev) => {
    state.searchKeyword = ev.target.value;
    renderSearchTab();
    const input = document.getElementById("search-input");
    input.focus();
    input.selectionStart = input.selectionEnd = input.value.length;
  });
  document.querySelectorAll("#type-chip-row .type-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.searchType = btn.dataset.type;
      renderSearchTab();
    });
  });
  bindCardEvents();
}

// =====================================================
// 💬 ケース相談タブ
// =====================================================
function initChat() {
  state.chat = {
    phase: "question",   // "question" | "followup" | "done"
    stepIndex: 0,
    collectedTags: new Set(),
    multiTemp: new Set(),
    followupKey: null,
    ward: "",
    snapshots: [],
    history: [
      { role: "bot", text: "相談者のプロフィールをもとに、利用できるサービスを一緒に考えます。" },
      { role: "bot", text: CHAT_FLOW[0].botText },
    ],
  };
}

function renderChatTab() {
  if (!state.chat) initChat();
  const chat = state.chat;

  // 現在の質問ステップ
  const currentStep = chat.phase === "followup"
    ? FOLLOWUP_MAP[chat.followupKey]
    : (chat.phase === "question" ? CHAT_FLOW[chat.stepIndex] : null);

  // 過去のメッセージ
  const historyHtml = chat.history.map(msg =>
    msg.role === "bot"
      ? `<div class="chat-msg chat-msg--bot">
           <div class="chat-avatar">🤝</div>
           <div class="chat-bubble">${escapeHtml(msg.text)}</div>
         </div>`
      : `<div class="chat-msg chat-msg--user">
           <div class="chat-bubble">${escapeHtml(msg.text)}</div>
         </div>`
  ).join("");

  // 現在の選択肢
  let inputHtml = "";
  if (currentStep && chat.phase !== "done") {
    if (currentStep.type === "select") {
      inputHtml = `
        <div class="chat-text-area">
          <select id="chat-select-input" class="chat-select-input">
            <option value="">── 区を選んでください ──</option>
            ${(currentStep.options || []).map(o =>
              `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`
            ).join("")}
          </select>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn--primary" id="btn-text-next" disabled>次へ →</button>
            <button class="btn btn--ghost" id="btn-text-skip">スキップ</button>
          </div>
        </div>`;
    } else if (currentStep.type === "multi") {
      inputHtml = `
        <div class="chat-options">
          ${currentStep.options.map(opt =>
            `<button class="chat-option-btn ${chat.multiTemp.has(opt.label) ? "is-selected" : ""}" data-option="${escapeAttr(opt.label)}">${escapeHtml(opt.label)}</button>`
          ).join("")}
        </div>
        <div class="chat-multi-footer">
          <button class="btn btn--primary" id="btn-multi-next" ${chat.multiTemp.size === 0 ? "disabled" : ""}>次へ →</button>
        </div>`;
    } else {
      inputHtml = `
        <div class="chat-options">
          ${currentStep.options.map(opt =>
            `<button class="chat-option-btn" data-option="${escapeAttr(opt.label)}">${escapeHtml(opt.label)}</button>`
          ).join("")}
        </div>`;
    }
  }

  // 結果
  let resultsHtml = "";
  if (chat.phase === "done") {
    const matched = getChatResults();
    const wardLabel = chat.ward ? `📍 ${escapeHtml(chat.ward)} / ` : "";
    resultsHtml = `
      <hr class="chat-divider">
      <div class="chat-results__header">${wardLabel}利用できる可能性のあるサービス（${matched.length}件）</div>
      ${matched.length
        ? matched.map(e => {
            let display = chat.ward
              ? { ...e, contact: substituteWard(e.contact, chat.ward) }
              : e;
            // 区が選択されている場合、基幹相談支援センターを区別の情報に差し替え
            if (chat.ward && e.wardDataType === "kikan") {
              const info = WARD_KIKAN_INFO[chat.ward];
              if (info) {
                display = {
                  ...display,
                  contact: `${chat.ward}の障害者基幹相談支援センター\n☎ ${info.tel}\n（市全体の案内: 障害者支援課 052-972-2596）`,
                  welnetUrl: info.url,
                };
              }
            }
            // 区が選択されている場合、区役所 福祉課の連絡先に区別の電話番号を補完
            if (chat.ward && e.contact && e.contact.includes("区役所 福祉課")) {
              const info = WARD_KUYAKUSHO_INFO[chat.ward];
              if (info) {
                display = {
                  ...display,
                  contact: display.contact.replace(
                    chat.ward + "役所 福祉課",
                    `${chat.ward}役所 福祉課（障害担当） ☎ ${info.tel}`
                  ),
                };
              }
            }
            return entryCardHtml(display);
          }).join("")
        : emptyStateHtml("条件に合うサービスが見つかりませんでした。検索タブからキーワードで探すか、基幹相談支援センターにご相談ください。")}
      <button class="btn btn--ghost" id="btn-chat-restart" style="width:100%;margin-top:12px;">↺ 最初からやり直す</button>`;
  }

  const backHtml = chat.snapshots.length > 0
    ? `<div class="chat-back-row">
         <button class="btn btn--sm btn--ghost" id="btn-chat-back">← 前の質問に戻る</button>
       </div>`
    : "";

  appEl.innerHTML = `
    <div class="chat-wrap">
      ${historyHtml}
      ${inputHtml}
      ${backHtml}
      ${resultsHtml}
      <div id="chat-bottom"></div>
    </div>`;

  // イベント: 区選択ドロップダウン
  const selectEl = document.getElementById("chat-select-input");
  const textNextBtn = document.getElementById("btn-text-next");
  selectEl?.addEventListener("change", () => {
    if (textNextBtn) textNextBtn.disabled = !selectEl.value;
  });
  textNextBtn?.addEventListener("click", () => {
    const val = selectEl?.value || "";
    if (val) chat.ward = val;
    handleChatTextNext(val || null);
  });
  document.getElementById("btn-text-skip")?.addEventListener("click", () => {
    handleChatTextNext(null);
  });

  // イベント: シングル選択
  document.querySelectorAll(".chat-option-btn[data-option]").forEach(btn => {
    if (currentStep && currentStep.type !== "multi") {
      btn.addEventListener("click", () => handleChatSelect(btn.dataset.option));
    } else {
      btn.addEventListener("click", () => {
        const label = btn.dataset.option;
        if (chat.multiTemp.has(label)) chat.multiTemp.delete(label);
        else chat.multiTemp.add(label);
        renderChatTab();
        scrollChatToBottom();
      });
    }
  });

  // イベント: マルチ選択の「次へ」
  document.getElementById("btn-multi-next")?.addEventListener("click", handleChatMultiNext);

  // イベント: 戻る
  document.getElementById("btn-chat-back")?.addEventListener("click", handleChatBack);

  // イベント: やり直す
  document.getElementById("btn-chat-restart")?.addEventListener("click", () => {
    state.chat = null;
    state.expandedId = null;
    renderChatTab();
  });

  if (chat.phase === "done") bindCardEvents();
  scrollChatToBottom();
}

function handleChatSelect(label) {
  pushSnapshot();
  const chat = state.chat;
  const step = chat.phase === "followup"
    ? FOLLOWUP_MAP[chat.followupKey]
    : CHAT_FLOW[chat.stepIndex];
  const opt = step.options.find(o => o.label === label);
  if (!opt) return;

  // タグを収集
  (opt.tags || opt.addTags || []).forEach(t => chat.collectedTags.add(t));
  chat.history.push({ role: "user", text: label });

  if (chat.phase === "followup") {
    // 深掘り完了
    const hint = FOLLOWUP_MAP[chat.followupKey].hint?.[label];
    if (hint) chat.history.push({ role: "bot", text: hint });
    chat.history.push({ role: "bot", text: "ありがとうございます。利用できる可能性のあるサービスをまとめました。" });
    chat.phase = "done";

  } else if (chat.stepIndex === CHAT_FLOW.length - 1) {
    // situation ステップ完了
    if (opt.followup) {
      chat.followupKey = opt.followup;
      chat.history.push({ role: "bot", text: FOLLOWUP_MAP[opt.followup].botText });
      chat.phase = "followup";
    } else {
      chat.history.push({ role: "bot", text: "ありがとうございます。利用できる可能性のあるサービスをまとめました。" });
      chat.phase = "done";
    }
  } else {
    // 次の質問へ
    chat.stepIndex++;
    chat.history.push({ role: "bot", text: CHAT_FLOW[chat.stepIndex].botText });
  }

  renderChatTab();
  scrollChatToBottom();
}

function handleChatMultiNext() {
  pushSnapshot();
  const chat = state.chat;
  const step = CHAT_FLOW[chat.stepIndex];
  const selected = [...chat.multiTemp];

  // タグ収集
  step.options
    .filter(o => selected.includes(o.label))
    .flatMap(o => o.tags)
    .forEach(t => chat.collectedTags.add(t));

  chat.history.push({ role: "user", text: selected.join("・") });
  chat.multiTemp.clear();
  chat.stepIndex++;
  chat.history.push({ role: "bot", text: CHAT_FLOW[chat.stepIndex].botText });

  renderChatTab();
  scrollChatToBottom();
}

function pushSnapshot() {
  const chat = state.chat;
  chat.snapshots.push({
    phase: chat.phase,
    stepIndex: chat.stepIndex,
    followupKey: chat.followupKey,
    collectedTags: new Set(chat.collectedTags),
    ward: chat.ward,
    historyLength: chat.history.length,
  });
}

function handleChatBack() {
  const chat = state.chat;
  if (!chat.snapshots.length) return;
  const prev = chat.snapshots.pop();
  chat.phase = prev.phase;
  chat.stepIndex = prev.stepIndex;
  chat.followupKey = prev.followupKey;
  chat.collectedTags = prev.collectedTags;
  chat.ward = prev.ward;
  chat.history = chat.history.slice(0, prev.historyLength);
  chat.multiTemp = new Set();
  renderChatTab();
  scrollChatToBottom();
}

function substituteWard(contact, ward) {
  if (!ward) return contact;
  return contact
    .replace(/お住まいの区の区役所/g, ward + "役所")
    .replace(/お住まいの区/g, ward);
}

function handleChatTextNext(value) {
  pushSnapshot();
  const chat = state.chat;
  if (value) chat.history.push({ role: "user", text: value });
  chat.stepIndex++;
  chat.history.push({ role: "bot", text: CHAT_FLOW[chat.stepIndex].botText });
  renderChatTab();
  scrollChatToBottom();
}

function getChatResults() {
  const tags = state.chat.collectedTags;

  // 「困りごと」ステップで選ばれたタグを特定し、必須条件にする
  const situationTagSet = new Set(
    CHAT_FLOW.find(s => s.id === "situation").options.flatMap(o => o.tags)
  );
  const selectedSituationTags = [...tags].filter(t => situationTagSet.has(t));

  return state.entries
    .map(e => {
      const entryTags = new Set(e.tags || []);
      const score = [...tags].filter(t => entryTags.has(t)).length;

      // 困りごとタグが一致しない場合は除外
      if (selectedSituationTags.length > 0 &&
          !selectedSituationTags.some(t => entryTags.has(t))) return null;

      // プロフィールタグが2つ以上一致する場合のみ表示
      if (score < 2) return null;

      return { e, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, "ja"))
    .map(x => x.e);
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    document.getElementById("chat-bottom")?.scrollIntoView({ behavior: "smooth" });
  });
}

// =====================================================
// 🗂 登録・編集タブ
// =====================================================
function renderManageTab() {
  const list = [...state.entries].sort((a, b) => a.name.localeCompare(b.name, "ja"));

  appEl.innerHTML = `
    <p class="hint">ここで登録・編集した情報は、このアプリを開く人全員と将来共有される想定です。相談者個人を特定できる情報(氏名・住所・個別の相談内容など)は入力しないでください。</p>
    <div class="manage-toolbar">
      <button id="btn-add" class="btn btn--accent">＋ 新しい情報を登録</button>
      <button id="btn-export" class="btn btn--ghost">⭳ JSONを書き出す</button>
      <label class="btn btn--ghost" style="display:inline-flex;align-items:center;cursor:pointer;">
        ⭱ JSONを読み込む
        <input id="file-import" type="file" accept="application/json" style="display:none;">
      </label>
      <button id="btn-reset" class="btn btn--ghost">↺ サンプルデータに戻す</button>
    </div>
    <div id="manage-list">
      ${list.map((e) => `
        <div class="manage-row">
          <div>
            <div class="manage-row__name">${escapeHtml(e.name)}</div>
            <div class="manage-row__meta">
              <span class="badge badge--${e.type}">${e.type}</span>
              ${(e.serviceCodes || []).map(c => `<span class="badge badge--code">${c}</span>`).join("")}
              　更新: ${escapeHtml(e.updatedAt || "-")}${e.updatedBy ? " / " + escapeHtml(e.updatedBy) : ""}
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn--sm btn--ghost" data-edit="${e.id}">編集</button>
            <button class="btn btn--sm btn--danger" data-delete="${e.id}">削除</button>
          </div>
        </div>
      `).join("") || emptyStateHtml("登録されている情報がありません。「＋ 新しい情報を登録」から追加してください。")}
    </div>
  `;

  document.getElementById("btn-add").addEventListener("click", () => openEditModal(null));
  document.getElementById("btn-export").addEventListener("click", () => {
    DataStore.exportEntries(state.entries);
    showToast("entries-日付.json をダウンロードしました");
  });
  document.getElementById("file-import").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const data = await DataStore.importEntriesFromFile(file);
      state.entries = data;
      await DataStore.saveEntries(state.entries);
      showToast(`${data.length}件のデータを読み込みました`);
      renderManageTab();
    } catch (e) {
      showToast("読み込みに失敗しました: " + e.message, "error");
    }
    ev.target.value = "";
  });
  document.getElementById("btn-reset").addEventListener("click", async () => {
    if (!window.confirm("現在のデータを破棄して、サンプルデータに戻します。よろしいですか?")) return;
    state.entries = await DataStore.resetToSeed();
    showToast("サンプルデータに戻しました");
    renderManageTab();
  });
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entry = state.entries.find((e) => e.id === btn.dataset.edit);
      openEditModal(entry);
    });
  });
  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const entry = state.entries.find((e) => e.id === btn.dataset.delete);
      if (!entry) return;
      if (!window.confirm(`「${entry.name}」を削除します。よろしいですか?`)) return;
      state.entries = state.entries.filter((e) => e.id !== entry.id);
      await DataStore.saveEntries(state.entries);
      showToast("削除しました");
      renderManageTab();
    });
  });
}

// =====================================================
// カード（共通）
// =====================================================
function entryCardHtml(e, matchScore) {
  const expanded = state.expandedId === e.id;
  const codes = e.serviceCodes || [];
  const codeBadges = codes.map(c =>
    `<span class="badge badge--code" title="${escapeAttr(SERVICE_CODE_MAP[c] || "")}">${c}</span>`
  ).join("");

  return `
    <article class="card" data-card="${e.id}">
      <div class="card__head" data-toggle="${e.id}">
        <div style="flex:1;">
          <div class="card__badges">
            <span class="badge badge--${e.type}">${e.type}</span>
            ${codeBadges}
            ${matchScore ? `<span class="badge badge--match">🎯 ${matchScore}件一致</span>` : ""}
          </div>
          <h3 class="card__title">${escapeHtml(e.name)}</h3>
          <p class="card__overview">${escapeHtml(e.overview || "")}</p>
        </div>
        <span class="toggle-icon">${expanded ? "▲ 閉じる" : "▼ 詳細"}</span>
      </div>
      ${expanded ? `
        <div class="card__detail">
          ${codes.length ? `
            <div class="service-codes-row">
              <strong>サービス種別コード: </strong>
              ${codes.map(c => `<span class="service-code-chip">${c}&#8202;${escapeHtml(SERVICE_CODE_MAP[c] || "")}</span>`).join("")}
            </div>
          ` : ""}
          <dl style="margin:0;">
            ${e.target    ? `<dt>対象となる方</dt><dd>${escapeHtml(e.target)}</dd>` : ""}
            ${e.procedure ? `<dt>手続きの流れ</dt><dd>${escapeHtml(e.procedure)}</dd>` : ""}
            ${e.documents ? `<dt>必要なもの</dt><dd>${escapeHtml(e.documents)}</dd>` : ""}
            ${e.contact   ? `<dt>窓口・問い合わせ先</dt><dd>${escapeHtml(e.contact)}</dd>` : ""}
            ${e.notes     ? `<dt>備考</dt><dd>${escapeHtml(e.notes)}</dd>` : ""}
          </dl>
          <div class="card__tags">${(e.tags || []).map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`).join("")}</div>
          <div class="card__actions">
            ${e.welnetUrl ? `<a href="${escapeAttr(e.welnetUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn--sm btn--ghost" style="text-decoration:none;">🔗 ウェルネットで詳しく見る</a>` : ""}
            <button class="btn btn--sm btn--ghost" data-edit-card="${e.id}">✎ この情報を編集</button>
          </div>
        </div>
      ` : ""}
    </article>
  `;
}

function bindCardEvents() {
  document.querySelectorAll("[data-toggle]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.toggle;
      state.expandedId = state.expandedId === id ? null : id;
      render();
    });
  });
  document.querySelectorAll("[data-edit-card]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const entry = state.entries.find((e) => e.id === btn.dataset.editCard);
      openEditModal(entry);
    });
  });
}

function emptyStateHtml(message) {
  return `<div class="empty-state"><span class="empty-state__icon">📭</span>${escapeHtml(message)}</div>`;
}

// =====================================================
// 登録・編集モーダル
// =====================================================
function openEditModal(entry) {
  const isNew = !entry;
  const e = entry || {
    id: null, name: "", type: "サービス", serviceCodes: [], target: "", overview: "",
    procedure: "", documents: "", contact: "", notes: "", tags: [], updatedBy: "",
  };
  const selectedTags = new Set(e.tags || []);

  const tagGroupHtml = (groupKey) => {
    const g = TAG_GROUPS[groupKey];
    return `
      <div class="tag-group">
        <span class="tag-group__label">${g.label}</span>
        ${g.tags.map((t) => `<button type="button" class="tag-chip ${selectedTags.has(t) ? "is-selected" : ""}" data-modal-tag="${escapeAttr(t)}">${t}</button>`).join("")}
      </div>`;
  };

  const codeRefHtml = Object.entries(SERVICE_CODE_MAP)
    .map(([c, n]) => `<span class="code-ref__item">${c}: ${n}</span>`)
    .join("");

  modalRoot.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box" role="dialog" aria-modal="true">
        <h2 class="modal-title">${isNew ? "新しい情報を登録" : "情報を編集"}</h2>

        <div class="form-field">
          <label for="f-name">名称(必須)</label>
          <input id="f-name" type="text" value="${escapeAttr(e.name)}" placeholder="例: 居宅介護・移動支援">
        </div>
        <div class="form-field">
          <label for="f-type">分類</label>
          <select id="f-type">
            ${["サービス", "制度", "手続き", "相談窓口"].map((t) => `<option value="${t}" ${t === e.type ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label for="f-codes">サービス種別コード(複数の場合はカンマ区切り、例: 11,12)</label>
          <input id="f-codes" type="text" value="${escapeAttr((e.serviceCodes || []).join(","))}" placeholder="コードなしの場合は空白のままでOK">
          <details class="code-ref">
            <summary>コード一覧を見る</summary>
            <div class="code-ref__body">${codeRefHtml}</div>
          </details>
        </div>
        <div class="form-field">
          <label for="f-overview">概要</label>
          <textarea id="f-overview" placeholder="このサービス・手続きの概要">${escapeHtml(e.overview)}</textarea>
        </div>
        <div class="form-field">
          <label for="f-target">対象となる方</label>
          <textarea id="f-target">${escapeHtml(e.target)}</textarea>
        </div>
        <div class="form-field">
          <label for="f-procedure">手続きの流れ</label>
          <textarea id="f-procedure" placeholder="①〜 ②〜 ③〜 のように箇条書きで">${escapeHtml(e.procedure)}</textarea>
        </div>
        <div class="form-field">
          <label for="f-documents">必要なもの(1行に1つ)</label>
          <textarea id="f-documents">${escapeHtml(e.documents)}</textarea>
        </div>
        <div class="form-field">
          <label for="f-contact">窓口・問い合わせ先</label>
          <input id="f-contact" type="text" value="${escapeAttr(e.contact)}">
        </div>
        <div class="form-field">
          <label for="f-notes">備考・注意点</label>
          <textarea id="f-notes">${escapeHtml(e.notes)}</textarea>
        </div>

        ${tagGroupHtml("disability")}
        ${tagGroupHtml("age")}
        ${tagGroupHtml("certificate")}
        ${tagGroupHtml("situation")}

        <div class="form-field">
          <label for="f-updatedby">入力者・所属(任意)</label>
          <input id="f-updatedby" type="text" value="${escapeAttr(e.updatedBy || "")}" placeholder="例: 中区 基幹相談支援センター">
        </div>

        <div class="modal-actions">
          <button id="btn-cancel" class="btn btn--ghost btn--block">キャンセル</button>
          <button id="btn-save" class="btn btn--primary btn--block">保存する</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelectorAll("[data-modal-tag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.modalTag;
      if (selectedTags.has(tag)) selectedTags.delete(tag);
      else selectedTags.add(tag);
      btn.classList.toggle("is-selected");
    });
  });

  document.getElementById("btn-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (ev) => {
    if (ev.target.id === "modal-overlay") closeModal();
  });

  document.getElementById("btn-save").addEventListener("click", async () => {
    const name = document.getElementById("f-name").value.trim();
    if (!name) { showToast("名称を入力してください", "error"); return; }
    const serviceCodes = document.getElementById("f-codes").value
      .split(",").map(s => s.trim()).filter(Boolean);
    const updated = {
      id: e.id || `e${Date.now()}`,
      name,
      type: document.getElementById("f-type").value,
      serviceCodes,
      overview:   document.getElementById("f-overview").value.trim(),
      target:     document.getElementById("f-target").value.trim(),
      procedure:  document.getElementById("f-procedure").value.trim(),
      documents:  document.getElementById("f-documents").value.trim(),
      contact:    document.getElementById("f-contact").value.trim(),
      notes:      document.getElementById("f-notes").value.trim(),
      tags: Array.from(selectedTags),
      updatedBy:  document.getElementById("f-updatedby").value.trim(),
      updatedAt:  new Date().toISOString().slice(0, 10),
    };
    if (isNew) {
      state.entries.push(updated);
    } else {
      state.entries = state.entries.map((x) => (x.id === updated.id ? updated : x));
    }
    await DataStore.saveEntries(state.entries);
    closeModal();
    showToast("保存しました");
    render();
  });
}

function closeModal() { modalRoot.innerHTML = ""; }

// =====================================================
// トースト通知
// =====================================================
function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " toast--error" : "");
  el.textContent = message;
  toastRoot.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// =====================================================
// ユーティリティ
// =====================================================

// カタカナ→ひらがな・全角英数→半角に統一して比較用文字列を作る
function normalizeForSearch(str) {
  if (!str) return "";
  return String(str)
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .toLowerCase();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
