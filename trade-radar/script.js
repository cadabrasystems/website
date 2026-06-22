// Paste the Apps Script production URL ending in /exec here after deployment.
const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbyCKg-ifgDrQgu8egw0CIYY6oL54utejBsLgbmZbifFCm6IRr1l-o8bcuI2HgYSdhRe/exec";

const form = document.querySelector("#signup-form");
const email = document.querySelector("#email");
const status = document.querySelector("#form-status");
const button = form.querySelector("button");
const submissionId = document.querySelector("#submission-id");

const defaultMessage = "No spam. Unsubscribe at any time.";
let pendingId = null;
let timeoutId = null;

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `form-status ${type}`.trim();
}

function setPending(isPending) {
  button.disabled = isPending;
  email.readOnly = isPending;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus(defaultMessage);

  if (!email.validity.valid) {
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
    form.reset();
    setStatus("You’re on the list. We’ll be in touch.", "success");
  } else if (data.status === "invalid") {
    email.focus();
    setStatus("Enter a valid email address.", "error");
  } else {
    setStatus("Something went wrong. Please try again.", "error");
  }
});
