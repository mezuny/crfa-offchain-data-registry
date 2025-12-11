/**
 * Migration Script: dApps/ -> dApps_v2/
 *
 * This script migrates existing dApp JSON files from the old format to the new format.
 * It flattens the script structure (no more versions array) and looks up plutusVersion from db-sync.
 *
 * Usage: node scripts/migrateDApps.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchScriptData } from './dbsyncHelper.js';
import DBSync from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base62 character set for ID generation
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Generate an 8-character deterministic ID from a scriptHash (hex string)
function generateScriptId(scriptHash) {
  const hexPortion = scriptHash.substring(0, 12);
  let num = BigInt('0x' + hexPortion);
  let result = '';
  const base = BigInt(62);

  for (let i = 0; i < 8; i++) {
    const remainder = num % base;
    result = BASE62_CHARS[Number(remainder)] + result;
    num = num / base;
  }

  return result;
}

// Generate an 8-character deterministic ID from a project name (string)
function generateProjectId(projectName) {
  let hash = 0n;
  for (let i = 0; i < projectName.length; i++) {
    const char = BigInt(projectName.charCodeAt(i));
    hash = ((hash << 5n) - hash) + char;
    hash = hash & 0xFFFFFFFFFFFFn;
  }

  let result = '';
  const base = 62n;
  let num = hash;

  for (let i = 0; i < 8; i++) {
    const remainder = num % base;
    result = BASE62_CHARS[Number(remainder)] + result;
    num = num / base;
  }

  return result;
}

// Convert db-sync type to plutusVersion number
function dbTypeToPlutusVersion(dbType) {
  if (!dbType) return null;
  const typeMap = {
    'plutusV1': 1,
    'plutusV2': 2,
    'plutusV3': 3
  };
  return typeMap[dbType] || null;
}

// Main migration function
async function migrate() {
  const sourceDir = path.join(__dirname, '..', 'dApps');
  const targetDir = path.join(__dirname, '..', 'dApps_v2');

  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log('='.repeat(80));
  console.log('Migrating dApps/ to dApps_v2/ (strict new structure)');
  console.log('='.repeat(80));
  console.log();

  // Get all JSON files in source directory
  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} files to migrate`);
  console.log();

  let totalMigrated = 0;
  let totalScripts = 0;
  let dbLookups = 0;
  let errors = [];

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    try {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const oldDApp = JSON.parse(content);

      // Build new dApp with only allowed fields
      const newDApp = {
        id: generateProjectId(oldDApp.projectName || file.replace('.json', '')),
        projectName: oldDApp.projectName
      };

      // Add optional fields only if they exist
      if (oldDApp.link) newDApp.link = oldDApp.link;
      if (oldDApp.twitter) newDApp.twitter = oldDApp.twitter;
      if (oldDApp.category) newDApp.category = oldDApp.category;
      if (oldDApp.subCategory) newDApp.subCategory = oldDApp.subCategory;
      if (oldDApp.description?.short) newDApp.description = { short: oldDApp.description.short };

      // Flatten scripts - each version becomes its own script entry
      const newScripts = [];

      if (oldDApp.scripts && Array.isArray(oldDApp.scripts)) {
        for (const oldScript of oldDApp.scripts) {
          if (!oldScript.versions || !Array.isArray(oldScript.versions)) continue;

          for (const version of oldScript.versions) {
            // Get scriptHash - try different locations
            let scriptHash = version.scriptHash || version.mintPolicyID;

            // Skip if no scriptHash
            if (!scriptHash) continue;

            // Normalize scriptHash (remove any prefix if present)
            if (scriptHash.length > 56) {
              scriptHash = scriptHash.slice(-56);
            }

            // Always fetch plutusVersion from db-sync for consistency
            let plutusVersion = null;
            const dbData = await fetchScriptData(scriptHash);
            if (dbData?.type) {
              plutusVersion = dbTypeToPlutusVersion(dbData.type);
              dbLookups++;
            }

            // Skip if we still can't determine plutusVersion (non-PLUTUS scripts)
            if (!plutusVersion) continue;

            // Build fullScriptHash
            const fullScriptHash = version.fullScriptHash || ('71' + scriptHash);

            // Create flattened script entry
            const newScript = {
              id: generateScriptId(scriptHash),
              name: oldScript.name || 'Unknown',
              purpose: oldScript.purpose || 'SPEND',
              type: oldScript.type || 'PLUTUS',
              scriptHash: scriptHash,
              fullScriptHash: fullScriptHash,
              plutusVersion: plutusVersion
            };

            // Add protocolVersion if present
            if (oldScript.protocolVersion) {
              newScript.protocolVersion = oldScript.protocolVersion;
            }

            newScripts.push(newScript);
            totalScripts++;
          }
        }
      }

      newDApp.scripts = newScripts;

      // Write migrated file
      fs.writeFileSync(targetPath, JSON.stringify(newDApp, null, 2));

      totalMigrated++;
      console.log(`  ${file} (${newScripts.length} scripts)`);

    } catch (error) {
      errors.push({ file, error: error.message });
      console.log(`  ${file}: ${error.message}`);
    }
  }

  // Close database connection
  await DBSync.end();

  console.log();
  console.log('='.repeat(80));
  console.log('Migration Summary:');
  console.log(`- Files migrated: ${totalMigrated}/${files.length}`);
  console.log(`- Total scripts: ${totalScripts}`);
  console.log(`- DB lookups for plutusVersion: ${dbLookups}`);
  if (errors.length > 0) {
    console.log(`- Errors: ${errors.length}`);
    for (const err of errors) {
      console.log(`    ${err.file}: ${err.error}`);
    }
  }
  console.log('='.repeat(80));
}

// Run migration
migrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
