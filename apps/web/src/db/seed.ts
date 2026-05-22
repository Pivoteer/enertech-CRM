import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { statuses } from "./schema/objects";
import { STANDARD_OBJECTS, DEAL_STAGES } from "@openclaw-crm/shared";

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("Seeding database...");

  // Check if a workspace already exists
  const existingWorkspaces = await db.select().from(schema.workspaces).limit(1);
  if (existingWorkspaces.length > 0) {
    console.log("Database already seeded, skipping...");
    await client.end();
    return;
  }

  // Create default workspace
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: "Enertech CRM",
      slug: "enertech",
      settings: {},
    })
    .returning();

  console.log(`Created workspace: ${workspace.name}`);

  // Seed standard objects (same logic as seedWorkspaceObjects in services/workspace.ts)
  for (const stdObj of STANDARD_OBJECTS) {
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

    console.log(`Created object: ${object.pluralName}`);

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

      console.log(`  Created attribute: ${attribute.title} (${attribute.type})`);

if (stdObj.slug === "deals" && attr.slug === "stage") {
        for (const stage of DEAL_STAGES) {
          await db.insert(statuses).values({
            attributeId: attribute.id,
            title: stage.title,
            color: stage.color,
            sortOrder: stage.sortOrder,
            isActive: stage.isActive,
            celebrationEnabled: stage.celebrationEnabled,
          });
        }
        console.log(`  Created ${DEAL_STAGES.length} deal stages`);
      }

      // Site stage statuses
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
          await db.insert(statuses).values({
            attributeId: attribute.id,
            title: s.title,
            color: s.color,
            sortOrder: s.sortOrder,
            isActive: s.isActive,
            celebrationEnabled: s.title === "Won",
          });
        }
        console.log(`  Created ${SITE_STAGES.length} site stages`);
      }

      // Charger status
      if (stdObj.slug === "chargers" && attr.slug === "status") {
        const CHARGER_STATUSES = [
          { title: "Active", color: "#22c55e", sortOrder: 0, isActive: true },
          { title: "Inactive", color: "#ef4444", sortOrder: 1, isActive: false },
          { title: "Maintenance", color: "#f59e0b", sortOrder: 2, isActive: true },
        ];
        for (const s of CHARGER_STATUSES) {
          await db.insert(statuses).values({
            attributeId: attribute.id,
            title: s.title,
            color: s.color,
            sortOrder: s.sortOrder,
            isActive: s.isActive,
            celebrationEnabled: false,
          });
        }
        console.log(`  Created ${CHARGER_STATUSES.length} charger statuses`);
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
          await db.insert(statuses).values({
            attributeId: attribute.id,
            title: s.title,
            color: s.color,
            sortOrder: s.sortOrder,
            isActive: s.isActive,
            celebrationEnabled: false,
          });
        }
        console.log(`  Created ${MAINT_STATUSES.length} maintenance log statuses`);
      }

      // Charger level select options
      if (stdObj.slug === "chargers" && attr.slug === "charger_level") {
        const LEVELS = [
          { title: "L2", color: "#6366f1" },
          { title: "L3 DC Fast", color: "#22c55e" },
        ];
        for (let i = 0; i < LEVELS.length; i++) {
          await db.insert(schema.selectOptions).values({
            attributeId: attribute.id,
            title: LEVELS[i].title,
            color: LEVELS[i].color,
            sortOrder: i,
          });
        }
        console.log(`  Created ${LEVELS.length} charger level options`);
      }

      // Site charger level select options
      if (stdObj.slug === "sites" && attr.slug === "charger_level") {
        const LEVELS = [
          { title: "L2", color: "#6366f1" },
          { title: "L3 DC Fast", color: "#22c55e" },
        ];
        for (let i = 0; i < LEVELS.length; i++) {
          await db.insert(schema.selectOptions).values({
            attributeId: attribute.id,
            title: LEVELS[i].title,
            color: LEVELS[i].color,
            sortOrder: i,
          });
        }
        console.log(`  Created ${LEVELS.length} site charger level options`);
      }

      // Maintenance log type options
      if (stdObj.slug === "maintenance_logs" && attr.slug === "type") {
        const TYPES = [
          { title: "Preventive", color: "#6366f1" },
          { title: "Corrective", color: "#f59e0b" },
          { title: "Inspection", color: "#22c55e" },
          { title: "Upgrade", color: "#a855f7" },
        ];
        for (let i = 0; i < TYPES.length; i++) {
          await db.insert(schema.selectOptions).values({
            attributeId: attribute.id,
            title: TYPES[i].title,
            color: TYPES[i].color,
            sortOrder: i,
          });
        }
        console.log(`  Created ${TYPES.length} maintenance type options`);
      }
    }
  }

  console.log("Seeding complete!");
  await client.end();
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
