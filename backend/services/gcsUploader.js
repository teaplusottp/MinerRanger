import crypto from "crypto";
import { Storage } from "@google-cloud/storage";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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

export const createAvatarObjectName = (userId = "user") => {
  const randomSegment = crypto.randomBytes(24).toString("hex");
  return `avatars/${userId}-${randomSegment}.png`;
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
