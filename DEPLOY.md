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

Live site: https://thepinkfront.web.app

## Backend (optional, local Node — not Docker)
Admin Google login and Mongo analytics need the Express API running separately:

```bash
cp backend/.env.example backend/.env   # fill MONGODB_URI, secrets
npm run dev:backend                    # http://localhost:3001
```

Firebase Hosting itself does **not** run the backend. There is no Docker requirement for this stack.
