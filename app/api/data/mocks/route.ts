import { NextRequest } from "next/server";
import {
  GET as getRecords,
  POST as createRecord,
  PATCH as updateRecord,
  DELETE as deleteRecord,
} from "../[kind]/route";

const params = { params: Promise.resolve({ kind: "mocks" }) };

export function GET(request: NextRequest) {
  return getRecords(request, params);
}

export function POST(request: NextRequest) {
  return createRecord(request, params);
}

export function PATCH(request: NextRequest) {
  return updateRecord(request, params);
}

export function DELETE(request: NextRequest) {
  return deleteRecord(request, params);
}
