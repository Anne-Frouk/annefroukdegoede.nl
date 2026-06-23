const TO_EMAIL = "annefrouk.de.goede@legerdesheils.nl";
const FROM_EMAIL = "Contactformulier <contact@annefroukdegoede.nl>";

const MAX_LEN = {
  naam: 200,
  organisatie: 200,
  email: 200,
  telefoon: 50,
  typeInzet: 100,
  bericht: 5000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleContact(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  if (body && typeof body.website === "string" && body.website.trim() !== "") {
    return json(200, { ok: true });
  }

  const fields = {
    naam: typeof body.naam === "string" ? body.naam.trim() : "",
    organisatie: typeof body.organisatie === "string" ? body.organisatie.trim() : "",
    email: typeof body.email === "string" ? body.email.trim() : "",
    telefoon: typeof body.telefoon === "string" ? body.telefoon.trim() : "",
    typeInzet: typeof body.typeInzet === "string" ? body.typeInzet.trim() : "",
    bericht: typeof body.bericht === "string" ? body.bericht.trim() : "",
  };

  if (!fields.naam) return json(400, { ok: false, error: "naam_required" });
  if (!fields.email || !EMAIL_RE.test(fields.email)) {
    return json(400, { ok: false, error: "email_invalid" });
  }
  for (const [key, max] of Object.entries(MAX_LEN)) {
    if (fields[key].length > max) {
      return json(400, { ok: false, error: `${key}_too_long` });
    }
  }

  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set");
    return json(500, { ok: false, error: "server_misconfigured" });
  }

  const text =
    `Naam: ${fields.naam}\n` +
    `Organisatie: ${fields.organisatie || "-"}\n` +
    `E-mail: ${fields.email}\n` +
    `Telefoon: ${fields.telefoon || "-"}\n` +
    `Type inzet: ${fields.typeInzet || "-"}\n` +
    `\nBericht:\n${fields.bericht || "-"}\n`;

  const html =
    `<p><strong>Naam:</strong> ${escapeHtml(fields.naam)}</p>` +
    `<p><strong>Organisatie:</strong> ${escapeHtml(fields.organisatie || "-")}</p>` +
    `<p><strong>E-mail:</strong> ${escapeHtml(fields.email)}</p>` +
    `<p><strong>Telefoon:</strong> ${escapeHtml(fields.telefoon || "-")}</p>` +
    `<p><strong>Type inzet:</strong> ${escapeHtml(fields.typeInzet || "-")}</p>` +
    `<p><strong>Bericht:</strong></p>` +
    `<p style="white-space:pre-wrap">${escapeHtml(fields.bericht || "-")}</p>`;

  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: fields.email,
      subject: `Nieuwe aanvraag via annefroukdegoede.nl — ${fields.naam}`,
      text,
      html,
    }),
  });

  if (!resendResp.ok) {
    const detail = await resendResp.text().catch(() => "");
    console.error("Resend error", resendResp.status, detail);
    return json(500, { ok: false, error: "send_failed" });
  }

  return json(200, { ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      console.log("env keys:", Object.keys(env));
      return handleContact(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
