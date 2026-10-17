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
    var CHECK_DELAY_MS  = 400;    // délai avant la 1ère vérification (juste assez pour laisser les filtres s'appliquer)
    var RECHECK_MS      = 3000;   // nouvelle vérification périodique tant que c'est bloqué
    var SCRIPT_TIMEOUT  = 1800;   // au-delà, on considère que ça a échoué (marge gardée pour la 4G lente)
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

    // Méthode 2 — sonde réseau vers le domaine de la pub (détecte aussi les blocages DNS type AdGuard).
    // On utilise fetch() : rien n'est exécuté ni ajouté à la page. (Avant, un nouveau <script> Monetag
    // était injecté toutes les 3 s sans jamais être retiré → des dizaines de copies, des clics
    // détournés en boucle et des requêtes inutiles vers Monetag.)
    function detectViaScriptLoad(callback) {
        var settled = false;
        var ctrl = ('AbortController' in window) ? new AbortController() : null;
        var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            if (ctrl) { try { ctrl.abort(); } catch (e) {} }
            callback(true);
        }, SCRIPT_TIMEOUT);

        function done(blocked) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            callback(blocked);
        }
        try {
            fetch(AD_TEST_URL + '?_=' + Date.now(), {
                method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit',
                signal: ctrl ? ctrl.signal : undefined
            }).then(function () { done(false); }, function () { done(true); });
        } catch (e) { done(false); }
    }

    var recheckTimer = null;
    var lastRun = 0;

    function runCheck() {
        clearTimeout(recheckTimer);
        lastRun = Date.now();
        detectViaBait(function (baitBlocked) {
            detectViaScriptLoad(function (scriptBlocked) {
                var blocked = baitBlocked || scriptBlocked;

                if (blocked) {
                    wasBlocked = true;
                    showOverlay();
                    // Tant que c'est bloqué on revérifie, pour recharger dès que le bloqueur est coupé
                    recheckTimer = setTimeout(runCheck, RECHECK_MS);
                    return;
                }

                if (wasBlocked && canAutoReload()) {
                    // Le bloqueur vient d'être désactivé : le script pub chargé dans le <head> a
                    // échoué et ne réessaiera pas tout seul → on recharge la page.
                    markAutoReload();
                    window.location.reload();
                    return;
                }

                // Pas de blocage : on s'arrête là (plus de vérification permanente en arrière-plan)
                wasBlocked = false;
                hideOverlay();
            });
        });
    }

    function start() {
        setTimeout(runCheck, CHECK_DELAY_MS);
        // Au retour sur l'onglet (ex. après avoir désactivé le bloqueur), une nouvelle vérification
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && Date.now() - lastRun > 30000) runCheck();
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        start();
    } else {
        document.addEventListener('DOMContentLoaded', start);
    }
})();
