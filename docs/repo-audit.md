# DERMAXAI Repository Audit

This document records the current cleanup scope for the repository. It is intentionally concise and should be updated as functional fixes land.

## Functional cleanup scope

- Keep model class prediction separate from clinical concern/review escalation.
- Make patient diagnosis summary metrics database-backed rather than derived from a truncated history page.
- Return `lesion_id` in diagnosis history and keep lesion attachment ownership checks server-side.
- Allow profile fields to be explicitly cleared with `null`.
- Revoke previously issued access tokens after password reset by using a per-user token version.
- Make doctor case claiming return a conflict instead of an internal error under concurrent claims.
- Use Alembic as the production schema migration authority.
- Remove redundant preprocessing implementation.
- Make runtime labels accurately describe normalized entropy and the default rule-based NLP path.
- Validate TTA configuration bounds.
- Keep frontend toast configuration in one place.
- Keep README/runtime version metadata aligned.
