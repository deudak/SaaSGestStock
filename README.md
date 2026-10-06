# DYM Stock — SaaS de gestion de stock

Application de gestion de boutique : point de vente, stock, approvisionnements, ventes à crédit, clients, vendeurs et maintenance.

## Structure

- `stock-front/` — interface React 19 + Vite + Tailwind CSS v4
- `stock-api/` — API Laravel (squelette, pas encore branchée)

## Lancer le front

```bash
cd stock-front
npm install
npm run dev
```

Comptes de démonstration (boutons sur la page de connexion) :

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Administrateur | admin@dymstock.test | Password123 |
| Vendeur | seller@dymstock.test | Seller123 |

Les données sont pour l'instant stockées dans le navigateur (localStorage). Les actions sont centralisées dans `stock-front/src/store/StoreContext.jsx` pour être remplacées par des appels à l'API Laravel.

## Lancer l'API

```bash
cd stock-api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```
