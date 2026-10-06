# Lv-UP — pages pub pour WebView

Héberge ces fichiers à la racine de kiddogamplay.vercel.app (même domaine que tes zones AdSterra/Monetag), puis charge-les par URL.

```kotlin
val wv = findViewById<WebView>(R.id.adWebView)
wv.setBackgroundColor(Color.TRANSPARENT)          // fond transparent côté Android
wv.setLayerType(View.LAYER_TYPE_HARDWARE, null)
wv.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
    setSupportMultipleWindows(true)               // popunder / liens target=_blank
    mediaPlaybackRequiresUserGesture = true
}
CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true)

// Fermeture et décompte : gérés dans l'application (la page n'a plus de bouton)

wv.webViewClient = object : WebViewClient() {
    override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
        val u = r.url
        if (u.host?.contains("kiddogamplay") == false) {                     // YouTube, TikTok, pubs → navigateur
            startActivity(Intent(Intent.ACTION_VIEW, u)); return true
        }
        return false
    }
}
wv.loadUrl("https://kiddogamplay.vercel.app/interstitiel.html")
```

## Bannières flottantes
- Elles se déplacent par la poignée en haut (glisser-déposer) et s'accrochent au bord le plus proche.
- Position de départ dans l'URL : `ad-banner-160x600.html?pos=top-left` (`top-left`, `top-right`, `bottom-left`, `bottom-right`). Options : `&snap=0` (pas d'aimantation), `&drag=0` (pas de poignée).
- La taille n'est jamais réduite selon la hauteur de la WebView : si elle est plus petite que la pub, la page défile.
- Optionnel : `@JavascriptInterface fun onBannerSize(w: Int, h: Int)` reçoit la taille idéale de la WebView en px CSS (dp).
