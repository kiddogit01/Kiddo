/* ============================================================
   キKiddoシ — consent.js
   Gestion du consentement aux cookies / traceurs publicitaires.

   - Au 1er passage, affiche un bandeau (Accepter / Refuser).
   - Rien n'est chargé (Monetag, AdSterra, Google AdSense, le
     service worker publicitaire) tant que l'utilisateur n'a pas
     cliqué "Accepter". Le site reste 100% fonctionnel sans.
   - Le choix est mémorisé (localStorage) et n'est plus redemandé.
   - Chaque page déclare juste ses traceurs via window.KIDDO_ADS
     avant d'inclure ce fichier — voir la structure en bas de
     chaque page HTML.
============================================================ */
(function () {
    'use strict';

    var CONSENT_KEY = 'kiddo_consent'; // valeurs possibles : 'accepted' | 'rejected'

    function getConsent() {
        try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
    }
    function setConsent(v) {
        try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
    }

    window.kiddoConsentGranted = function () { return getConsent() === 'accepted'; };
    window.kiddoOpenConsentBanner = function () { showBanner(); }; // permet un lien "Gérer mes cookies" sur n'importe quelle page

    /* ---------- Format AdSterra "atOptions" — rejoué dans un iframe dédié
       (un <script> inséré après coup via le DOM n'exécute jamais son
       document.write ; on lui fournit donc un document tout neuf où
       document.write fonctionne normalement) ---------- */
    function injectAtOptionsAd(containerId, key, w, h) {
        var el = document.getElementById(containerId);
        if (!el || el.dataset.kiddoLoaded) return;
        el.dataset.kiddoLoaded = '1';
        var iframe = document.createElement('iframe');
        iframe.width = w; iframe.height = h;
        iframe.style.border = '0'; iframe.style.display = 'block'; iframe.scrolling = 'no';
        el.appendChild(iframe);
        var doc = iframe.contentWindow.document;
        doc.open();
        doc.write(
            '<script>atOptions=' + JSON.stringify({ key: key, format: 'iframe', height: h, width: w, params: {} }) + ';<\/script>' +
            '<script src="https://www.highrevenueformat.com/' + key + '/invoke.js"><\/script>'
        );
        doc.close();
    }
    window.injectAtOptionsAd = injectAtOptionsAd; // exposé pour les cas gérés page par page (ex : wizard Kiddo Services)

    function injectSimpleScript(src, attrs) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        if (attrs) {
            for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) s.setAttribute(k, attrs[k]); }
        }
        document.head.appendChild(s);
    }

    function loadAllAds() {
        var cfg = window.KIDDO_ADS || {};
        (cfg.simple || []).forEach(function (item) {
            if (typeof item === 'string') injectSimpleScript(item);
            else injectSimpleScript(item.src, item.attrs);
        });
        (cfg.atOptions || []).forEach(function (u) {
            injectAtOptionsAd(u.container, u.key, u.w, u.h);
        });
        if (cfg.registerSW && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(function () {});
        }
        window.dispatchEvent(new CustomEvent('kiddo:consent-accepted'));
    }

    /* ---------- Bandeau ---------- */
    function injectBannerStyle() {
        if (document.getElementById('kc-style')) return;
        var st = document.createElement('style');
        st.id = 'kc-style';
        st.textContent =
            '#kc-banner{position:fixed;left:0;right:0;bottom:0;z-index:99999;' +
            'background:#0d0e15;border-top:1px solid rgba(0,240,255,0.25);' +
            'padding:16px 18px;font-family:Poppins,Arial,sans-serif;color:#e6e7f0;' +
            'box-shadow:0 -8px 26px rgba(0,0,0,0.5);}' +
            '#kc-banner p{margin:0 0 12px;font-size:0.82rem;line-height:1.55;color:#b8b9c8;}' +
            '#kc-banner a{color:#00f0ff;}' +
            '#kc-actions{display:flex;gap:10px;flex-wrap:wrap;}' +
            '#kc-actions button{flex:1;min-width:120px;padding:11px 14px;border-radius:10px;' +
            'font-family:inherit;font-weight:700;font-size:0.84rem;cursor:pointer;}' +
            '#kc-accept{background:linear-gradient(135deg,#00f0ff,#0080ff);color:#06111c;border:none;}' +
            '#kc-reject{background:transparent;color:#e6e7f0;border:1px solid rgba(255,255,255,0.25);}' +
            '@media (min-width:640px){#kc-banner{display:flex;align-items:center;justify-content:space-between;gap:20px;}' +
            '#kc-banner p{margin:0;flex:1;}#kc-actions{flex:0 0 auto;}}';
        document.head.appendChild(st);
    }

    function showBanner() {
        injectBannerStyle();
        if (document.getElementById('kc-banner')) return;
        var el = document.createElement('div');
        el.id = 'kc-banner';
        el.innerHTML =
            '<p>Ce site utilise des cookies et outils similaires (publicité, mesure d\u2019audience) pour rester gratuit. ' +
            'Voir notre <a href="/politique-cookies.html">politique de cookies</a> et notre ' +
            '<a href="/politique-confidentialite.html">politique de confidentialité</a>.</p>' +
            '<div id="kc-actions">' +
                '<button id="kc-reject" type="button">Refuser</button>' +
                '<button id="kc-accept" type="button">Accepter</button>' +
            '</div>';
        document.body.appendChild(el);
        document.getElementById('kc-accept').addEventListener('click', function () {
            setConsent('accepted');
            el.remove();
            loadAllAds();
            window.dispatchEvent(new CustomEvent('kiddo:consent-changed', { detail: 'accepted' }));
        });
        document.getElementById('kc-reject').addEventListener('click', function () {
            setConsent('rejected');
            el.remove();
            window.dispatchEvent(new CustomEvent('kiddo:consent-changed', { detail: 'rejected' }));
        });
    }

    function init() {
        var c = getConsent();
        if (c === 'accepted') { loadAllAds(); return; }
        if (c === 'rejected') { return; }
        showBanner();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
