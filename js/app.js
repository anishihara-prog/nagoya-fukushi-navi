/* =========================================================
   app.js ― UIロジック本体
   data-store.js が用意した loadEntries / saveEntries だけを使い、
   保存方法の詳細は意識しない。
   ========================================================= */

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

// ---------- タグの分類(検索チップ・フォームで共通利用) ----------
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
  wizardSelected: new Set(),
  expandedId: null,
  editingEntry: null,
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
  if (state.activeTab === "profile") return renderProfileTab();
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
    <div id="search-results">${list.length ? list.map((e) => entryCardHtml(e)).join("") : emptyStateHtml("「" + (kw || "条件") + "」に一致する情報が見つかりません。キーワードを変えるか、「登録・編集」タブから情報を追加できます。")}</div>
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
// 👤 プロフィールで探すタブ
// =====================================================
function renderProfileTab() {
  const selected = state.wizardSelected;

  const groupHtml = (groupKey) => {
    const g = TAG_GROUPS[groupKey];
    return `
      <div class="tag-group">
        <span class="tag-group__label">${g.label}</span>
        ${g.tags.map((t) => `<button class="tag-chip ${selected.has(t) ? "is-selected" : ""}" data-tag="${escapeAttr(t)}">${t}</button>`).join("")}
      </div>`;
  };

  let resultsHtml;
  let resultCount = 0;
  if (selected.size === 0) {
    resultsHtml = emptyStateHtml("上のプロフィールを入力すると、利用できるサービスが表示されます。");
  } else {
    const scored = state.entries
      .map((e) => ({ e, score: (e.tags || []).filter((t) => selected.has(t)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, "ja"));
    resultCount = scored.length;
    resultsHtml = scored.length
      ? scored.map(({ e, score }) => entryCardHtml(e, score)).join("")
      : emptyStateHtml("選択した条件に一致する情報がありません。条件を減らすか、「登録・編集」タブから情報を追加してください。");
  }

  appEl.innerHTML = `
    <div class="profile-panel">
      <div class="profile-panel__header">
        <p class="profile-panel__title">相談者のプロフィールを選択してください</p>
        ${selected.size > 0 ? `<button class="btn btn--sm btn--ghost" id="btn-profile-clear">✕ クリア</button>` : ""}
      </div>
      ${groupHtml("disability")}
      ${groupHtml("age")}
      ${groupHtml("certificate")}
      ${groupHtml("situation")}
    </div>
    ${selected.size > 0 ? `
      <div class="results-section-label">
        <span>該当するサービス・支援</span>
        <span class="results-count-badge">${resultCount}件</span>
      </div>
    ` : ""}
    <div id="wizard-results">${resultsHtml}</div>
  `;

  if (selected.size > 0) {
    document.getElementById("btn-profile-clear")?.addEventListener("click", () => {
      state.wizardSelected.clear();
      renderProfileTab();
    });
  }

  document.querySelectorAll(".tag-chip[data-tag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      if (selected.has(tag)) selected.delete(tag);
      else selected.add(tag);
      renderProfileTab();
    });
  });
  bindCardEvents();
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
// カード(検索結果・プロフィール結果で共通利用)
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
            ${e.target ? `<dt>対象となる方</dt><dd>${escapeHtml(e.target)}</dd>` : ""}
            ${e.procedure ? `<dt>手続きの流れ</dt><dd>${escapeHtml(e.procedure)}</dd>` : ""}
            ${e.documents ? `<dt>必要なもの</dt><dd>${escapeHtml(e.documents)}</dd>` : ""}
            ${e.contact ? `<dt>窓口・問い合わせ先</dt><dd>${escapeHtml(e.contact)}</dd>` : ""}
            ${e.notes ? `<dt>備考</dt><dd>${escapeHtml(e.notes)}</dd>` : ""}
          </dl>
          <div class="card__tags">${(e.tags || []).map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`).join("")}</div>
          <div class="card__actions">
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
    if (!name) {
      showToast("名称を入力してください", "error");
      return;
    }
    const rawCodes = document.getElementById("f-codes").value;
    const serviceCodes = rawCodes.split(",").map(s => s.trim()).filter(Boolean);
    const updated = {
      id: e.id || `e${Date.now()}`,
      name,
      type: document.getElementById("f-type").value,
      serviceCodes,
      overview: document.getElementById("f-overview").value.trim(),
      target: document.getElementById("f-target").value.trim(),
      procedure: document.getElementById("f-procedure").value.trim(),
      documents: document.getElementById("f-documents").value.trim(),
      contact: document.getElementById("f-contact").value.trim(),
      notes: document.getElementById("f-notes").value.trim(),
      tags: Array.from(selectedTags),
      updatedBy: document.getElementById("f-updatedby").value.trim(),
      updatedAt: new Date().toISOString().slice(0, 10),
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

function closeModal() {
  modalRoot.innerHTML = "";
}

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
