# eMarque Club

Table de marque pour les tournois internes et corpo. Application indépendante du logiciel officiel.

## Utilisation

« Équipes et joueurs » contient toute la base du tournoi, avec couleurs d’équipes, maillots, licences et plafonds individuels. Les statistiques s’ouvrent depuis la table de marque et concernent la rencontre sélectionnée. La base générale se trouve à droite de la navigation.

L’avant-match sélectionne les équipes, les présents, les renforts et les officiels. Après lancement, il affiche une explication : les officiels et renforts se modifient depuis la table, les joueurs et couleurs depuis la base. Les équipes engagées et le règlement restent ceux du lancement ; les nouveaux réglages s’appliquent aux prochains matchs. Les numéros et licences manquants sont mémorisés lors de leur première saisie ; les valeurs déjà en base sont conservées. Un maillot différent peut être utilisé pour une rencontre. Les renforts restent rattachés à leur équipe d’origine. Deux arbitres sont proposés par défaut, avec un marqueur et un chronométreur ; chaque personne est choisie dans les joueurs avec recherche par équipe et nom, ou saisie à la volée. Une personne ne peut occuper deux postes ni jouer et officier sur la même feuille.

Tous les joueurs présents peuvent marquer. Sélectionner le joueur puis cliquer sur le terrain ajoute immédiatement un panier à 2 ou 3 points. Aucun tir raté, pourcentage de réussite, titulaire ou remplacement n’est demandé. Annuler corrige la dernière action sans confirmation. Les lancers francs et fautes personnelles sont directs.

Les boutons ±1 s, ±10 s et ±1 min corrigent le chrono sans changer son état de marche ; cliquer sur le chrono permet une correction exacte en pause. Les temps morts pris sont visibles dans le panneau de score. La clôture demande un message et des remarques facultatifs avant confirmation. La confirmation de fin archive le résultat et les remarques, arrête le chrono et libère automatiquement la table. Aucune réouverture n’est proposée. Les statistiques des feuilles terminées restent accessibles depuis la table vide.

Les corrections de joueurs et couleurs se répercutent dans les matchs non terminés. Les changements de licence, de plafond, de maillot ou d’équipe ayant des conséquences demandent une confirmation explicative. Les collisions de maillots conservent le numéro du match. Un renfort ajouté en cours de match conserve les actions, le chrono et l’équipe d’origine ; le score de départ est recalculé après confirmation. Les feuilles terminées restent figées.

Aucun match de démonstration n’est créé. L’ancienne feuille identifiée `demo` est retirée lors de la lecture ou de l’écriture ; les autres matchs et la base restent conservés. « Réinitialiser la table » demande confirmation puis supprime uniquement la feuille ouverte, ses actions et son chrono. La base et les résultats terminés sont conservés. Terminer un match archive sa feuille et libère la table. Recommencer une préparation demande confirmation. Une rencontre ouverte doit être terminée ou réinitialisée avant la préparation suivante.

## Règlement

Voir `REGLEMENT_CORPO_2025.md` pour le rapprochement avec le PDF fourni. Le préréglage Corpo 2025 est proposé pour les futurs matchs ; les règles des feuilles déjà créées restent conservées.

Pénalités en poules : jamais licencié 0, ancien licencié 1, licencié actuel 3, plus l’éventuel point de nouvel arrivant sur ce match. Les présents comptent et les totaux se compensent : 4 contre 7 donne 3–0 au premier côté. Aucun handicap en phase finale. Ces points n’entrent pas dans les statistiques ou plafonds individuels.

## Sauvegarde

L’affichage est immédiat. La file d’enregistrement regroupe les saisies rapides, sérialise les requêtes et conserve les annulations. Les identifiants de mutation permettent de retenter une réponse perdue sans doublon. Les révisions empêchent un écrasement concurrent. D1 est la base durable ; `sessionStorage` garde une copie temporaire des actions non confirmées dans le même onglet. Une panne ou un conflit conserve la copie locale et propose une exportation de secours. Garder l’onglet ouvert jusqu’à confirmation d’enregistrement. Utiliser une table de saisie à la fois.

## Développement et validation

Node.js ≥ 22.13. Installation : `npm run install:ci`. Développement : `npm run dev`, port 5173. Les migrations D1 locales sont dans `drizzle/` et utilisent `.wrangler/state`.

`npm test` couvre les règles, prêts, conservation des matchs, synchronisation, chrono et file de sauvegarde. `npm run typecheck` vérifie les types. La compilation Sites produit le Worker et les ressources du client. L’API locale est vérifiée par lecture/écriture, idempotence, conflits et validation. Aucune vérification par clics dans le navigateur n’a été effectuée.

La lecture WebMCP facultative `read_basketball_match` expose la feuille sélectionnée quand cette API est disponible. L’API de production exige l’identité injectée par Sites ; l’accès reste privé.

L’équipe fictive « Les Lynx — test » et ses huit joueurs sont ajoutés une seule fois à la base existante lors de cette mise à jour. Aucun match de démonstration n’est créé. Les données existantes restent conservées.
