/* =========================================================
   feedback.js
   -----------------------------------------------------------
   フィードバックフォーム。入力内容を Google Apps Script(ウェブアプリ)に
   送信し、スプレッドシートのアプリ別タブ(appName)に保存する。
   app.js には依存しない(フッターにボタンを差し込むだけ)。
   ========================================================= */

const FeedbackForm = (() => {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzFCaaWabD78GxAySMPYeOkL38dx4Hpr4GuCCpl8VWtjy1aJHcChbRXqz8EGe-vWO4/exec";
  const APP_NAME = "nagoya-fukushi-navi";
  const USABILITY_OPTIONS = ["とても使いやすい", "使いやすい", "普通", "やや使いにくい", "使いにくい"];
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 必須項目と形式を検証する。問題があればエラーメッセージ、なければ空文字を返す
  function validate({ usability, comment, email }) {
    if (!usability || !comment.trim()) return "使いやすさとご感想をご入力ください。";
    if (email && !EMAIL_PATTERN.test(email)) return "返信用メールアドレスの形式をご確認ください。";
    return "";
  }

  function buildPayload({ usability, comment, email, name, age }) {
    return {
      appName: APP_NAME,
      rating: usability,
      comment: comment.trim(),
      email: email.trim(),
      name: name.trim(),
      age: age.replace(/[^0-9]/g, ""),
    };
  }

  // 他ドメインのGASは応答を読めないため no-cors で送り、通信失敗のみ検知する
  async function send(payload) {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
    });
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    });
    children.forEach((child) => node.appendChild(child));
    return node;
  }

  function field(labelText, optional, input) {
    const badge = el("span", { class: optional ? "feedback__opt" : "feedback__req", text: optional ? "任意" : "必須" });
    const label = el("label", { class: "feedback__label" }, [document.createTextNode(labelText + " "), badge]);
    return el("div", { class: "feedback__field" }, [label, input]);
  }

  function mount() {
    const footer = document.querySelector(".app-footer");
    if (!footer) return;

    let usability = "";
    let submitting = false;

    const openBtn = el("button", { type: "button", class: "btn btn--ghost btn--sm feedback__open", text: "💬 フィードバックを送る" });

    const optionButtons = USABILITY_OPTIONS.map((option) => {
      const btn = el("button", { type: "button", class: "feedback__option", role: "radio", "aria-checked": "false", text: option });
      btn.addEventListener("click", () => {
        usability = option;
        optionButtons.forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-selected", on);
          b.setAttribute("aria-checked", String(on));
        });
      });
      return btn;
    });
    const options = el("div", { class: "feedback__options", role: "radiogroup", "aria-label": "使いやすさ" }, optionButtons);

    const comment = el("textarea", { class: "feedback__input feedback__textarea", maxlength: "1000", rows: "5", placeholder: "使ってみた感想や改善してほしい点をお聞かせください" });
    const name = el("input", { class: "feedback__input", type: "text", maxlength: "50", autocomplete: "name", placeholder: "例：名古屋 太郎" });
    const age = el("input", { class: "feedback__input", type: "text", inputmode: "numeric", maxlength: "3", placeholder: "例：35" });
    const email = el("input", { class: "feedback__input", type: "email", maxlength: "254", autocomplete: "email", placeholder: "name@example.com" });
    age.addEventListener("input", () => { age.value = age.value.replace(/[^0-9]/g, ""); });

    const notice = el("p", { class: "feedback__notice", role: "alert", hidden: "" });
    const submitBtn = el("button", { type: "button", class: "btn btn--primary feedback__submit", text: "送信する" });
    const closeBtn = el("button", { type: "button", class: "feedback__close", "aria-label": "閉じる", text: "✕" });

    const dialog = el("dialog", { class: "feedback", "aria-labelledby": "feedback-title" }, [
      el("div", { class: "feedback__head" }, [el("h2", { id: "feedback-title", class: "feedback__title", text: "フィードバック" }), closeBtn]),
      field("使いやすさ", false, options),
      field("ご感想・改善点", false, comment),
      field("お名前", true, name),
      field("年齢", true, age),
      field("返信用メールアドレス", true, email),
      el("p", { class: "feedback__privacy", text: "ご入力内容はフィードバックの確認・返信のために保存されます。相談者個人を特定できる情報は入力しないでください。" }),
      notice,
      submitBtn,
    ]);

    const showNotice = (message, isError) => {
      notice.textContent = message;
      notice.hidden = !message;
      notice.classList.toggle("is-error", isError);
    };

    const reset = () => {
      usability = "";
      optionButtons.forEach((b) => { b.classList.remove("is-selected"); b.setAttribute("aria-checked", "false"); });
      [comment, name, age, email].forEach((input) => { input.value = ""; });
    };

    const close = () => {
      if (submitting) return;
      dialog.close();
      showNotice("", false);
    };

    openBtn.addEventListener("click", () => { showNotice("", false); dialog.showModal(); });
    closeBtn.addEventListener("click", close);
    dialog.addEventListener("cancel", (event) => { if (submitting) event.preventDefault(); });

    submitBtn.addEventListener("click", async () => {
      if (submitting) return;
      const values = { usability, comment: comment.value, email: email.value.trim(), name: name.value, age: age.value };
      const error = validate(values);
      if (error) { showNotice(error, true); return; }

      submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "送信中…";
      showNotice("", false);
      try {
        await send(buildPayload(values));
        reset();
        showNotice("ご意見ありがとうございました。送信しました。", false);
      } catch (e) {
        console.error("Feedback submission failed:", e);
        showNotice("送信できませんでした。通信環境を確認して、もう一度お試しください。", true);
      } finally {
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "送信する";
      }
    });

    footer.insertBefore(el("p", { class: "feedback__open-wrap" }, [openBtn]), footer.firstChild);
    footer.appendChild(dialog);
  }

  mount();

  return { validate, buildPayload };
})();
