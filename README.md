# DYM Stock — SaaS de gestion de stock

Application de gestion de boutique : point de vente, stock, approvisionnements, ventes à crédit, clients, équipe et maintenance.

## Structure

- `stock-front/` — interface React 19 + Vite + Tailwind CSS v4 (PWA, fonctionne hors ligne)
- `stock-api/` — API Laravel 10 + Sanctum (MySQL)

## Principes

- **Multi-entreprises** : chaque inscription crée une entreprise. Toutes les tables portent un `company_id`
  et chaque requête est filtrée automatiquement sur l'entreprise de l'utilisateur
  (`app/Models/Concerns/BelongsToCompany.php`). Nom, logo, couleur et paramètres sont propres à chaque entreprise.
- **Rôles** : `admin` (tout), `seller` (point de vente, clients, signalements), `technician` (maintenancier :
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
