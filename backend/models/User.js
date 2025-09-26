import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const dataFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const dataFolderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, required: true, default: Date.now },
    files: {
      type: [dataFileSchema],
      default: [],
      validate: [Array.isArray, "Files must be an array"],
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      default: "",
      trim: true,
    },
    lastName: {
      type: String,
      default: "",
      trim: true,
    },
    telNumber: {
      type: String,
      default: "",
      trim: true,
    },
    gender: {
      type: String,
      default: "",
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
      trim: true,
    },
    dataFolders: {
      type: [dataFolderSchema],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
