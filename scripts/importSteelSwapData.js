import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchScriptData } from './dbsyncHelper.js';
import DBSync from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapping of DEX names to JSON filenames
const DEX_MAPPING = {
  'Minswap': 'Minswap.json',
  'MinswapV2': 'Minswap.json',
  'MuesliSwap': 'MuesliSwap.json',
  'Spectrum': 'SpectrumFinance.json',
  'Splash': 'SplashProtocol.json',
  'SundaeSwap': 'SundaeSwap.json',
  'SundaeSwapV3': 'SundaeSwap.json',
  'VyFi': 'VyFinance.json',
  'WingRiders': 'Wingriders.json',
  'WingRidersV2': 'Wingriders.json',
  'GeniusYield': 'GeniusYield.json'
};

// Map CSV DEX names to metadata keys
const DEX_TO_METADATA_KEY = {
  'Minswap': 'Minswap',
  'MinswapV2': 'Minswap',
  'MuesliSwap': 'MuesliSwap',
  'Spectrum': 'Spectrum',
  'Splash': 'Splash',
  'SundaeSwap': 'SundaeSwap',
  'SundaeSwapV3': 'SundaeSwap',
  'VyFi': 'VyFinance',
  'WingRiders': 'Wingriders',
  'WingRidersV2': 'Wingriders',
  'GeniusYield': 'GeniusYield'
};

// Extract protocol version from DEX name (e.g., "MinswapV2" -> 2, "SundaeSwapV3" -> 3)
// Returns null for V1 (implied default)
function extractProtocolVersion(dexName) {
  const versionMatch = dexName.match(/V(\d+)$/);
  if (versionMatch) {
    return parseInt(versionMatch[1], 10);
  }
  return null; // V1 is implied, so we omit it
}

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

// Load metadata mapping file
function loadMetadataMapping() {
  const metadataPath = path.join(__dirname, '..', 'dApps_v2', 'metadata-mapping.json');
  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading metadata mapping:', error.message);
    return { mappings: {} };
  }
}

// Save metadata mapping file
function saveMetadataMapping(metadata) {
  const metadataPath = path.join(__dirname, '..', 'dApps_v2', 'metadata-mapping.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      dex: values[0],
      class: values[1],
      script_hash: values[2]
    };
  }).filter(row => row.dex && row.script_hash);
}

// Ensure metadata entry exists for a project
function ensureMetadataEntry(metadata, dexName) {
  const metadataKey = DEX_TO_METADATA_KEY[dexName] || dexName;

  if (!metadata.mappings[metadataKey]) {
    metadata.mappings[metadataKey] = {
      projectName: metadataKey,
      category: "DEFI",
      subCategory: "AMM_DEX",
      link: "",
      twitter: "",
      description: {
        short: ""
      },
      scriptMappings: {
        names: {},
        purposes: {}
      }
    };
  }

  return metadataKey;
}

// Ensure script class mappings exist
function ensureScriptMapping(metadata, metadataKey, className) {
  if (!metadata.mappings[metadataKey].scriptMappings.names[className]) {
    metadata.mappings[metadataKey].scriptMappings.names[className] = className;
  }

  if (!metadata.mappings[metadataKey].scriptMappings.purposes[className]) {
    metadata.mappings[metadataKey].scriptMappings.purposes[className] = "SPEND";
  }
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

// Format script data for the new flattened structure
function formatScriptData(scriptData, csvEntry, metadata) {
  if (!scriptData) {
    return null;
  }

  // Determine plutusVersion from database type
  const plutusVersion = dbTypeToPlutusVersion(scriptData.type);

  // Skip non-PLUTUS scripts (timelock, native)
  if (plutusVersion === null) {
    return null;
  }

  // Get metadata for this DEX
  const metadataKey = ensureMetadataEntry(metadata, csvEntry.dex);
  ensureScriptMapping(metadata, metadataKey, csvEntry.class);

  const projectMetadata = metadata.mappings[metadataKey];
  const scriptName = projectMetadata.scriptMappings.names[csvEntry.class];
  const scriptPurpose = projectMetadata.scriptMappings.purposes[csvEntry.class];

  // Extract protocol version from DEX name (e.g., MinswapV2 -> 2)
  const protocolVersion = extractProtocolVersion(csvEntry.dex);

  // Generate deterministic 8-char ID from scriptHash
  const scriptId = generateScriptId(scriptData.hash);

  // Build flattened script entry (no versions array)
  const script = {
    id: scriptId,
    name: scriptName,
    purpose: scriptPurpose,
    type: 'PLUTUS',
    scriptHash: scriptData.hash,
    fullScriptHash: `71${scriptData.hash}`,
    plutusVersion: plutusVersion
  };

  // Only add protocolVersion if it's V2 or higher (V1 is implied default)
  if (protocolVersion !== null) {
    script.protocolVersion = protocolVersion;
  }

  return {
    script,
    metadataKey,
    csvData: {
      dex: csvEntry.dex,
      class: csvEntry.class,
      scriptHash: csvEntry.script_hash
    }
  };
}

// Main function
async function main() {
  console.log('='.repeat(80));
  console.log('Importing SteelSwap Data (flattened structure)');
  console.log('='.repeat(80));
  console.log();

  // Load metadata mapping
  console.log('Loading metadata mapping...');
  const metadata = loadMetadataMapping();
  console.log(`Loaded ${Object.keys(metadata.mappings).length} project metadata entries`);
  console.log();

  // Read CSV files
  const ordersPath = path.join(__dirname, '..', 'eternl', 'ssdata', 'orders.csv');
  const poolsPath = path.join(__dirname, '..', 'eternl', 'ssdata', 'pools.csv');

  console.log('Reading CSV files...');
  const orders = parseCSV(ordersPath);
  const pools = parseCSV(poolsPath);

  console.log(`Found ${orders.length} order contracts`);
  console.log(`Found ${pools.length} pool contracts`);
  console.log(`Total: ${orders.length + pools.length} contracts to process`);
  console.log();

  // Track if metadata was modified
  const originalMetadata = JSON.stringify(metadata);

  // Combine all entries
  const allEntries = [
    ...orders.map(o => ({ ...o, type: 'order' })),
    ...pools.map(p => ({ ...p, type: 'pool' }))
  ];

  // Process all contracts and group by DEX
  const resultsByDex = {};
  let processed = 0;
  let notFound = 0;
  let skippedNonPlutus = 0;

  console.log('Processing all contracts...');
  console.log();

  for (const entry of allEntries) {
    const scriptData = await fetchScriptData(entry.script_hash);

    if (scriptData) {
      const formatted = formatScriptData(scriptData, entry, metadata);

      if (formatted) {
        const metadataKey = formatted.metadataKey;

        if (!resultsByDex[metadataKey]) {
          resultsByDex[metadataKey] = {
            projectName: metadata.mappings[metadataKey]?.projectName || metadataKey,
            outputFile: DEX_MAPPING[entry.dex] || `${metadataKey}.json`,
            scripts: []
          };
        }

        resultsByDex[metadataKey].scripts.push(formatted.script);
        processed++;
      } else {
        skippedNonPlutus++;
      }
    } else {
      notFound++;
      console.log(`  Not found: ${entry.dex} - ${entry.script_hash.substring(0, 16)}...`);
    }

    // Progress indicator every 50 contracts
    if ((processed + notFound + skippedNonPlutus) % 50 === 0) {
      console.log(`  Progress: ${processed + notFound + skippedNonPlutus}/${allEntries.length}`);
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('Results by DEX:');
  console.log('='.repeat(80));

  // Output grouped by DEX
  for (const [dex, data] of Object.entries(resultsByDex)) {
    console.log(`\n### ${data.projectName} (${data.scripts.length} scripts) -> ${data.outputFile}`);

    // Group by protocolVersion within each DEX
    const byProtocolVersion = {};
    for (const script of data.scripts) {
      const pv = script.protocolVersion || 1;
      if (!byProtocolVersion[pv]) {
        byProtocolVersion[pv] = [];
      }
      byProtocolVersion[pv].push(script);
    }

    // Output by protocol version
    for (const [pv, scripts] of Object.entries(byProtocolVersion).sort((a, b) => a[0] - b[0])) {
      console.log(`  Protocol V${pv}: ${scripts.length} scripts`);
    }
  }

  // Check if metadata was modified and save if needed
  if (JSON.stringify(metadata) !== originalMetadata) {
    console.log('\nMetadata mapping was updated with new script classes');
    saveMetadataMapping(metadata);
    console.log('Saved metadata-mapping.json');
  }

  // Merge with existing files in dApps_v2/
  console.log('\n' + '='.repeat(80));
  console.log('Merging with existing dApps_v2/ files');
  console.log('='.repeat(80));

  const outputDir = path.join(__dirname, '..', 'dApps_v2');

  for (const [metadataKey, data] of Object.entries(resultsByDex)) {
    const projectMetadata = metadata.mappings[metadataKey];

    if (!projectMetadata) {
      console.log(`  Skipping ${metadataKey} - no metadata found`);
      continue;
    }

    const outputFile = data.outputFile;
    const outputPath = path.join(outputDir, outputFile);

    let dAppJson;
    let existingScriptHashes = new Set();
    let newScriptsAdded = 0;
    let duplicatesSkipped = 0;

    // Try to read existing file
    if (fs.existsSync(outputPath)) {
      try {
        const existingContent = fs.readFileSync(outputPath, 'utf-8');
        dAppJson = JSON.parse(existingContent);

        // Build set of existing scriptHashes to avoid duplicates (flattened structure)
        if (dAppJson.scripts) {
          for (const script of dAppJson.scripts) {
            if (script.scriptHash) {
              existingScriptHashes.add(script.scriptHash);
            }
          }
        } else {
          dAppJson.scripts = [];
        }

        console.log(`  Found existing ${outputFile} with ${existingScriptHashes.size} scripts`);
      } catch (error) {
        console.log(`  Error reading ${outputFile}: ${error.message}, creating new`);
        dAppJson = null;
      }
    }

    // If no existing file, create new structure
    if (!dAppJson) {
      const projectId = generateProjectId(metadataKey);
      dAppJson = {
        id: projectId,
        projectName: projectMetadata.projectName
      };

      // Only add optional fields if they have values
      if (projectMetadata.link) dAppJson.link = projectMetadata.link;
      if (projectMetadata.twitter) dAppJson.twitter = projectMetadata.twitter;
      if (projectMetadata.category) dAppJson.category = projectMetadata.category;
      if (projectMetadata.subCategory) dAppJson.subCategory = projectMetadata.subCategory;
      if (projectMetadata.description?.short) dAppJson.description = projectMetadata.description;

      dAppJson.scripts = [];
    }

    // Add new scripts (skip duplicates by scriptHash)
    for (const newScript of data.scripts) {
      if (existingScriptHashes.has(newScript.scriptHash)) {
        duplicatesSkipped++;
        continue;
      }

      dAppJson.scripts.push(newScript);
      newScriptsAdded++;
      existingScriptHashes.add(newScript.scriptHash);
    }

    // Write to output directory
    fs.writeFileSync(outputPath, JSON.stringify(dAppJson, null, 2));

    const status = duplicatesSkipped > 0
      ? `+${newScriptsAdded} new, ${duplicatesSkipped} duplicates skipped`
      : `${newScriptsAdded} scripts`;
    console.log(`  ${outputFile} (${status})`);
  }

  // Close database connection
  await DBSync.end();

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('Summary:');
  console.log(`- Total contracts processed: ${processed}`);
  console.log(`- Not found in database: ${notFound}`);
  console.log(`- Skipped (non-PLUTUS): ${skippedNonPlutus}`);
  console.log(`- Files written: ${Object.keys(resultsByDex).length}`);
  console.log('='.repeat(80));

  return resultsByDex;
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
