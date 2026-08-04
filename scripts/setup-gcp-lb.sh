#!/usr/bin/env bash
# One-time setup: Global External HTTPS Load Balancer in front of the two
# Cloud Run services (web + backend), with path-based routing so /api/*
# goes to the backend and everything else goes to the web (game+admin) service.
#
# Run this ONCE, after both services have been deployed at least once
# (npm run deploy:api && npm run deploy:web).
#
# Prereqs: gcloud CLI installed and authenticated, and the config values
# below filled in.

set -euo pipefail

# --- Fill these in ---
PROJECT_ID="thepinkfront"          # your GCP project id
REGION="me-west1"                  # region your Cloud Run services are deployed in
DOMAIN="your-domain.com"           # the domain you want to keep serving on
WEB_SERVICE="thepinkfront-web"
API_SERVICE="thepinkfront-api"
# ----------------------

gcloud config set project "$PROJECT_ID"
echo "Setting up Global External HTTPS Load Balancer for Google Cloud..."

echo "1/8 Reserving a global static IP..."
gcloud compute addresses create thepinkfront-lb-ip --global || true

echo "2/8 Creating serverless NEGs..."
gcloud compute network-endpoint-groups create thepinkfront-web-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-run-service="$WEB_SERVICE" || true

gcloud compute network-endpoint-groups create thepinkfront-api-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-run-service="$API_SERVICE" || true

echo "3/8 Creating backend services..."
gcloud compute backend-services create thepinkfront-web-bs \
  --global --load-balancing-scheme=EXTERNAL_MANAGED || true
gcloud compute backend-services add-backend thepinkfront-web-bs \
  --global --network-endpoint-group=thepinkfront-web-neg \
  --network-endpoint-group-region="$REGION"

gcloud compute backend-services create thepinkfront-api-bs \
  --global --load-balancing-scheme=EXTERNAL_MANAGED || true
gcloud compute backend-services add-backend thepinkfront-api-bs \
  --global --network-endpoint-group=thepinkfront-api-neg \
  --network-endpoint-group-region="$REGION"

echo "4/8 Creating URL map (default -> web, /api/* -> backend)..."
gcloud compute url-maps create thepinkfront-url-map \
  --default-service=thepinkfront-web-bs || true

gcloud compute url-maps add-path-matcher thepinkfront-url-map \
  --path-matcher-name=api-matcher \
  --new-hosts="$DOMAIN" \
  --default-service=thepinkfront-web-bs \
  --path-rules="/api/*=thepinkfront-api-bs"

echo "5/8 Requesting a managed SSL certificate for $DOMAIN..."
echo "    (this stays in PROVISIONING until DNS points at the LB IP below)"
gcloud compute ssl-certificates create thepinkfront-cert \
  --domains="$DOMAIN" --global || true

echo "6/8 Creating HTTPS target proxy + forwarding rule..."
gcloud compute target-https-proxies create thepinkfront-https-proxy \
  --url-map=thepinkfront-url-map \
  --ssl-certificates=thepinkfront-cert || true

gcloud compute forwarding-rules create thepinkfront-https-rule \
  --address=thepinkfront-lb-ip --global \
  --target-https-proxy=thepinkfront-https-proxy --ports=443 || true

echo "7/8 (Optional but recommended) HTTP -> HTTPS redirect..."
gcloud compute url-maps import thepinkfront-http-redirect --global -q <<EOF || true
defaultUrlRedirect:
  httpsRedirect: true
  stripQuery: false
EOF
gcloud compute target-http-proxies create thepinkfront-http-proxy \
  --url-map=thepinkfront-http-redirect || true
gcloud compute forwarding-rules create thepinkfront-http-rule \
  --address=thepinkfront-lb-ip --global \
  --target-http-proxy=thepinkfront-http-proxy --ports=80 || true

echo "8/8 Done provisioning. Your Load Balancer's static IP is:"
gcloud compute addresses describe thepinkfront-lb-ip --global --format='value(address)'
echo ""
echo "NEXT STEP (manual, at your domain registrar / DNS provider):"
echo "  Point $DOMAIN's A record to the IP printed above."
echo "  Remove/replace whatever A/TXT records currently point it at Firebase Hosting."
echo ""
echo "The managed SSL certificate above will move from PROVISIONING to ACTIVE"
echo "within ~15-60 minutes of the DNS record propagating. Check status with:"
echo "  gcloud compute ssl-certificates describe thepinkfront-cert --global"
