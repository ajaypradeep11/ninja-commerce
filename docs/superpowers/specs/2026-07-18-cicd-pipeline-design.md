# CI/CD pipeline — test → prod on push to master

**Date:** 2026-07-18
**Status:** Approved; files authored, infra pending billing.

## Goal

On every push to `master`: run all unit tests, deploy to the **test**
environment, then (fully automatic) deploy to **prod**. Keyless auth.

## Decisions

- **Prod gate:** fully automatic (test → prod, no manual approval).
- **Auth:** Workload Identity Federation (no long-lived keys).
- **Storefront:** Firebase App Hosting, two backends (test + prod). The workflow
  orchestrates only the **API**; App Hosting deploys the storefront natively.
- **Test infra:** in its own `ninja-commerce-test` GCP project (isolation).
- **Trigger branch:** `master`.

## Architecture

| | Test | Prod |
|---|---|---|
| Project | `ninja-commerce-test` (808867399514) | `ninja-commerce-1d830` (1047378822080) |
| API | new Cloud Run `ninja-commerce-api` | existing `ninja-commerce-api` |
| Storefront | new App Hosting backend (env `test`) | existing `ninja-commerce` backend |
| DB | test Supabase | prod Supabase |
| Stripe | `sk_test` | `sk_live` |

## Pipeline (`.github/workflows/deploy.yml`)

Jobs, on push to master:
1. **test** — `npm ci && npm test` for all three apps (gate).
2. **deploy-test** (needs test) — WIF auth as test SA → `prisma migrate deploy`
   on test DB → `gcloud run deploy --source` API to test Cloud Run → smoke
   `/products`.
3. **deploy-prod** (needs deploy-test) — same against prod project/DB.

Migrations run **before** the image deploy (additive-safe). `--source` deploys
preserve existing Cloud Run env vars, so env is set once at service creation and
not managed by the workflow. Injection-safe: only `push`/`workflow_dispatch`
triggers, no untrusted event input in any `run:` step, secrets passed via `env:`.

## Auth (WIF)

One pool `github-pool` + OIDC provider `github-provider` in the prod project,
attribute-conditioned to `assertion.repository == 'ajaypradeep11/ninja-commerce'`.
A `gha-deployer` service account in **each** project (roles: run.admin,
cloudbuild.builds.editor, artifactregistry.admin, storage.admin,
iam.serviceAccountUser), each impersonatable by the repo via
`roles/iam.workloadIdentityUser`.

## GitHub config (repo settings)

- Variables: `WIF_PROVIDER`, `DEPLOY_SA_TEST`, `DEPLOY_SA_PROD`.
- Secrets: `TEST_DATABASE_URL`, `PROD_DATABASE_URL`.

## Owner-performed prerequisites

1. **Enable billing on `ninja-commerce-test`** (blocks everything; ~$0 idle).
2. Create the **test App Hosting backend** (Firebase console → App Hosting →
   connect repo, environment name `test` → reads `apphosting.test.yaml`).
3. Add the GitHub vars/secrets above.
4. (For real test checkout) create a Stripe **test-mode** webhook endpoint →
   test Cloud Run `/webhooks/stripe`, set its `whsec` on the test service.

## Files

- `.github/workflows/deploy.yml` — the pipeline.
- `ecommerce-storefront/apphosting.test.yaml` — test backend env overrides.
- `setup-cicd.sh` — one-shot: APIs, SAs, WIF, bindings, test Cloud Run creation.

## Out of scope (for now)

Admin deployment (dev-only), preview environments per PR, rollback automation,
manual approval gates.
