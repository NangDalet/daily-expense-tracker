Profile photos, worker photos, and worker ID cards can be stored in a private Cloudflare R2 bucket. The browser keeps the existing crop and upload screens. The backend validates and re-encodes images as JPEG, uploads bytes to R2, and stores a short app image URL in PostgreSQL. Existing embedded images continue to work; uploading a replacement (or saving a worker's embedded image again) moves that image to R2.

1. Use the private [user-expend bucket](https://dash.cloudflare.com/b03c5659098d08768f7570fa2edb7638/r2/default/buckets/user-expend).
2. Create an **Object Read & Write** R2 API key scoped to that bucket. Use its **Access Key ID** and **Secret Access Key**, rather than the Cloudflare API token. See [R2 authentication](https://developers.cloudflare.com/r2/api/tokens/).
3. Copy [.env.r2.example](.env.r2.example) to `.env.r2`, enter the bucket and keys, and set `R2_ENABLED=true`. Docker Compose loads this ignored file into the backend container. Do not put credentials in frontend variables or commit the file.
4. Run `docker compose up -d --build` from the project root.
5. Upload a profile photo or worker photo. The database should contain `/api/v1/media/...`, and R2 should contain a JPEG under `profiles/`, `workers/.../photos/`, or `workers/.../id-cards/`.

The bucket needs no public domain or browser CORS rules: the authenticated backend serves the images. Profile images are restricted to their owner. Construction managers can read worker photos and ID cards. Foremen can read worker photos for their assigned sites, and cannot read ID cards. Each request checks the current database reference; replaced and removed images stop resolving immediately.

Uploads use unique object keys. Failed database transactions remove their new objects. Replaced objects are deleted only after the database commits. If a cleanup request fails, the backend logs the object key for later cleanup. A failed R2 upload leaves the existing database image unchanged.

For Render, set the same five variables on the backend service and set `R2_ENABLED=true`. New uploads require R2: when it is disabled or unavailable, uploads fail and never fall back to storing image data in PostgreSQL. Existing embedded images remain readable and can be preserved when editing other worker details. Moving existing embedded images into R2 requires a working Object Read & Write key. Removing R2 configuration while database references still point to R2 makes those images unavailable until the configuration is restored.

`python scripts/check-r2.py` checks the configured bucket using `.env.r2`, without printing credentials or object names. If the bucket name is blank, it lists buckets. Bucket-restricted keys may return `403 AccessDenied` for the account-wide listing while uploads to their permitted bucket still work.

The S3 client uses Cloudflare's [Java SDK configuration](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/), including region `auto` and disabled chunked encoding.

The client explicitly uses the SDK's [URL connection transport](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/http-configuration-url.html) to avoid Apache HTTP dependency conflicts with Spring Boot 3.3.

From the project root, `powershell -File scripts/verify-r2-local.ps1` verifies real profile, worker photo, and ID-card uploads through the local backend, authenticated image reads, direct R2 reads, and object deletion. It creates a temporary verification account and worker, and removes them afterward. The local Docker services must be running with R2 enabled.
