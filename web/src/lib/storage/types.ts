/*
 * Object storage abstraction (F11). Video logic talks to this interface only; the Cloudflare R2 implementation lives in
 * r2.ts and an in-memory one (tests) in memory.ts. Keys are always built by the server (keys.ts), never taken from users.
 */

export interface ObjectInfo {
  size: number;
  contentType: string | undefined;
  /** For single-part uploads R2 returns the MD5 of the content as the ETag (hex, without quotes). */
  etag: string | undefined;
}

export interface PutInput {
  /** Local file to upload (streamed, never loaded whole into memory). */
  filePath: string;
  size: number;
  contentType: string;
  /** Base64 MD5 of the file: R2 rejects the upload if the received bytes don't match (Content-MD5). */
  md5Base64: string;
}

export interface ObjectBody {
  stream: ReadableStream<Uint8Array>;
  /** Length of this response's body (the range length for partial reads). */
  contentLength: number;
}

export interface ObjectStore {
  readonly name: "r2" | "memory";
  put(key: string, input: PutInput): Promise<{ etag: string | undefined }>;
  /** Null when the object doesn't exist. */
  head(key: string): Promise<ObjectInfo | null>;
  /** Streams the object or an inclusive byte range of it. Throws ObjectNotFoundError when missing. */
  get(key: string, range?: { start: number; end: number }): Promise<ObjectBody>;
  /** A short-lived signed GET link (no credentials in it beyond the signature). */
  presignGet(key: string, options: { expiresInSeconds: number; downloadName?: string }): Promise<string>;
  /** Only for approved workflows (the R2 check's own test object). Deleting a missing object is not an error. */
  delete(key: string): Promise<void>;
}

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

/** Storage rejected the credentials or the token lacks access to the bucket. */
export class StorageAuthError extends Error {
  constructor(message = "Cloud storage rejected the credentials (check the R2 token and bucket).") {
    super(message);
    this.name = "StorageAuthError";
  }
}

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("The object does not exist in cloud storage.");
    this.name = "ObjectNotFoundError";
  }
}

/** The upload arrived but doesn't match the local file (size, type or checksum). */
export class StorageVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageVerificationError";
  }
}

/** The free-tier safety limit would be passed: uploads stop until it's reviewed. */
export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageQuotaError";
  }
}
