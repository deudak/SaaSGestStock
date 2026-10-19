# DYM Stock — SaaS de gestion de stock

Application de gestion de boutique : point de vente, stock, approvisionnements, ventes à crédit, clients, équipe et maintenance.

## Structure

- `stock-front/` — interface React 19 + Vite + Tailwind CSS v4 (PWA, fonctionne hors ligne)
- `stock-api/` — API Laravel 10 + Sanctum (MySQL)

## Principes

- **Multi-entreprises** : chaque inscription crée une entreprise. Toutes les tables portent un `company_id`
  et chaque requête est filtrée automatiquement sur l'entreprise de l'utilisateur
  (`app/Models/Concerns/BelongsToCompany.php`). Nom, logo, couleur et paramètres sont propres à chaque entreprise.
- **Rôles** : `admin` (tout), `seller` (point de vente, clients, signalements), `accountant` (comptable : espace
  comptabilité, lit ventes et achats, saisit dépenses, règlements et écritures), `technician` (maintenancier :
  interventions et équipements uniquement, sans ventes ni stock ni prix).
- **Hors ligne** : les données de l'entreprise sont gardées sur l'appareil (IndexedDB) ; l'application tourne
  jusqu'à 30 jours sans réseau.
- **Synchronisation entre appareils** (`POST /api/sync`) : chaque modification est appliquée localement puis
  mise en file ; la file part dès que le réseau revient et la réponse apporte les changements des autres appareils
  depuis le dernier curseur (table `sync_log`).
  - Le stock n'est jamais écrasé : seuls les mouvements sont envoyés et le serveur fait le total. Un stock négatif
    signale une survente (alerte « Survente » côté admin).
  - Chaque appareil reçoit un code unique (`POST /api/devices`) qui préfixe ses numéros : `V-K7Q-0001`,
    `TR-K7Q-1`, `BC-K7Q-001` — deux appareils hors ligne ne créent jamais le même numéro.
  - Les versements sont envoyés un par un ; le montant payé d'une vente à crédit est recalculé par le serveur.

## Scanner et caisse journalière

- **Codes-barres** : champ « Code-barres » sur chaque produit. Au point de vente, une douchette USB/Bluetooth
  fonctionne directement (code + Entrée) ; le bouton **Scanner** utilise la caméra (lecteur natif du navigateur,
  sinon zxing en WebAssembly embarqué — fonctionne hors ligne et sur iPhone).
- **Caisse journalière** : le vendeur ouvre sa caisse avec un fond de caisse avant de vendre, enregistre les
  versements en banque, petites dépenses et apports, puis clôture en comptant les espèces (billet par billet).
  L'écart est calculé, expliqué et imprimable (ticket Z). L'admin suit toutes les caisses (*Ventes → Caisses*).
- Comptabilité : versements (521/571), petites dépenses (658/571), apports (571/471) et écarts de caisse
  (manquant 658, excédent 758) sont passés automatiquement.

## Langue et mode sombre

- **Langues** : français et anglais (`stock-front/src/i18n`). Le texte français sert de clé : `t("Tableau de bord")` ;
  la traduction anglaise est dans `i18n/en.js`. Une phrase absente du dictionnaire s'affiche en français.
  Les intitulés des comptes OHADA restent en français (libellés officiels).
- **Thème** : clair, sombre ou celui du système (`lib/theme.js`). Le mode sombre redéfinit les variables de
  couleur dans `index.css` ; la couleur de marque de l'entreprise s'adapte au thème.
- Choix par appareil : boutons FR/EN et soleil/lune dans l'en-tête et sur la page de connexion, ou *Mon profil → Préférences*.

## Comptabilité (plan comptable OHADA)

Espace administrateur → **Comptabilité**. Partie double, **plan comptable OHADA** (SYSCOHADA révisé 2017, classes 1 à 8), inventaire intermittent.

- **Écritures automatiques** calculées à partir des opérations (`stock-front/src/lib/accounting/engine.js`) :
  ventes (TVA séparée), annulations (contre-passation), encaissements des créances, réceptions fournisseurs,
  variation de stock (valorisée au coût d'achat), bilan d'ouverture.
- **Saisies comptables** synchronisées (admin uniquement) : dépenses, règlements fournisseurs,
  écritures manuelles équilibrées, virements internes.
- **États** : journal, grand livre, balance, compte de résultat, bilan, TVA — imprimables et exportables (Excel).
- Tests du moteur : `npm test` dans `stock-front`. Contrôle sur des données réelles :
  `node scripts/check-accounting.mjs <email> <mot de passe>`.

## Lancer l'API

```bash
cd stock-api
composer install
cp .env.example .env      # DB_DATABASE=dym_stock
php artisan key:generate
php artisan migrate
php artisan serve
```

Tests (base MySQL dédiée `dym_stock_test`, à créer vide) : `php artisan test`

## Lancer le front

```bash
cd stock-front
npm install
npm run dev
```

Adresse de l'API : `VITE_API_URL` (voir `stock-front/.env.example`, par défaut `http://127.0.0.1:8000`).

Comptes de démonstration (entreprise « DYM Stock ») :

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Administrateur | admin@dymstock.test | Password123 |
| Vendeur | seller@dymstock.test | Seller123 |

Les comptes maintenanciers se créent depuis **Équipe → Maintenanciers** dans l'espace administrateur.
