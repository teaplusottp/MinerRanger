import crypto from "crypto";
import { Storage } from "@google-cloud/storage";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mime from "mime-types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveCredentialsPath = () => {
  if (process.env.GCS_CREDENTIALS_PATH) {
    return path.resolve(process.env.GCS_CREDENTIALS_PATH);
  }
  return path.resolve(__dirname, "../minerranger.json");
};

const bucketName = process.env.GCS_BUCKET_NAME || "minerranger";
const credentialsPath = resolveCredentialsPath();

if (!fs.existsSync(credentialsPath)) {
  throw new Error(`Google Cloud credentials not found at ${credentialsPath}`);
}

const storage = new Storage({
  keyFilename: credentialsPath,
});

const bucket = storage.bucket(bucketName);

const randomId = () => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(24).toString("hex");
};

const DATA_TYPE_RELATIVE_PATHS = {
  description: "description",
  bpmn: "bpmn",
  report: "report",
  log_raw: "log/raw",
  log_cleaned: "log/cleaned",
  chart_dotted: "charts/dotted_chart",
  chart_throughput_time_density: "charts/throughput_time_density",
  chart_unwanted_activity_stats: "charts/unwanted_activity_stats",
  store: "store",
};

const sanitizeSegment = (value, fallback) => {
  const raw = String(value ?? "").trim().toLowerCase();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized) {
    return normalized;
  }
  return fallback;
};

const ensureLeadingDot = (ext = "") => {
  if (!ext) return "";
  return ext.startsWith(".") ? ext : `.${ext}`;
};

const buildUserPrefix = (userId) => `user/${sanitizeSegment(userId, "user")}`;

const buildDatasetPrefix = ({ userId, datasetFolder }) => {
  const userPrefix = buildUserPrefix(userId);
  const datasetSegment = sanitizeSegment(datasetFolder, "dataset");
  return `${userPrefix}/metadata/${datasetSegment}`;
};

const writeEmptyObject = async (objectName) => {
  const file = bucket.file(objectName);
  await file.save(Buffer.alloc(0), {
    resumable: false,
    metadata: {
      cacheControl: "no-store",
      contentType: "application/octet-stream",
    },
  });
};

export const ensureUserBootstrapFolders = async ({ userId }) => {
  if (!userId) {
    throw new Error("userId is required to initialize user folders");
  }

  const userPrefix = buildUserPrefix(userId);
  const placeholders = [`${userPrefix}/avatar/.keep`, `${userPrefix}/metadata/.keep`];

  await Promise.all(placeholders.map((objectName) => writeEmptyObject(objectName)));
};
export const createAvatarObjectName = (userId = "user") => {
  const randomSegment = crypto.randomBytes(24).toString("hex");
  return `${buildUserPrefix(userId)}/avatar/${randomSegment}.png`;
};

export const buildDatasetGcsPrefix = ({ userId, datasetFolder }) =>
  buildDatasetPrefix({ userId, datasetFolder });

export const createDataObjectName = ({
  userId,
  datasetFolder,
  type,
  extension = "",
}) => {
  const safeExt = ensureLeadingDot(extension || "");
  const datasetPrefix = buildDatasetPrefix({ userId, datasetFolder });

  if (type === "store") {
    return `${datasetPrefix}/store/${randomId()}${safeExt}`;
  }

  const relativePath = DATA_TYPE_RELATIVE_PATHS[type] || "others";
  return `${datasetPrefix}/${relativePath}/${randomId()}${safeExt}`;
};

export const uploadAvatarBuffer = async ({ buffer, destination, contentType }) => {
  if (!buffer || !buffer.length) {
    throw new Error("Avatar upload buffer is empty");
  }

  const file = bucket.file(destination);

  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
};

export const uploadFileFromPath = async ({ localPath, destination, contentType }) => {
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error(`Local file not found: ${localPath}`);
  }

  const detectedType = contentType || mime.lookup(localPath) || undefined;

  await bucket.upload(localPath, {
    destination,
    gzip: false,
    resumable: false,
    metadata: {
      contentType: detectedType,
      cacheControl: "public, max-age=31536000",
    },
  });

  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
};

