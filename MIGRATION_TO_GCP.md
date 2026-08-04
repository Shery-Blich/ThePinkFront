# Migration to Google Cloud

מעבר מ-Firebase Hosting ל-100% Google Cloud (Cloud Run + Load Balancer).

## סקירה כללית

**לפני (Firebase Hosting + Cloud Run):**
- Firebase Hosting ← game + admin (static)
- Cloud Run ← backend API
- 2 שירותים, דומיין אחד

**אחרי (100% Google Cloud - Cloud Run + LB):**
- Cloud Run Service #1 ← web (nginx עם game + admin)
- Cloud Run Service #2 ← backend (כמו היום)
- Global External HTTPS Load Balancer ← routing + SSL
- MongoDB Atlas ← DB (managed)
- דומיין אחד → LB IP (DNS A record)

---

## צעד 1: הכנה

### 1.1 gcloud + Firebase CLI
```bash
# אם עדיין לא installed
gcloud auth login
gcloud config set project thepinkfront
firebase login  # אופציונלי (רק לניקוי Firebase אחרי)
```

### 1.2 ערכים ל-.env.production
**עדיין צריך למלא את `.env.production` עם ערכים בפועל:**

```bash
cp .env.production.example .env.production
```

ואז ערוך את ``.env.production``:
```ini
GCP_PROJECT_ID=thepinkfront
GCP_REGION=me-west1

# MongoDB Atlas — אם עדיין לא קיים:
# https://cloud.mongodb.com → create cluster (free tier available)
MONGODB_URI=mongodb+srv://user:password@cluster.xxxxx.mongodb.net/dykehaton

JWT_SECRET=your_long_random_secret_32chars_or_more
JWT_EXPIRES_IN=1h
GOOGLE_CLIENT_ID=your_google_oauth_id.apps.googleusercontent.com
ADMIN_WHITELIST=your_email@example.com
CLIENT_ORIGIN=https://your-domain.com
COOKIE_SECURE=true
```

---

## צעד 2: Deploy שני ה-Cloud Run Services

### 2.1 Deploy Backend API
```bash
npm run deploy:api
```
זה:
- בונה את `backend/Dockerfile`
- דוחף ל-Cloud Run: `thepinkfront-api`
- עם `MONGODB_URI` ו-secrets מ-`.env.production`

### 2.2 Deploy Web (Game + Admin)
```bash
npm run deploy:web
```
זה:
- בונה את ה-Dockerfile הראשי (stage: `web`)
- דוחף ל-Cloud Run: `thepinkfront-web`
- שמקנטן את nginx עם הגיים והפאנל

**סטטוס:** קיבלת 2 Cloud Run services שיוצאים מ-unique URLs כמו:
- `https://thepinkfront-web-xxx.run.app`
- `https://thepinkfront-api-xxx.run.app`

אבל רוצים דומיין אחד. זה בא בצעד הבא.

---

## צעד 3: הקמת Load Balancer + SSL + Custom Domain

### 3.1 ערוך את setup-gcp-lb.sh
בקובץ `scripts/setup-gcp-lb.sh`, ערוך את הערכים בראש:

```bash
PROJECT_ID="thepinkfront"
REGION="me-west1"
DOMAIN="your-domain.com"  # ← כאן את הדומיין שלך
WEB_SERVICE="thepinkfront-web"
API_SERVICE="thepinkfront-api"
```

### 3.2 הריץ את הסקריפט
```bash
bash scripts/setup-gcp-lb.sh
```

הסקריפט עשה:
✅ Static IP חדש
✅ Serverless NEGs (connectors בין LB ל-Cloud Run)
✅ Backend services עם health checks
✅ URL map עם routing: `/api/*` → backend, הכל אחר → web
✅ Managed SSL certificate (צריך לחכות ~15 דקות לאישור)
✅ HTTPS forwarding rule

**בסוף הסקריפט, הוא דפיס את ה-IP שלך.** שמור אותו.

---

## צעד 4: עדכון DNS

בדומיין שלך (ב-registrar שלך - GoDaddy, Namecheap, etc):

1. מצא את רשומת ה-A שמצביעה ל-Firebase Hosting
2. החלף אותה ב-IP החדש שקיבלת מ-setup-gcp-lb.sh
3. שמור

**דוגמה:**
```
Domain: your-domain.com
Type: A
Value: 35.201.x.x.x  (← IP של Load Balancer)
TTL: 3600
```

**כמה זמן לחכות:**
- DNS propagation: ~15 דקות (יכול להיות עד שעה)
- SSL cert active: ~15 דקות אחרי ש-DNS עדכן
- ביחד: 30-60 דקות עד שהכל live

בזמן ההמתנה, אתה יכול לבדוק סטטוס:
```bash
gcloud compute ssl-certificates describe thepinkfront-cert --global
```
חפש `status: ACTIVE`.

---

## צעד 5: בדיקה

אחרי שה-DNS התעדכן ו-SSL פעיל:

```bash
curl https://your-domain.com
# צפוי: HTML של המשחק

curl https://your-domain.com/admin
# צפוי: HTML של פאנל אדמין

curl https://your-domain.com/api/health
# צפוי: JSON response מה-backend
```

---

## צעד 6: ניקוי (אופציונלי)

אם רוצה להוציא את Firebase Hosting לגמרי:

### 6.1 Delete Firebase Hosting (אם רוצה)
אם רוצה להוציא את Firebase Hosting בגמרי:

```bash
firebase hosting:sites:delete
rm .firebaserc
rm scripts/build-firebase.mjs
npm uninstall firebase-tools  # אם לא צריך עוד
```

**הערה:** זה אופציונלי. אפשר להשאיר את Firebase CLI אם עשוי להיות שימושי בעתיד.

---

## צעד 7: עדכן .gitignore (אופציונלי)

בשביל לא להעלות את `.env.production` ל-Git — כבר מוגדר ב-`.gitignore`.
אם מסיבה כלשהי חסר:
```bash
echo ".env.production" >> .gitignore
```

---

## תיקיות בעיות

### SSL certificate still PROVISIONING אחרי שעה
- בדוק ש-DNS A record עדכן בפועל:
  ```bash
  nslookup your-domain.com
  ```
- גוגל צריך לראות את דומיינך מצביע ל-LB IP. אם לא, אחכה יותר.

### 502 Bad Gateway
- בדוק שה-Cloud Run services רצים:
  ```bash
  gcloud run services list
  ```
- תוודא ש-MONGODB_URI נכון (תנסה להתחבר בשכל אחרון)

### `/api` לא עובד (הגיע ל-web במקום backend)
- תוודא שה-URL map נבנה נכון:
  ```bash
  gcloud compute url-maps describe thepinkfront-url-map
  ```
- צריך לראות `pathRules: /api/* → backend service`

---

## סיכום

**התהליך:**
1. ✅ Prep: gcloud + `.env.production`
2. ✅ Deploy: `npm run deploy:api && npm run deploy:web`
3. ✅ LB + SSL: `bash scripts/setup-gcp-lb.sh`
4. ✅ DNS: עדכן A record אצל registrar
5. ✅ Wait: 30-60 דקות
6. ✅ Test: curl מהדומיין שלך
7. (Optional) Clean up: הסר Firebase Hosting

**אחרי זה אתה על Google Cloud ב-100% — דומיין קבוע, SSL, auto-scaling.**
