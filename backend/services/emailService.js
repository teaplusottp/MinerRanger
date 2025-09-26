import nodemailer from "nodemailer";

let transporterPromise;
let previewInfoLogger;

const resolveTransporter = async () => {
  if (!transporterPromise) {
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_SECURE,
    } = process.env;

    const isConfigured = Boolean(
      SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS
    );

    if (isConfigured) {
      const secure = String(SMTP_SECURE ?? "false").toLowerCase() === "true";
      transporterPromise = Promise.resolve(
        nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT),
          secure,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
        })
      );
      previewInfoLogger = null;
    } else {
      const allowFallback = process.env.NODE_ENV !== "production";
      if (!allowFallback) {
        throw new Error(
          "SMTP configuration is incomplete. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
        );
      }

      transporterPromise = nodemailer
        .createTestAccount()
        .then((testAccount) => {
          console.warn(
            "SMTP configuration is incomplete. Using Nodemailer test account instead. OTP emails will not be delivered to real inboxes."
          );
          previewInfoLogger = (info) => {
            const url = nodemailer.getTestMessageUrl(info);
            if (url) {
              console.info(`Password reset email preview (Nodemailer test account): ${url}`);
            }
          };

          return nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
        });
    }
  }

  return transporterPromise;
};

export const sendPasswordResetOtp = async ({ to, otp }) => {
  const transporter = await resolveTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@minerranger.local";
  const subject = "Your Miner Ranger OTP Code";

  const text = `Your one-time password is ${otp}. It will expire in 10 minutes. If you did not request this, please ignore this email.`;
  const html = `<p>Your one-time password is <strong>${otp}</strong>.</p><p>It will expire in 10 minutes. If you did not request this, please ignore this email.</p>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  if (typeof previewInfoLogger === "function") {
    previewInfoLogger(info);
  }
};
