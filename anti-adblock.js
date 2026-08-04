/**
 * Anti-AdBlock — キKiddoシ
 * Détecte les bloqueurs de pub (extensions ET DNS type AdGuard/NextDNS)
 * et affiche une popup bloquante tant qu'ils sont actifs.
 *
 * Comment ça marche :
 * 1) "Bait div" — un faux bloc pub (classes ciblées par les filtres
 *    des extensions) est ajouté puis on vérifie s'il a été masqué.
 * 2) Chargement réel du script publicitaire Monetag — si AdGuard DNS
 *    (ou toute autre solution DNS) bloque le domaine, le <script>
 *    échoue au chargement (onerror) : c'est justement ce qui permet
 *    de détecter un blocage au niveau DNS, pas seulement au niveau
 *    du navigateur.
 * Les deux méthodes sont combinées pour couvrir un maximum de cas.
 */
(function () {
    'use strict';

    var AD_TEST_URL     = 'https://quge5.com/88/tag.min.js'; // même domaine que la pub Monetag du site
    var CHECK_DELAY_MS  = 1200;   // délai avant la 1ère vérification (laisse le temps aux filtres de s'appliquer)
    var RECHECK_MS      = 5000;   // nouvelle vérification périodique tant que c'est bloqué
    var SCRIPT_TIMEOUT  = 2500;   // au-delà, on considère que ça a échoué
    var RELOAD_KEY       = 'aab_auto_reload_at';
    var RELOAD_COOLDOWN  = 4000;  // évite les boucles de rechargement
    var wasBlocked       = false; // état précédent, pour détecter la transition bloqué → débloqué

    function canAutoReload() {
        try {
            var last = sessionStorage.getItem(RELOAD_KEY);
            if (!last) return true;
            return (Date.now() - parseInt(last, 10)) > RELOAD_COOLDOWN;
        } catch (e) { return true; }
    }
    function markAutoReload() {
        try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch (e) {}
    }

    function injectStyle() {
        if (document.getElementById('aab-style')) return;
        var style = document.createElement('style');
        style.id = 'aab-style';
        style.textContent =
            '#aab-overlay{position:fixed;inset:0;z-index:2147483647;' +
            'background:rgba(8,9,15,0.94);backdrop-filter:blur(10px);' +
            '-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;' +
            'justify-content:center;padding:24px;font-family:Poppins,Arial,sans-serif;}' +
            '#aab-box{max-width:380px;width:100%;text-align:center;background:#12131c;' +
            'border:1px solid rgba(255,0,127,0.35);border-radius:20px;padding:32px 26px;' +
            'box-shadow:0 0 40px rgba(255,0,127,0.25);color:#fff;}' +
            '#aab-box .aab-icon{font-size:2.6rem;margin-bottom:14px;}' +
            '#aab-box h2{font-size:1.1rem;margin:0 0 12px;font-weight:700;}' +
            '#aab-box p{font-size:0.86rem;color:#b8b9c8;line-height:1.6;margin:0 0 22px;}' +
            '#aab-retry{background:linear-gradient(135deg,#ff007f,#00f0ff);border:none;' +
            'color:#06111c;font-weight:700;padding:12px 28px;border-radius:12px;' +
            'cursor:pointer;font-size:0.9rem;font-family:inherit;}' +
            '#aab-retry:active{transform:scale(0.97);}' +
            'body.aab-locked{overflow:hidden!important;}';
        document.head.appendChild(style);
    }

    function showOverlay() {
        injectStyle();
        if (document.getElementById('aab-overlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'aab-overlay';
        overlay.innerHTML =
            '<div id="aab-box">' +
                '<div class="aab-icon">🚫</div>' +
                '<h2>Bloqueur de publicités détecté</h2>' +
                '<p>Ce site est financé par la publicité. Merci de désactiver votre ' +
                'bloqueur de pub (extension du navigateur ou DNS comme AdGuard/NextDNS), ' +
                'puis de réessayer pour accéder au contenu.</p>' +
                '<button id="aab-retry">Réessayer</button>' +
            '</div>';
        document.body.appendChild(overlay);
        document.body.classList.add('aab-locked');
        document.getElementById('aab-retry').addEventListener('click', function () {
            window.location.reload();
        });
    }

    function hideOverlay() {
        var overlay = document.getElementById('aab-overlay');
        if (overlay) overlay.remove();
        document.body.classList.remove('aab-locked');
    }

    // Méthode 1 — bait div (attrape la plupart des extensions)
    function detectViaBait(callback) {
        var bait = document.createElement('div');
        bait.className = 'ads ad ad-banner adsbox doubleclick ad-placement adbadge ' +
                          'pub_300x250 pub_728x90 text-ad textAd text_ad adsbygoogle';
        bait.style.cssText = 'position:absolute!important;top:-9999px!important;' +
                              'left:-9999px!important;width:1px!important;height:1px!important;';
        document.body.appendChild(bait);
        setTimeout(function () {
            var blocked = !bait.offsetParent ||
                          bait.offsetHeight === 0 ||
                          getComputedStyle(bait).display === 'none' ||
                          getComputedStyle(bait).visibility === 'hidden';
            bait.remove();
            callback(blocked);
        }, 100);
    }

    // Méthode 2 — tentative de chargement du vrai script publicitaire
    // (celle qui détecte aussi les blocages DNS type AdGuard)
    function detectViaScriptLoad(callback) {
        var settled = false;
        var timer = setTimeout(function () {
            if (!settled) { settled = true; callback(true); }
        }, SCRIPT_TIMEOUT);

        var s = document.createElement('script');
        s.src = AD_TEST_URL + '?_=' + Date.now();
        s.async = true;
        s.onload = function () {
            if (!settled) { settled = true; clearTimeout(timer); callback(false); }
        };
        s.onerror = function () {
            if (!settled) { settled = true; clearTimeout(timer); callback(true); }
        };
        document.head.appendChild(s);
    }

    function runCheck() {
        detectViaBait(function (baitBlocked) {
            detectViaScriptLoad(function (scriptBlocked) {
                var blocked = baitBlocked || scriptBlocked;

                if (blocked) {
                    wasBlocked = true;
                    showOverlay();
                    return;
                }

                if (wasBlocked && canAutoReload()) {
                    // Le bloqueur vient d'être désactivé : le vrai script pub
                    // (chargé une seule fois dans le <head>) a déjà échoué et
                    // ne réessaiera pas tout seul → on recharge la page pour
                    // qu'il reparte à zéro et que les pubs s'affichent enfin.
                    markAutoReload();
                    window.location.reload();
                    return;
                }

                wasBlocked = false;
                hideOverlay();
            });
        });
    }

    function start() {
        setTimeout(runCheck, CHECK_DELAY_MS);
        setInterval(runCheck, RECHECK_MS);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        start();
    } else {
        document.addEventListener('DOMContentLoaded', start);
    }
})();
