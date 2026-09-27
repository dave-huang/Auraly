import type { Lang } from "./siteCopy";

/**
 * Google Analytics on revely.life.
 *
 * TWO MODES, ONE SWITCH (REQUIRE_CONSENT).
 *
 * Off, as now: the tag loads for every visitor, as it did on Auraly, and a
 * visitor can turn it off for their browser from "Analytics settings" in the
 * footer. Dave chose this on 2026-09-26, knowingly, to count all traffic while
 * Revely is small, and plans to switch consent on as it grows. The risk is
 * real and was spelled out: these pages are about health, so a visit to
 * /en/allergens/peanuts sent to Google can be consumer health data under
 * Washington's My Health My Data Act, which wants consent first, and EU
 * visitors need consent before an analytics cookie is set.
 *
 * On: nothing loads until the visitor clicks Allow in a banner shown to
 * everyone, which satisfies both.
 *
 * The privacy policies (legal.ts) read the same switch, so they describe
 * whichever mode is running and are never wrong about it.
 *
 * WHY NOT CONSENT MODE'S DEFAULTS, when consent is on. Google's consent
 * mode loads the tag at once and sends "cookieless pings" while consent is
 * denied. Those pings still carry the page address to Google, which is the
 * very thing the visitor has not agreed to. So with consent on, nothing from
 * Google loads at all until the visitor clicks Allow: no script, no ping, no
 * request.
 *
 * Advertising is off in both modes: ad storage, ad user data and ad
 * personalization are denied, and Google signals (cross-device, the thing
 * that would make this tracking across sites) is disabled.
 *
 * The visitor's choice is kept in localStorage on their device, never sent
 * anywhere. "Analytics settings" in the footer opens the same panel as the
 * banner, in either mode. Saying no clears Google's cookies.
 *
 * Off until MEASUREMENT_ID is set: with no ID, pages carry no banner and no
 * script, exactly as before.
 */

/** The GA4 web stream's Measurement ID ("G-…"). Public: it is in every page's source once set. */
export const MEASUREMENT_ID = "G-S9DB439XM5";

/** Ask before loading anything (true), or load for everyone with an opt-out (false). */
export const REQUIRE_CONSENT = false;

const COPY: Record<Lang, { title: string; body: string; allow: string; deny: string; policy: string; settings: string }> = {
  en: {
    title: "Can we count your visit?",
    body: "We use Google Analytics to see which pages people read, so we know what to write next. It sets cookies and sends Google the page you’re on. Nothing is used for advertising.",
    allow: "Allow analytics",
    deny: "No thanks",
    policy: "Privacy Policy",
    settings: "Analytics settings",
  },
  zh: {
    title: "可以统计你的访问吗？",
    body: "我们用 Google Analytics 了解大家读哪些页面，好决定接下来写什么。它会设置 Cookie，并把你正在看的页面发送给 Google。不会用于广告。",
    allow: "允许统计",
    deny: "不用了",
    policy: "隐私政策",
    settings: "统计设置",
  },
  es: {
    title: "¿Podemos contar tu visita?",
    body: "Usamos Google Analytics para ver qué páginas se leen y así decidir qué escribir después. Usa cookies y envía a Google la página que estás viendo. Nada se usa con fines publicitarios.",
    allow: "Permitir analítica",
    deny: "No, gracias",
    policy: "Política de Privacidad",
    settings: "Ajustes de analítica",
  },
};

const STYLE = `
.consent { position: fixed; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 50;
  max-width: 560px; margin: 0 auto; padding: 18px 20px; display: grid; gap: 10px;
  background: var(--card, #FFFCF6); color: var(--ink, #16130F); border: 1px solid var(--rule, #DDD4C2);
  box-shadow: 0 8px 28px rgba(22, 19, 15, 0.14); }
.consent[hidden] { display: none; }
.consent h2 { margin: 0; font-size: 1rem; line-height: 1.3; font-weight: 600; border: 0; padding: 0; }
.consent p { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--ink-muted, #5C554A); }
.consent .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.consent button { font: inherit; font-size: 0.9375rem; font-weight: 500; padding: 8px 14px; cursor: pointer;
  border: 1px solid var(--ink, #16130F); background: var(--ink, #16130F); color: var(--paper, #F6F1E7); }
.consent button.no { background: transparent; color: var(--ink, #16130F); border-color: var(--rule, #DDD4C2); }
.consent a { font-size: 0.875rem; color: var(--ink-muted, #5C554A); margin-left: auto; }
.consent button:focus-visible, .consent a:focus-visible { outline: 2px solid var(--ink, #16130F); outline-offset: 2px; }
.foot-links .consent-open { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
`;

/**
 * The banner and its loader, for the end of <body>. Empty while no
 * Measurement ID is set.
 */
export function consentBlock(lang: Lang): string {
  if (!MEASUREMENT_ID) return "";
  const c = COPY[lang];
  const id = JSON.stringify(MEASUREMENT_ID);
  return `
<style>${STYLE}</style>
<section class="consent" id="consent" role="dialog" aria-labelledby="consent-h" aria-describedby="consent-p" hidden>
  <h2 id="consent-h">${c.title}</h2>
  <p id="consent-p">${c.body}</p>
  <div class="row">
    <button type="button" data-consent="granted">${c.allow}</button>
    <button type="button" class="no" data-consent="denied">${c.deny}</button>
    <a href="/privacy#analytics">${c.policy}</a>
  </div>
</section>
<script>
(function () {
  var KEY = "revely-analytics";
  var ID = ${id};
  var box = document.getElementById("consent");
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  var loaded = false;
  function gtag() { window.dataLayer.push(arguments); }
  function load() {
    if (loaded) { gtag("consent", "update", { analytics_storage: "granted" }); return; }
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = gtag;
    gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    gtag("set", { allow_google_signals: false, allow_ad_personalization_signals: false });
    gtag("js", new Date());
    gtag("config", ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ID);
    document.head.appendChild(s);
  }
  function clearCookies() {
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (name === "_ga" || name.indexOf("_ga_") === 0) {
        ["", "; domain=.revely.life", "; domain=revely.life"].forEach(function (d) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
        });
      }
    });
  }
  function choose(v) {
    write(v);
    box.hidden = true;
    if (v === "granted") load();
    else { if (loaded) gtag("consent", "update", { analytics_storage: "denied" }); clearCookies(); }
  }
  box.querySelectorAll("[data-consent]").forEach(function (b) {
    b.addEventListener("click", function () { choose(b.getAttribute("data-consent")); });
  });
  var links = document.querySelector(".foot-links");
  if (links) {
    var li = document.createElement("li");
    var open = document.createElement("button");
    open.type = "button";
    open.className = "consent-open";
    open.textContent = ${JSON.stringify(c.settings)};
    open.addEventListener("click", function () { box.hidden = false; box.querySelector("button").focus(); });
    li.appendChild(open);
    links.insertBefore(li, links.querySelector("li:last-child"));
  }
  var saved = read();
  if (${REQUIRE_CONSENT ? 'saved === "granted"' : 'saved !== "denied"'}) load();
  ${REQUIRE_CONSENT ? 'else if (saved !== "denied") box.hidden = false;' : "// No banner: the panel opens only from Analytics settings in the footer."}
})();
</script>`;
}
