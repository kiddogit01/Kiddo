/* ============================================================
   キKiddoシ — ads-guard.js
   Garde-fou des pubs "au clic" (Monetag onclick, AdSterra popunder).
   À charger EN PREMIER dans le <head>, avant les scripts de pub.

   Ce qu'il règle :
   1) Un tap sur un lien / une carte / le bouton retour n'ouvre
      JAMAIS de pub : la navigation passe toujours.
   2) Une seule pub "popup" à la fois et au plus une toutes les
      CAP_MS (même si Monetag ET AdSterra se déclenchent sur le
      même clic) — plus de doubles popups bloqués par le navigateur.
   3) Pas de pub dans les GRACE_MS qui suivent l'arrivée sur la page.
   4) Les ouvertures de liens du site passent par kiddoOpen() : elles
      ne sont jamais prises pour une pub. Si le navigateur bloque un
      lien ouvert après un compte à rebours, un bouton "Ouvrir le
      lien" s'affiche (kiddoOpenWithFallback).

   Rien n'est retiré : Monetag, AdSterra, bannières, Social Bar,
   Vignette et push restent actifs. Réglages ci-dessous.
============================================================ */
(function () {
    'use strict';

    var CFG = {
        CAP_MS:   90000,  // délai minimum entre deux pubs popup (90 s)
        GRACE_MS: 3000    // aucune pub popup juste après l'arrivée sur la page
    };
    // Éléments de navigation : un clic dessus ne déclenche jamais de pub popup
    var NAV_SELECTOR = 'a[href], .event-card, .back-btn, .link-item, .step-btn';

    var KEY = 'kiddo_ad_last';
    var t0 = Date.now();
    var nativeOpen = window.open;
    var nativeAnchorClick = HTMLAnchorElement.prototype.click;
    var depth = 0; // > 0 pendant une ouverture "maison"

    function lastAd() { try { return parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch (e) { return 0; } }
    function markAd() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }

    function isNavigationClick() {
        var ev = window.event;
        if (!ev || ev.type !== 'click' || !ev.target || !ev.target.closest) return false;
        return !!ev.target.closest(NAV_SELECTOR);
    }
    function allowAd() {
        if (isNavigationClick()) return false;
        if (Date.now() - t0 < CFG.GRACE_MS) return false;
        if (Date.now() - lastAd() < CFG.CAP_MS) return false;
        markAd();
        return true;
    }

    /* Ouverture de lien par le site lui-même (jamais traitée comme une pub) */
    window.kiddoOpen = function (url, target) {
        depth++;
        try {
            var w = nativeOpen.call(window, url, target || '_blank');
            if (w) { try { w.opener = null; } catch (e) {} }
            return w;
        } finally { depth--; }
    };

    /* Même chose, avec un bouton de secours si le navigateur a bloqué l'ouverture */
    window.kiddoOpenWithFallback = function (url) {
        var w = window.kiddoOpen(url);
        if (!w) showFallback(url);
        return w;
    };
    function showFallback(url) {
        var old = document.getElementById('kiddo-open-fb');
        if (old) old.remove();
        var box = document.createElement('div');
        box.id = 'kiddo-open-fb';
        box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:18px;z-index:2147483000;display:flex;' +
            'align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:#12131c;' +
            'border:1px solid rgba(0,240,255,.45);box-shadow:0 6px 24px rgba(0,0,0,.55);' +
            'font-family:Poppins,Arial,sans-serif;color:#e6e7f0;font-size:.82rem;';
        var txt = document.createElement('span');
        txt.style.flex = '1';
        txt.textContent = "Le lien n'a pas pu s'ouvrir automatiquement.";
        var a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'Ouvrir le lien';
        a.style.cssText = 'padding:10px 16px;border-radius:10px;font-weight:700;text-decoration:none;color:#06111c;' +
            'background:linear-gradient(135deg,#00f0ff,#0080ff);white-space:nowrap;';
        a.addEventListener('click', function () { setTimeout(function () { box.remove(); }, 300); });
        box.appendChild(txt); box.appendChild(a);
        document.body.appendChild(box);
        setTimeout(function () { box.remove(); }, 30000);
    }

    /* window.open appelé par un script de pub */
    window.open = function () {
        if (depth > 0) return nativeOpen.apply(window, arguments);
        if (!allowAd()) return null;
        return nativeOpen.apply(window, arguments);
    };

    /* Autre technique des pubs : <a target=_blank> détaché du DOM puis .click() */
    HTMLAnchorElement.prototype.click = function () {
        if (depth === 0 && !this.isConnected && /^_blank$/i.test(this.target || '')) {
            if (!allowAd()) return;
        }
        return nativeAnchorClick.apply(this, arguments);
    };
})();
