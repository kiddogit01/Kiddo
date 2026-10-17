# Mise à jour — pubs, jeux, émulateurs

## Pubs (aucune pub retirée)
- `ads-guard.js` (NOUVEAU, à charger avant les pubs) : un tap sur un lien, une carte, le bouton retour ou un bouton de téléchargement n'ouvre plus jamais de pub popup ; une seule pub popup à la fois et au plus une toutes les 90 s (réglable en haut du fichier) ; aucune pub popup dans les 3 s après l'arrivée sur la page.
- `anti-adblock.js` : il ajoutait un nouveau script Monetag toutes les 3 s sans jamais l'arrêter (copies à l'infini, requêtes inutiles). Il utilise maintenant une simple sonde réseau et s'arrête quand tout va bien.
- Liens du site (réseaux, cartes externes, téléchargements) : ouverts par `kiddoOpen()` ; si le navigateur bloque l'ouverture après le compte à rebours, un bouton « Ouvrir le lien » apparaît.
- `index.html` : les cartes internes (bêta testeur, jeux) ne sont plus traitées comme des liens externes.

## Jeux
- NOUVEAU `codmw4.html` (Call of Duty: Modern Warfare 4) + carte dans l'index, sitemap, llms.txt.
- GTA 5, GTA 4, Blur, COD : émulateur Android GameHub 6.3.1 + émulateur macOS (gamemac.com).
- Naruto Storm et FIFA 23 : Eden Android, Windows, macOS, Linux, ChromeOS.
