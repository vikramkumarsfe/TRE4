import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { getRequestUserId } from "@/lib/auth";
import { kindModel, kinds, recordSchema } from "@/lib/validators";
import * as models from "@/models";
type Params = { params: Promise<{ kind: string }> };
function dateAfter(days:number){const date=new Date();date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
async function makeTopicRevisions(userId:string,topicId:string,data:Record<string,any>){if(data.status!=="Completed")return;const Model=(models as any).RevisionTask;for(const days of [1,3,7,14,30]){const exists=await Model.exists({userId,"data.topicId":topicId,"data.intervalDays":days});if(!exists)await Model.create({userId,data:{title:`Review: ${data.title}`,subject:data.subject||"Computer Science",topicId,dueDate:dateAfter(days),intervalDays:days,status:"Due"}})}}
async function makeMistakeRevision(userId:string,mistakeId:string,data:Record<string,any>){const Model=(models as any).RevisionTask,exists=await Model.exists({userId,"data.mistakeId":mistakeId});if(exists)return;await Model.create({userId,data:{title:`Revise mistake: ${data.topic||data.subject}`,subject:data.subject||"Computer Science",mistakeId,dueDate:data.nextRevision||dateAfter(1),intervalDays:1,status:"Due"}})}
async function context(req: NextRequest, params: Params) {
  const { kind } = await params.params, userId = await getRequestUserId(req);
  if (!userId) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  if (!kinds.includes(kind as typeof kinds[number])) return { error: NextResponse.json({ error: "Unknown data type." }, { status: 404 }) };
  await connectDb(); const modelName = kindModel[kind as keyof typeof kindModel];
  const Model = (models as unknown as Record<string, mongoose.Model<any>>)[modelName];
  return { userId, kind: kind as keyof typeof kindModel, Model };
}
export async function GET(req: NextRequest, params: Params) {
  try { const c=await context(req,params);if("error" in c)return c.error;const records=await c.Model.find({userId:c.userId}).sort({createdAt:-1}).lean();return NextResponse.json(records.map((r:any)=>({id:String(r._id),...r.data,createdAt:r.createdAt,updatedAt:r.updatedAt}))); }
  catch{return NextResponse.json({error:"Could not load records."},{status:500});}
}
export async function POST(req: NextRequest, params: Params) {
  try { const c=await context(req,params);if("error" in c)return c.error;const parsed=(recordSchema.shape as any)[c.kind].safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message,issues:parsed.error.issues},{status:400});const record=c.kind==="profile"?await c.Model.findOneAndUpdate({userId:c.userId},{$set:{data:parsed.data}},{new:true,upsert:true,setDefaultsOnInsert:true}):await c.Model.create({userId:c.userId,data:parsed.data});if(c.kind==="syllabus")await makeTopicRevisions(String(c.userId),String(record._id),record.data.toObject?.()??record.data);if(c.kind==="mistakes")await makeMistakeRevision(String(c.userId),String(record._id),record.data.toObject?.()??record.data);return NextResponse.json({id:String(record._id),...record.data.toObject?.()??record.data},{status:201}); }
  catch{return NextResponse.json({error:"Could not save record."},{status:500});}
}
export async function PATCH(req: NextRequest, params: Params) {
  try { const c=await context(req,params);if("error" in c)return c.error;const {id,...data}=await req.json();if(!id||!mongoose.isValidObjectId(id))return NextResponse.json({error:"Invalid record id."},{status:400});const found=await c.Model.findOne({_id:id,userId:c.userId});if(!found)return NextResponse.json({error:"Record not found."},{status:404});const parsed=(recordSchema.shape as any)[c.kind].safeParse({...found.data.toObject?.()??found.data,...data});if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message},{status:400});const record=await c.Model.findOneAndUpdate({_id:id,userId:c.userId},{$set:{data:parsed.data}},{new:true,runValidators:true});if(c.kind==="syllabus")await makeTopicRevisions(String(c.userId),String(record._id),record.data.toObject?.()??record.data);return NextResponse.json({id:String(record._id),...record.data.toObject?.()??record.data}); }
  catch{return NextResponse.json({error:"Could not update record."},{status:500});}
}
export async function DELETE(req: NextRequest, params: Params) {
  try {const c=await context(req,params);if("error" in c)return c.error;const id=new URL(req.url).searchParams.get("id");if(!id||!mongoose.isValidObjectId(id))return NextResponse.json({error:"Invalid record id."},{status:400});const result=await c.Model.deleteOne({_id:id,userId:c.userId});if(!result.deletedCount)return NextResponse.json({error:"Record not found."},{status:404});return NextResponse.json({ok:true});}
  catch{return NextResponse.json({error:"Could not delete record."},{status:500});}
}
