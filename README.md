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

Cliquer sur « Nouveau match » ou « Avant-match ». Choisir les équipes, cocher les présents, renseigner leurs numéros de maillot, leur statut de licence et leurs titulaires. Les numéros peuvent rester vides dans la base, mais sont obligatoires et uniques par équipe dans le match. Les informations des joueurs présents sont mémorisées au lancement. Affecter exactement un marqueur, un chronométreur et un ou deux arbitres, depuis la base ou en saisissant un nom. Une personne ne peut pas occuper deux postes ni jouer ce match en étant officiel.

Pénalités : jamais licencié = 0, ancien licencié = 1, licencié actuel = 3. Seuls les présents comptent. Les totaux sont compensés : 4 pour A et 7 pour B donnent A 3–0 B. Ce score est figé au lancement, affiché séparément dans les statistiques et ne consomme pas les plafonds individuels. Les anciens matchs conservent leur score initial d’origine (zéro s’il n’était pas défini).

Sélectionner un joueur et cliquer sur le terrain ajoute immédiatement un panier. « Prochain tir raté » enregistre un échec au clic suivant puis revient au mode panier. Annuler, placé près du terrain et dans le journal, revient en arrière sans confirmation. Le lancer franc réussi, le lancer raté et la faute personnelle sont des actions directes. Les autres fautes restent dans leur menu de choix.

La touche Espace démarre / arrête le chrono. Les boutons ±1 s, ±10 s et ±1 min le corrigent en conservant son état de marche ; le temps reste entre zéro et la durée de la période. Cliquer sur le chrono permet une correction exacte qui le met en pause. Les fautes et les temps morts arrêtent le chrono. Les lancers francs après faute restent manuels. Le quota de temps morts s’applique au match entier.

## Sauvegarde et limites

L’interface affiche immédiatement les actions. Une file de sauvegarde en arrière-plan n’envoie qu’une requête à la fois, regroupe les modifications rapides et protège les annulations pendant une requête. Chaque écriture porte un identifiant de mutation : une réponse réseau perdue peut être retentée sans doublon. Les révisions empêchent l’écrasement par une autre fenêtre.

La base D1 reste la référence durable. Les modifications non encore confirmées ont une copie temporaire dans `sessionStorage`, récupérée lors d’un rechargement du même onglet. Ce mécanisme n’est pas une garantie de fonctionnement hors ligne : garder la page ouverte jusqu’à confirmation de sauvegarde. Une panne affiche « Réessayer » et permet d’exporter la saisie locale. En cas de conflit, la copie locale est conservée et aucun écrasement automatique n’est effectué.

Le site demeure privé. Utiliser une table de saisie à la fois. Aucun changement de partage ni de données de match existantes n’est effectué par la publication.

## Développement local

Node.js ≥ 22.13. `npm run install:ci`, puis `npm run dev` (port 5173).

La base locale doit être initialisée une première fois :

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_abandoned_elektra.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_naive_professor_monster.sql
npm run dev
```

`npm test` vérifie les règles métier. `npm run typecheck` vérifie les types. `npm run build` produit le Worker et les ressources du client. Le serveur de développement autorise les accès locaux ; en production l’API exige l’identité injectée par Sites et l’accès est restreint au propriétaire par la plateforme.

## Validation de cette version

25 tests métier et de file de sauvegarde : plafond, scores, pénalités compensées, présents, numéros, officiels, titulaires, exclusions, remplacements, chrono, prolongations, clics rapides, annulation pendant la sauvegarde, reprise et conflits. Vérification des types et compilation.

API locale : lecture après écriture, répétition idempotente, conflits, validation et migration additive. Aucun test par clics ni vérification visuelle automatisée du navigateur.

La lecture facultative WebMCP `read_basketball_match` reste disponible lorsque le navigateur propose cette API. Aucun contexte compatible de validation WebMCP n’était disponible.
