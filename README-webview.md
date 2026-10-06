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
