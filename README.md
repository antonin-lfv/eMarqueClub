# eMarque Club

Application en français de table de marque de basketball pour les tournois internes et corpo. Indépendante du logiciel officiel ; elle n’est pas une feuille homologuée FFBB.

## Fonctions

- Base persistante d’équipes et de joueurs ; création, modification, retrait de joueurs.
- Joueurs ajoutés à la volée ou sélectionnés dans la base pendant un match.
- Officiels issus d’autres équipes, du carnet existant ou créés à la volée ; deux arbitres, marqueur, chronométreur, aide-marqueur.
- Règlement des prochains matchs : périodes, durées, prolongations, fautes, bonus, temps morts, nombre de joueurs sur le terrain, plafond de points.
- Chaque match conserve une copie de ses effectifs et règles. Les modifications ultérieures de la base ne réécrivent pas les anciennes feuilles.
- Terrain interactif à l’échelle de 28 × 15 m, détection 2/3 points suivant la position, valeur modifiable, tirs réussis et ratés.
- Plafond individuel hors lancers francs : un panier dépassant le plafond est entièrement bloqué. Les lancers francs restent autorisés.
- Chronomètre basé sur une échéance absolue, pause par Espace, correction du temps, changement de période à zéro, prolongations en cas d’égalité.
- Remplacements, exclusion, temps morts, rebonds, passes décisives, interceptions, pertes de balle, contres.
- Journal avec annulation de la dernière action, clôture et réouverture des matchs.
- Carte de tirs par joueur / équipe / période, feuille de statistiques, export CSV, export JSON du tournoi.

## Utilisation

Le match de démonstration contient deux équipes fictives, avec zéro action. Créer ses équipes dans « Équipes & joueurs », définir le règlement, puis créer un match. Les premiers joueurs jusqu’à la limite prévue forment le groupe initial sur le terrain. Utiliser « Changement » pour l’ajuster.

Sélectionner un joueur, cliquer sur le terrain puis confirmer le résultat. Au clavier, tabuler jusqu’au terrain, déplacer le point avec les flèches et valider par Entrée. Chaque action apparaît après confirmation de sa sauvegarde.

Les fautes et les temps morts arrêtent le chrono. Les lancers francs résultant des fautes sont saisis manuellement. Les fautes des prolongations s’additionnent à celles de la dernière période régulière. Les deux fautes techniques/antisportives combinées ou une disqualifiante entraînent l’exclusion, en plus du seuil configurable de fautes personnelles. Le quota de temps morts est défini pour le match entier.

## Sauvegarde et limites

La base et les matchs sont enregistrés dans Cloudflare D1. Une connexion est nécessaire à chaque action ; cette version n’est pas utilisable hors connexion. La révision de sauvegarde protège contre l’écrasement depuis une autre fenêtre. En cas de conflit, recharger la dernière version. Une erreur de sauvegarde conserve l’état précédent et les valeurs du formulaire ouvert.

Le site est publié en accès privé. Utiliser une table de saisie à la fois pour le tournoi. Il n’y a pas encore de synchronisation en direct pour un panneau spectateur, de gestion de calendrier de tournoi ni d’import FFBB. Les exports sont des statistiques CSV et une archive JSON, pas une feuille officielle.

## Développement local

Node.js ≥ 22.13. `npm run install:ci`, puis `npm run dev` (port 5173).

La base locale doit être initialisée une première fois :

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_abandoned_elektra.sql
npm run dev
```

`npm test` vérifie les règles métier. `npm run typecheck` vérifie les types. `npm run build` produit le Worker et les ressources du client. Le serveur de développement autorise les accès locaux ; en production l’API exige l’identité injectée par Sites et l’accès est restreint au propriétaire par la plateforme.

## Validation de cette version

12 tests métier réussis : score, plafond de 12, dépassement de plafond, fautes, exclusions combinées, banc/remplacements/annulation, temps morts, chrono, prolongations, géométrie des tirs, verrouillage, snapshots des règles et joueurs.

API locale vérifiée avec lecture après écriture, conflit de révision (409), validation des règles (400), rejet d’origine étrangère (403). Les données temporaires de test sont retirées. Compilation et vérification TypeScript effectuées. Aucune campagne de clics ni vérification visuelle automatisée dans le navigateur n’a été effectuée.

Une lecture facultative WebMCP `read_basketball_match` est exposée si le navigateur propose cette API. Aucun contexte de validation WebMCP compatible n’était disponible ; son contrat n’a pas été vérifié en exécution.
