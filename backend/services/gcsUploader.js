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

const DATA_TYPE_PREFIXES = {
  description: "data/description",
  bpmn: "data/bpmn",
  report: "data/report",
  log_raw: "data/log/raw",
  log_cleaned: "data/log/cleaned",
  chart_dotted: "data/charts/dotted_chart",
  chart_throughput_time_density: "data/charts/throughput_time_density",
  chart_unwanted_activity_stats: "data/charts/unwanted_activity_stats",
};

const ensureLeadingDot = (ext = "") => {
  if (!ext) return "";
  return ext.startsWith(".") ? ext : `.${ext}`;
};

export const createAvatarObjectName = (userId = "user") => {
  const randomSegment = crypto.randomBytes(24).toString("hex");
  return `avatars/${userId}-${randomSegment}.png`;
};

export const createDataObjectName = (type, extension = "") => {
  const prefix = DATA_TYPE_PREFIXES[type] || "data/others";
  const safeExt = ensureLeadingDot(extension || "");
  return `${prefix}/${randomId()}${safeExt}`;
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
