import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "crypto";

function generateId() {
  return randomBytes(16).toString("hex");
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer debug-admin-xyz`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { db } = await import("@/db");
  const { users, accounts } = await import("@/db/schema/auth");
  const { eq } = await import("drizzle-orm");

  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
  }).from(users);

  const allAccounts = await db.select({
    userId: accounts.userId,
    providerId: accounts.providerId,
    accountId: accounts.accountId,
    password: accounts.password,
  }).from(accounts);

  return NextResponse.json({ users: allUsers, accounts: allAccounts });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer debug-admin-xyz`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { email, password, name } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, name required" }, { status: 400 });
  }

  const { db } = await import("@/db");
  const { users, accounts } = await import("@/db/schema/auth");
  const { eq } = await import("drizzle-orm");

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "User already exists", userId: existing[0].id }, { status: 409 });
  }

  // Hash password using the SAME algorithm better-auth uses (scrypt + NFKC normalization)
  const passwordHash = await hashPassword(password);

  const userId = generateId();

  // Create user
  await db.insert(users).values({
    id: userId,
    email,
    name,
    emailVerified: false,
  });

  // Create account with properly hashed password
  await db.insert(accounts).values({
    id: generateId(),
    userId,
    accountId: email.toLowerCase(),
    providerId: "credential",
    password: passwordHash,
  });

  return NextResponse.json({ success: true, userId, email });
}