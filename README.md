# DaaraGest

Application de gestion d'école franco-arabe — Sénégal

## Stack
- Frontend : React 18 + Vite + Tailwind CSS
- Backend : Node.js + Fastify + Prisma
- Base de données : PostgreSQL

## Installation

### Prérequis
- Node.js 20+
- PostgreSQL 15+

### Backend
```bash
cd backend
npm install
cp ../.env.example .env
# Remplir DATABASE_URL dans .env
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Accès par défaut
- URL : http://localhost:5173
- Email : admin@daaragest.sn
- Mot de passe : Admin123!
