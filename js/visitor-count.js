/* 来場者数は端末・ブラウザごとに保存したランダムIDで集計する。 */
(() => {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOZWWcid8IlUDXx419TwrJ5FuxmrqPi0l-HIFdY77w3P160FWdKNaegAgcQyJ7umWu/exec";
  const APP_NAME = "nagoya-fukushi-navi";
  const VISITOR_ID_KEY = "@nagoya-fukushi-navi/visitor-id/v1";
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const status = document.getElementById("visitor-count-status");
  const value = document.getElementById("visitor-count-value");
  const note = document.getElementById("visitor-count-note");
  const retry = document.getElementById("visitor-count-retry");

  function getVisitorId() {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    if (!UUID_PATTERN.test(visitorId || "")) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
    return visitorId;
  }

  function readStats(visitorId) {
    return new Promise((resolve, reject) => {
      const callback = "visitorCountCallback_" + crypto.randomUUID().replace(/-/g, "");
      const params = new URLSearchParams({ appName: APP_NAME, visitorId, callback });
      const script = document.createElement("script");
      const cleanup = () => {
        clearTimeout(timeout);
        delete window[callback];
        script.remove();
      };
      window[callback] = (result) => {
        cleanup();
        resolve(result);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error("Visitor count request failed"));
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Visitor count request timed out"));
      }, 15000);
      script.src = SCRIPT_URL + "?" + params.toString();
      document.head.appendChild(script);
    });
  }

  async function registerVisitor(visitorId) {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ action: "registerVisit", appName: APP_NAME, visitorId }),
    });
    if (response.type === "opaque") return;
    if (!response.ok) throw new Error("Visitor registration failed with status " + response.status);
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message || "Visitor registration failed");
  }

  function validStats(result) {
    return result && result.status === "success" && typeof result.registered === "boolean" &&
      Number.isSafeInteger(result.visitorCount) && result.visitorCount >= 0;
  }

  async function loadCount() {
    status.textContent = "来場者数を読み込み中...";
    value.textContent = "";
    note.hidden = true;
    retry.hidden = true;

    try {
      const visitorId = getVisitorId();
      let result = await readStats(visitorId);
      if (!validStats(result)) throw new Error((result && result.message) || "Invalid visitor count response");
      if (!result.registered) {
        await registerVisitor(visitorId);
        result = await readStats(visitorId);
      }
      if (!validStats(result) || !result.registered) {
        throw new Error((result && result.message) || "Visitor registration could not be verified");
      }
      status.textContent = "来場者数";
      value.textContent = result.visitorCount.toLocaleString() + "人";
      note.hidden = false;
    } catch (error) {
      console.error("Visitor count loading failed:", error);
      status.textContent = "来場者数を取得できませんでした";
      retry.hidden = false;
    }
  }

  retry.addEventListener("click", loadCount);
  loadCount();
})();
