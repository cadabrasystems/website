const SHEET_NAME = "Sheet1";

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const email = String(parameters.email || "").trim().toLowerCase();
  const honeypot = String(parameters.website || "");
  const submissionId = String(parameters.submissionId || "");
  const visitorId = validUuidOrEmpty(parameters.visitorId);
  const sessionId = validUuidOrEmpty(parameters.sessionId);

  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return result("error", "");
  }

  // Pretend honeypot submissions succeeded so bots receive no useful feedback.
  if (honeypot) {
    return result("ok", submissionId);
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return result("invalid", submissionId);
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`Missing sheet: ${SHEET_NAME}`);
    }

    ensureTrackingHeaders(sheet);
    const lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      const existing = sheet
        .getRange(2, 2, lastRow - 1, 1)
        .createTextFinder(email)
        .matchEntireCell(true)
        .useRegularExpression(false)
        .findNext();

      if (existing) {
        return result("ok", submissionId);
      }
    }

    const row = lastRow + 1;
    const textValues = [
      email,
      "website",
      visitorId,
      sessionId,
      submissionId,
      String(parameters.timezone || "").slice(0, 100),
      String(parameters.referrer || "").slice(0, 2000),
      String(parameters.landingPage || "").slice(0, 2000),
      String(parameters.utmSource || "").slice(0, 250),
      String(parameters.utmMedium || "").slice(0, 250),
      String(parameters.utmCampaign || "").slice(0, 250),
    ];

    sheet.getRange(row, 1).setValue(new Date()).setNumberFormat("yyyy-mm-dd hh:mm:ss.000");
    sheet.getRange(row, 2, 1, textValues.length).setNumberFormat("@");
    sheet.getRange(row, 2, 1, textValues.length).setValues([textValues]);

    return result("ok", submissionId);
  } catch (error) {
    console.error(error);
    return result("error", submissionId);
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function validUuidOrEmpty(value) {
  const id = String(value || "");
  return /^[0-9a-f-]{36}$/i.test(id) ? id : "";
}

function ensureTrackingHeaders(sheet) {
  const range = sheet.getRange(1, 4, 1, 9);
  const currentHeaders = range.getValues()[0];
  const trackingHeaders = [
    "Visitor ID",
    "Session ID",
    "Submission ID",
    "Timezone",
    "Referrer",
    "Landing page",
    "UTM source",
    "UTM medium",
    "UTM campaign",
  ];
  const headers = currentHeaders.map((header, index) => header || trackingHeaders[index]);

  range.setValues([headers]);
}

function result(status, submissionId) {
  const message = JSON.stringify({
    type: "mailing-list-result",
    status,
    submissionId,
  }).replace(/</g, "\\u003c");

  return HtmlService
    // Apps Script nests this output inside its own wrapper iframe. Message the
    // top-level signup page rather than the immediate Google-owned parent.
    .createHtmlOutput(`<script>top.postMessage(${message}, "*");</script>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
