// Paste the Apps Script production URL ending in /exec here after deployment.
const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbyCKg-ifgDrQgu8egw0CIYY6oL54utejBsLgbmZbifFCm6IRr1l-o8bcuI2HgYSdhRe/exec";

const form = document.querySelector("#signup-form");
const email = document.querySelector("#email");
const status = document.querySelector("#form-status");
const button = form.querySelector("button");
const submissionId = document.querySelector("#submission-id");
const visitorIdInput = document.querySelector("#visitor-id");
const sessionIdInput = document.querySelector("#session-id");
const timezoneInput = document.querySelector("#timezone");
const referrerInput = document.querySelector("#referrer");
const landingPageInput = document.querySelector("#landing-page");
const utmSourceInput = document.querySelector("#utm-source");
const utmMediumInput = document.querySelector("#utm-medium");
const utmCampaignInput = document.querySelector("#utm-campaign");

const defaultMessage = "No spam. Unsubscribe at any time.";
let pendingId = null;
let timeoutId = null;
let formStarted = false;

function createId() {
  return crypto.randomUUID();
}

function getOrCreateStoredId(storage, key) {
  try {
    const existingId = storage.getItem(key);

    if (/^[0-9a-f-]{36}$/i.test(existingId || "")) {
      return existingId;
    }

    const id = createId();
    storage.setItem(key, id);
    return id;
  } catch (error) {
    return createId();
  }
}

function track(eventName, parameters = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, parameters);
  }
}

const pageUrl = new URL(window.location.href);
visitorIdInput.value = getOrCreateStoredId(localStorage, "tradeRadarVisitorId");
sessionIdInput.value = getOrCreateStoredId(sessionStorage, "tradeRadarSessionId");
timezoneInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
referrerInput.value = document.referrer;
landingPageInput.value = pageUrl.href;
utmSourceInput.value = pageUrl.searchParams.get("utm_source") || "";
utmMediumInput.value = pageUrl.searchParams.get("utm_medium") || "";
utmCampaignInput.value = pageUrl.searchParams.get("utm_campaign") || "";

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `form-status ${type}`.trim();
}

function setPending(isPending) {
  button.disabled = isPending;
  email.readOnly = isPending;
}

email.addEventListener("focus", () => {
  if (!formStarted) {
    formStarted = true;
    track("signup_form_start");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus(defaultMessage);

  if (!email.validity.valid) {
    track("signup_validation_error");
    email.focus();
    setStatus("Enter a valid email address.", "error");
    return;
  }

  if (!ENDPOINT_URL.startsWith("https://script.google.com/macros/s/") || !ENDPOINT_URL.endsWith("/exec")) {
    setStatus("The signup form has not been configured yet.", "error");
    return;
  }

  pendingId = crypto.randomUUID();
  submissionId.value = pendingId;
  form.action = ENDPOINT_URL;
  setPending(true);
  setStatus("Joining…");
  track("signup_submit");
  form.submit();

  timeoutId = window.setTimeout(() => {
    pendingId = null;
    setPending(false);
    setStatus("That took too long. Please try again.", "error");
  }, 12000);
});

window.addEventListener("message", (event) => {
  const data = event.data;

  if (!data || data.type !== "mailing-list-result" || data.submissionId !== pendingId) {
    return;
  }

  window.clearTimeout(timeoutId);
  pendingId = null;
  setPending(false);

  if (data.status === "ok") {
    email.value = "";
    setStatus("You’re on the list. We’ll be in touch.", "success");
    track("signup_success");
  } else if (data.status === "invalid") {
    email.focus();
    setStatus("Enter a valid email address.", "error");
    track("signup_validation_error");
  } else {
    setStatus("Something went wrong. Please try again.", "error");
    track("signup_error");
  }
});
