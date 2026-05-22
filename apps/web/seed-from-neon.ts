import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./src/db/schema";
import { STANDARD_OBJECTS, DEAL_STAGES } from "../../packages/shared/src/constants/standard-objects";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

// Use Neon pooler URL (direct connection via pooler)
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function seed() {
  console.log("🌱 Starting seed...");

  // Check if already seeded
  const existing = await db.select().from(schema.workspaces).limit(1);
  if (existing.length > 0) {
    console.log("Database already has a workspace — skipping seed.");
    await client.end();
    return;
  }

  // ── Create workspace ──────────────────────────────────────────────────
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({ name: "Enertech CRM", slug: "enertech", settings: {} })
    .returning();
  console.log(`✓ Created workspace: ${workspace.name} (${workspace.slug})`);

  // ── Create admin user ──────────────────────────────────────────────────
  const [user] = await db
    .insert(schema.users)
    .values({
      id: crypto.randomUUID(),
      name: "Alex Paterson-Jones",
      email: "alex@enertech.energy",
      emailVerified: true,
      image: null,
    })
    .returning();
  console.log(`✓ Created user: ${user.email}`);

  // Add user to workspace as admin
  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "admin",
  });
  console.log("✓ Added user as workspace admin");

  // ── Seed standard objects + EV objects ────────────────────────────────
  const ALL_OBJECTS = STANDARD_OBJECTS; // includes our new Sites, Chargers, etc.

  for (const stdObj of ALL_OBJECTS) {
    const [object] = await db
      .insert(schema.objects)
      .values({
        workspaceId: workspace.id,
        slug: stdObj.slug,
        singularName: stdObj.singularName,
        pluralName: stdObj.pluralName,
        icon: stdObj.icon,
        isSystem: true,
      })
      .returning();

    console.log(`  → ${object.pluralName}`);

    for (let i = 0; i < stdObj.attributes.length; i++) {
      const attr = stdObj.attributes[i];
      const [attribute] = await db
        .insert(schema.attributes)
        .values({
          objectId: object.id,
          slug: attr.slug,
          title: attr.title,
          type: attr.type,
          config: attr.config || {},
          isSystem: attr.isSystem,
          isRequired: attr.isRequired,
          isUnique: attr.isUnique,
          isMultiselect: attr.isMultiselect,
          sortOrder: i,
        })
        .returning();

      console.log(`    • ${attribute.title} (${attribute.type})`);

      // Deal stages
      if (stdObj.slug === "deals" && attr.slug === "stage") {
        for (const stage of DEAL_STAGES) {
          await db.insert(schema.statuses).values({
            attributeId: attribute.id,
            title: stage.title,
            color: stage.color,
            sortOrder: stage.sortOrder,
            isActive: stage.isActive,
            celebrationEnabled: stage.celebrationEnabled,
          });
        }
        console.log(`      +${DEAL_STAGES.length} deal stages`);
      }

      // Site stages
      if (stdObj.slug === "sites" && attr.slug === "stage") {
        const SITE_STAGES = [
          { title: "New Lead", color: "#6366f1", sortOrder: 0, isActive: true },
          { title: "Site Walk", color: "#8b5cf6", sortOrder: 1, isActive: true },
          { title: "Proposal", color: "#a855f7", sortOrder: 2, isActive: true },
          { title: "Contract Sent", color: "#d946ef", sortOrder: 3, isActive: true },
          { title: "Won", color: "#22c55e", sortOrder: 4, isActive: false },
          { title: "Lost", color: "#ef4444", sortOrder: 5, isActive: false },
        ];
        for (const s of SITE_STAGES) {
          await db.insert(schema.statuses).values({
            attributeId: attribute.id, title: s.title, color: s.color,
            sortOrder: s.sortOrder, isActive: s.isActive, celebrationEnabled: s.title === "Won",
          });
        }
        console.log(`      +${SITE_STAGES.length} site stages`);
      }

      // Charger status
      if (stdObj.slug === "chargers" && attr.slug === "status") {
        const CHARGER_STATUSES = [
          { title: "Active", color: "#22c55e", sortOrder: 0, isActive: true },
          { title: "Inactive", color: "#ef4444", sortOrder: 1, isActive: false },
          { title: "Maintenance", color: "#f59e0b", sortOrder: 2, isActive: true },
        ];
        for (const s of CHARGER_STATUSES) {
          await db.insert(schema.statuses).values({
            attributeId: attribute.id, title: s.title, color: s.color,
            sortOrder: s.sortOrder, isActive: s.isActive, celebrationEnabled: false,
          });
        }
        console.log(`      +${CHARGER_STATUSES.length} charger statuses`);
      }

      // Maintenance log status
      if (stdObj.slug === "maintenance_logs" && attr.slug === "status") {
        const MAINT_STATUSES = [
          { title: "Scheduled", color: "#6366f1", sortOrder: 0, isActive: true },
          { title: "In Progress", color: "#f59e0b", sortOrder: 1, isActive: true },
          { title: "Completed", color: "#22c55e", sortOrder: 2, isActive: false },
          { title: "Cancelled", color: "#ef4444", sortOrder: 3, isActive: false },
        ];
        for (const s of MAINT_STATUSES) {
          await db.insert(schema.statuses).values({
            attributeId: attribute.id, title: s.title, color: s.color,
            sortOrder: s.sortOrder, isActive: s.isActive, celebrationEnabled: false,
          });
        }
        console.log(`      +${MAINT_STATUSES.length} maintenance log statuses`);
      }

      // Charger level select (for Chargers object)
      if (stdObj.slug === "chargers" && attr.slug === "charger_level") {
        const LEVELS = [{ title: "L2", color: "#6366f1" }, { title: "L3 DC Fast", color: "#22c55e" }];
        for (let j = 0; j < LEVELS.length; j++) {
          await db.insert(schema.selectOptions).values({
            attributeId: attribute.id, title: LEVELS[j].title, color: LEVELS[j].color, sortOrder: j,
          });
        }
        console.log(`      +${LEVELS.length} charger level options`);
      }

      // Charger level select (for Sites object)
      if (stdObj.slug === "sites" && attr.slug === "charger_level") {
        const LEVELS = [{ title: "L2", color: "#6366f1" }, { title: "L3 DC Fast", color: "#22c55e" }];
        for (let j = 0; j < LEVELS.length; j++) {
          await db.insert(schema.selectOptions).values({
            attributeId: attribute.id, title: LEVELS[j].title, color: LEVELS[j].color, sortOrder: j,
          });
        }
        console.log(`      +${LEVELS.length} site charger level options`);
      }

      // Maintenance type select
      if (stdObj.slug === "maintenance_logs" && attr.slug === "type") {
        const TYPES = [
          { title: "Preventive", color: "#6366f1" },
          { title: "Corrective", color: "#f59e0b" },
          { title: "Inspection", color: "#22c55e" },
          { title: "Upgrade", color: "#a855f7" },
        ];
        for (let j = 0; j < TYPES.length; j++) {
          await db.insert(schema.selectOptions).values({
            attributeId: attribute.id, title: TYPES[j].title, color: TYPES[j].color, sortOrder: j,
          });
        }
        console.log(`      +${TYPES.length} maintenance type options`);
      }
    }
  }

  console.log("\n✅ Seed complete!");
  console.log(`   Workspace: https://enertech-crm.vercel.app (slug: enertech)`);
  console.log(`   Login: alex@enertech.energy`);
  await client.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});