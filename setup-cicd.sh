#!/usr/bin/env bash
# ─── One-time CI/CD infrastructure setup ─────────────────────────────────────
# Creates keyless GitHub→GCP auth (Workload Identity Federation), a deployer
# service account per project, and the TEST Cloud Run service. Idempotent: safe
# to re-run (existing resources are skipped).
#
# PREREQUISITES (do these first):
#   1. Billing enabled on the ninja-commerce-test project.
#   2. gcloud authed as an owner:  gcloud auth login
#   3. stack.secrets.test.env filled in (used for the test service's env vars).
#
# After it runs, it prints the exact GitHub repo vars/secrets to set.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

REPO="ajaypradeep11/ninja-commerce"
REGION="us-east4"
SERVICE="ninja-commerce-api"
PROD_PROJECT="ninja-commerce-1d830"
PROD_NUMBER="1047378822080"
TEST_PROJECT="ninja-commerce-test"
TEST_NUMBER="808867399514"
POOL="github-pool"
PROVIDER="github-provider"
SA_ID="gha-deployer"
# The WIF pool lives in the prod project but impersonates SAs in BOTH projects.
POOL_HOST_PROJECT="$PROD_PROJECT"
POOL_HOST_NUMBER="$PROD_NUMBER"

CORS_TEST="${CORS_TEST:-http://localhost:3005,http://localhost:5174}"  # add the test hosted.app origin after the App Hosting backend exists

# ── Load test service env from the secrets file ─────────────────────────────
[ -f stack.secrets.test.env ] || { echo "❌ stack.secrets.test.env missing"; exit 1; }
set -a; . ./stack.secrets.test.env; set +a
: "${DATABASE_URL:?}" "${STRIPE_SECRET_KEY:?}" "${STRIPE_WEBHOOK_SECRET:?}"

echo "🔧 CI/CD setup — repo=$REPO  test=$TEST_PROJECT  prod=$PROD_PROJECT"

# ── 1. Enable required APIs on both projects ────────────────────────────────
APIS="run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com"
for P in "$TEST_PROJECT" "$PROD_PROJECT"; do
  echo "▶️  enabling APIs on $P"
  gcloud services enable $APIS --project "$P" --quiet
done

# ── 2. Deployer service account per project (with deploy roles) ──────────────
create_sa() {  # PROJECT
  local P="$1" SA="${SA_ID}@$1.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "$SA" --project "$P" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$SA_ID" --project "$P" --display-name "GitHub Actions deployer" --quiet
  fi
  for ROLE in roles/run.admin roles/cloudbuild.builds.editor roles/artifactregistry.admin roles/storage.admin roles/iam.serviceAccountUser roles/firebasehosting.admin; do
    gcloud projects add-iam-policy-binding "$P" --member "serviceAccount:$SA" --role "$ROLE" --condition=None --quiet >/dev/null
  done
  echo "   ✓ SA ready: $SA"
}
echo "▶️  service accounts"
create_sa "$TEST_PROJECT"
create_sa "$PROD_PROJECT"

# ── 3. Workload Identity Federation pool + provider (repo-restricted) ────────
echo "▶️  workload identity federation (in $POOL_HOST_PROJECT)"
if ! gcloud iam workload-identity-pools describe "$POOL" --project "$POOL_HOST_PROJECT" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --project "$POOL_HOST_PROJECT" --location global --display-name "GitHub Actions" --quiet
fi
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$POOL_HOST_PROJECT" --location global --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --project "$POOL_HOST_PROJECT" --location global --workload-identity-pool "$POOL" \
    --display-name "GitHub" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition "assertion.repository == '$REPO'" \
    --issuer-uri "https://token.actions.githubusercontent.com" --quiet
fi

WIF_PROVIDER="projects/${POOL_HOST_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
PRINCIPAL="principalSet://iam.googleapis.com/projects/${POOL_HOST_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}"

# ── 4. Let the GitHub repo impersonate each deployer SA ──────────────────────
echo "▶️  binding repo → SA impersonation"
for P in "$TEST_PROJECT" "$PROD_PROJECT"; do
  gcloud iam service-accounts add-iam-policy-binding "${SA_ID}@$P.iam.gserviceaccount.com" \
    --project "$P" --role roles/iam.workloadIdentityUser --member "$PRINCIPAL" --quiet >/dev/null
done

# ── 5. Create the TEST Cloud Run service with its env (first deploy) ─────────
echo "▶️  creating test Cloud Run service (first deploy — builds via Cloud Build)"
gcloud run deploy "$SERVICE" \
  --source ecommerce-api \
  --project "$TEST_PROJECT" \
  --region "$REGION" \
  --allow-unauthenticated \
  --quiet \
  --set-env-vars "^|^DATABASE_URL=${DATABASE_URL}|STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}|STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}|FIREBASE_PROJECT_ID=${TEST_PROJECT}|FRONTEND_URL=http://localhost:3005|CORS_ORIGINS=${CORS_TEST}"

TEST_URL=$(gcloud run services describe "$SERVICE" --project "$TEST_PROJECT" --region "$REGION" --format='value(status.url)')

# ── Done — print what to put in GitHub ──────────────────────────────────────
cat <<EOF

✅ CI/CD infrastructure ready. Test API: $TEST_URL

Add these to the GitHub repo ($REPO) → Settings → Secrets and variables → Actions:

  Variables (not secret):
    WIF_PROVIDER   = $WIF_PROVIDER
    DEPLOY_SA_TEST = ${SA_ID}@${TEST_PROJECT}.iam.gserviceaccount.com
    DEPLOY_SA_PROD = ${SA_ID}@${PROD_PROJECT}.iam.gserviceaccount.com

  Secrets:
    TEST_DATABASE_URL = (the test Supabase URL from stack.secrets.test.env)
    PROD_DATABASE_URL = (the prod Supabase URL from stack.secrets.prod.env)

Then push to master to trigger the pipeline. Remember to update the test
service's CORS_ORIGINS once the test App Hosting backend URL exists:
  gcloud run services update $SERVICE --project $TEST_PROJECT --region $REGION \\
    --update-env-vars '^|^CORS_ORIGINS=<test-hosted.app-origin>,http://localhost:3005,http://localhost:5174'
EOF
