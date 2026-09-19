import mongoose, { type InferSchemaType } from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // 建立唯一索引，避免同時註冊造成重複帳號
      lowercase: true,
      trim: true,
    },
    // 只存 bcrypt 雜湊，絕不存明文密碼
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: mongoose.Model<UserDoc> =
  mongoose.models.User ?? mongoose.model("User", userSchema);
