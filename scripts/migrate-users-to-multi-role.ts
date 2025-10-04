import { collection, getDocs, updateDoc, doc } from "firebase/firestore"
import { db } from "../lib/firebase"

/**
 * Migration Script: Convert single role to multiple roles
 *
 * This script migrates existing users from the old single-role system
 * to the new multi-role system. It converts the 'role' field to a 'roles' array.
 *
 * Run this script once to migrate all existing users.
 */

interface OldUserData {
  id: string
  role?: "administrador" | "operativo" | "bufete"
  roles?: ("administrador" | "operativo" | "bufete")[]
  [key: string]: any
}

async function migrateUsersToMultiRole() {
  console.log("[Migration] Starting user migration to multi-role system...")

  try {
    // Get all users from the database
    const usersSnapshot = await getDocs(collection(db, "users"))

    let migratedCount = 0
    let skippedCount = 0
    let errorCount = 0

    console.log(`[Migration] Found ${usersSnapshot.size} users to process`)

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as OldUserData
      const userId = userDoc.id

      try {
        // Check if user already has roles array
        if (Array.isArray(userData.roles) && userData.roles.length > 0) {
          console.log(`[Migration] User ${userId} already has roles array, skipping...`)
          skippedCount++
          continue
        }

        // Check if user has old role field
        if (!userData.role) {
          console.log(`[Migration] User ${userId} has no role field, setting default to operativo`)
          await updateDoc(doc(db, "users", userId), {
            roles: ["operativo"],
          })
          migratedCount++
          continue
        }

        // Convert single role to roles array
        const newRoles: ("administrador" | "operativo" | "bufete")[] = [userData.role]

        console.log(`[Migration] Migrating user ${userId} from role '${userData.role}' to roles array`)

        await updateDoc(doc(db, "users", userId), {
          roles: newRoles,
        })

        migratedCount++
        console.log(`[Migration] Successfully migrated user ${userId}`)
      } catch (error) {
        console.error(`[Migration] Error migrating user ${userId}:`, error)
        errorCount++
      }
    }

    console.log("\n[Migration] Migration completed!")
    console.log(`[Migration] Total users: ${usersSnapshot.size}`)
    console.log(`[Migration] Migrated: ${migratedCount}`)
    console.log(`[Migration] Skipped (already migrated): ${skippedCount}`)
    console.log(`[Migration] Errors: ${errorCount}`)

    if (errorCount > 0) {
      console.warn("[Migration] Some users failed to migrate. Please check the errors above.")
    } else {
      console.log("[Migration] All users successfully migrated!")
    }
  } catch (error) {
    console.error("[Migration] Fatal error during migration:", error)
    throw error
  }
}

// Run the migration
migrateUsersToMultiRole()
  .then(() => {
    console.log("[Migration] Script completed successfully")
  })
  .catch((error) => {
    console.error("[Migration] Script failed:", error)
    process.exit(1)
  })
