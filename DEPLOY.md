# Deploy — Node.js + Firebase Hosting (no Docker)

The game and admin panel are static files built with Node/npm and published to **Firebase Hosting**.

## Prerequisites
```bash
npm run install:all
npm i -g firebase-tools   # if needed
firebase login
firebase use thepinkfront   # or rely on .firebaserc
```

## Local development
```bash
npm run dev                 # game → http://localhost:3000
npm run dev:admin           # admin panel (separate Vite app)
npm run dev:backend         # API only if you need admin/auth analytics (backend/.env)
```

## Deploy game + admin to Firebase
```bash
npm run deploy
# same as: npm run deploy:hosting
# builds with scripts/build-firebase.mjs → firebase-public/
# then: firebase deploy --only hosting
```

Live site: https://readysetvote.ourknesset.org  
Legacy Firebase URL: https://thepinkfront.web.app

## Backend (optional, local Node — not Docker)
Admin Google login and Mongo analytics need the Express API running separately:

```bash
cp backend/.env.example backend/.env   # fill MONGODB_URI, secrets
npm run dev:backend                    # http://localhost:3001
```

Firebase Hosting itself does **not** run the backend. There is no Docker requirement for this stack.

## Admin Auth0
Protects **only** `/admin` (the React admin app). The public game at `/` stays open.

1. Auth0 Application type: **SPA**
2. Allowed Callback / Logout / Web Origins, for example:
   - `https://readysetvote.ourknesset.org/admin/`
   - `https://thepinkfront.web.app/admin/`
   - `http://localhost:5173/` (local admin dev)
3. Create `frontend/.env` from `frontend/.env.example` (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`)
4. For API lock (questions/analytics), set the same domain/client id on the backend:
   - `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `ADMIN_WHITELIST` in `backend/.env`
5. Redeploy: `npm run deploy` (Auth0 vars must be available when building admin, or set them in the shell before deploy)
