import mongoose, { Schema } from "mongoose";
const userSchema = new Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, index: true }, passwordHash: { type: String, required: true } }, { timestamps: true });
export const User = mongoose.models.User || mongoose.model("User", userSchema);

const stored = (name: string) => mongoose.models[name] || mongoose.model(name, new Schema({ userId: { type: Schema.Types.ObjectId, required: true, index: true }, data: { type: Schema.Types.Mixed, required: true } }, { timestamps: true, strict: true }));
export const ExamProfile = stored("ExamProfile");
export const StudyTask = stored("StudyTask");
export const StudySession = stored("StudySession");
export const SyllabusTopic = stored("SyllabusTopic");
export const MockTest = stored("MockTest");
export const QuestionMistake = stored("QuestionMistake");
export const RevisionTask = stored("RevisionTask");
export const WeeklyGoal = stored("WeeklyGoal");
