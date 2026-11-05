import { createReadStream } from "node:fs";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { redactStorage, type R2Config } from "./config.ts";
import { ObjectNotFoundError, StorageAuthError, StorageUnavailableError, type ObjectStore } from "./types.ts";

/*
 * Cloudflare R2 through its S3-compatible API (official AWS SDK v3). Server-only: the credentials never leave this
 * module. Recent SDK versions add CRC32 checksums to every request by default; they're switched to "when required"
 * so uploads use the classic Content-MD5 integrity check, which R2 enforces (a mismatch is rejected with BadDigest).
 */

const TIMEOUT_MS = 30_000;

function translate(error: unknown, key: string): Error {
  if (error instanceof S3ServiceException) {
    const status = error.$metadata?.httpStatusCode;
    if (error.name === "NoSuchKey" || error.name === "NotFound" || status === 404) return new ObjectNotFoundError();
    if (status === 401 || status === 403 || /AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch|Unauthorized/i.test(error.name)) return new StorageAuthError();
    return new StorageUnavailableError(`Cloud storage error (${error.name}${status ? ` ${status}` : ""}).`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new StorageUnavailableError(`Cloud storage could not be reached: ${redactStorage(message).replace(key, "[key]").slice(0, 160)}`);
}

export function createR2Store(config: Extract<R2Config, { ok: true }>): ObjectStore {
  const client = new S3Client({
    region: "auto", // required by the SDK, not used by R2
    endpoint: config.endpoint,
    forcePathStyle: true, // <endpoint>/<bucket>/<key>, supported by R2; no bucket name in the host

    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 3, // the SDK retries throttling and network errors with backoff
    requestHandler: { requestTimeout: TIMEOUT_MS, connectionTimeout: 10_000 },
  });
  const Bucket = config.bucket;

  return {
    name: "r2",
    async put(key, input) {
      try {
        const result = await client.send(
          new PutObjectCommand({
            Bucket,
            Key: key,
            Body: createReadStream(/* turbopackIgnore: true */ input.filePath),
            ContentLength: input.size,
            ContentType: input.contentType,
            ContentMD5: input.md5Base64,
            CacheControl: "private, max-age=0",
          }),
        );
        return { etag: result.ETag?.replace(/"/g, "") };
      } catch (error) {
        throw translate(error, key);
      }
    },
    async head(key) {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { size: result.ContentLength ?? 0, contentType: result.ContentType, etag: result.ETag?.replace(/"/g, "") };
      } catch (error) {
        const translated = translate(error, key);
        if (translated instanceof ObjectNotFoundError) return null;
        throw translated;
      }
    },
    async get(key, range) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }));
        if (!result.Body) throw new ObjectNotFoundError();
        return { stream: result.Body.transformToWebStream() as ReadableStream<Uint8Array>, contentLength: result.ContentLength ?? 0 };
      } catch (error) {
        throw error instanceof ObjectNotFoundError ? error : translate(error, key);
      }
    },
    async presignGet(key, { expiresInSeconds, downloadName }) {
      const command = new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseContentType: "video/mp4",
        ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName.replace(/[^A-Za-z0-9._-]/g, "-")}"` : undefined,
      });
      // Signed locally: no request is made to R2 here.
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },
    async delete(key) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
      } catch (error) {
        const translated = translate(error, key);
        if (!(translated instanceof ObjectNotFoundError)) throw translated;
      }
    },
  };
}
