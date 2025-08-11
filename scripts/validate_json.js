#!/usr/bin/env node

/**
 * JSON Schema validation script for CRFA offchain data registry.
 * This script validates all JSON files in the dApps directory against the schema.
 */

const fs = require('fs');
const path = require('path');
const { Validator } = require('jsonschema');

/**
 * Loads and parses a JSON file.
 * @param {string} filePath - The path to the JSON file.
 * @returns {object|null} The parsed JSON object or null if an error occurred.
 */
function loadJsonFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error(`❌ Invalid JSON in ${path.basename(filePath)}: ${error.message}`);
        } else {
            console.error(`❌ Error reading ${path.basename(filePath)}: ${error.message}`);
        }
        return null;
    }
}

/**
 * Validates a single dApp JSON file against the schema.
 * @param {string} filePath - The path to the dApp JSON file.
 * @param {object} schema - The JSON schema object.
 * @returns {boolean} True if the file is valid, false otherwise.
 */
function validateDappFile(filePath, schema) {
    console.log(`🔍 Validating ${path.basename(filePath)}...`);

    const data = loadJsonFile(filePath);
    if (data === null) {
        return false;
    }

    const validator = new Validator();
    const result = validator.validate(data, schema, { required: true });

    if (result.valid) {
        console.log(`✅ ${path.basename(filePath)} is valid`);
        return true;
    } else {
        console.error(`❌ ${path.basename(filePath)} validation failed:`);
        for (const error of result.errors) {
            console.error(`   Error: ${error.message}`);
            if (error.property) {
                console.error(`   Path: ${error.property}`);
            }
        }
        return false;
    }
}

/**
 * Checks if all dApp IDs are unique across all files.
 * @param {string[]} jsonFiles - An array of paths to the JSON files.
 * @returns {boolean} True if all IDs are unique, false otherwise.
 */
function checkIdUniqueness(jsonFiles) {
    console.log('🔍 Checking ID uniqueness...');

    const idToFile = new Map();
    const duplicates = [];

    for (const filePath of jsonFiles) {
        const data = loadJsonFile(filePath);
        if (data === null) {
            continue;
        }

        const dappId = data.id;
        if (dappId) {
            if (idToFile.has(dappId)) {
                duplicates.push({
                    id: dappId,
                    files: [path.basename(idToFile.get(dappId)), path.basename(filePath)]
                });
            } else {
                idToFile.set(dappId, filePath);
            }
        }
    }

    if (duplicates.length > 0) {
        console.error('❌ Duplicate IDs found:');
        for (const dup of duplicates) {
            console.error(`   ID '${dup.id}' used in: ${dup.files.join(' and ')}`);
        }
        return false;
    } else {
        console.log(`✅ All ${idToFile.size} IDs are unique`);
        return true;
    }
}

/**
 * Main validation function.
 */
function main() {
    console.log('🚀 Starting JSON schema validation...');

    const rootDir = path.resolve(__dirname, '..');
    const schemaFile = path.join(rootDir, 'dapp-schema.json');
    const dappsDir = path.join(rootDir, 'dApps');

    console.log(`📁 Schema file: ${schemaFile}`);
    console.log(`📁 dApps directory: ${dappsDir}`);

    if (!fs.existsSync(schemaFile)) {
        console.error(`❌ Schema file not found: ${schemaFile}`);
        process.exit(1);
    }

    const schema = loadJsonFile(schemaFile);
    if (schema === null) {
        console.error('❌ Failed to load schema file');
        process.exit(1);
    }

    // A direct equivalent of Draft7Validator.check_schema isn't standard,
    // but the `jsonschema` library handles schema validation implicitly.
    console.log('✅ Schema is valid');

    if (!fs.existsSync(dappsDir)) {
        console.error(`❌ dApps directory not found: ${dappsDir}`);
        process.exit(1);
    }

    const jsonFiles = fs.readdirSync(dappsDir)
        .filter(file => path.extname(file) === '.json')
        .map(file => path.join(dappsDir, file));

    if (jsonFiles.length === 0) {
        console.warn('⚠️  No JSON files found in dApps directory');
        return;
    }

    console.log(`📄 Found ${jsonFiles.length} JSON files to validate`);

    const idsUnique = checkIdUniqueness(jsonFiles);

    let validFiles = 0;
    let invalidFiles = 0;

    for (const filePath of jsonFiles.sort()) {
        if (validateDappFile(filePath, schema)) {
            validFiles++;
        } else {
            invalidFiles++;
        }
    }

    console.log('\n📊 Validation Summary:');
    console.log(`   ✅ Valid files: ${validFiles}`);
    console.log(`   ❌ Invalid files: ${invalidFiles}`);
    console.log(`   📄 Total files: ${jsonFiles.length}`);
    console.log(`   🆔 IDs unique: ${idsUnique ? '✅ Yes' : '❌ No'}`);

    if (invalidFiles > 0 || !idsUnique) {
        const errorMsg = [];
        if (invalidFiles > 0) {
            errorMsg.push(`${invalidFiles} files have schema errors`);
        }
        if (!idsUnique) {
            errorMsg.push('duplicate IDs found');
        }

        console.error(`\n❌ Validation failed! ${errorMsg.join(' and ')}.`);
        process.exit(1);
    } else {
        console.log('\n🎉 All files are valid and all IDs are unique!');
    }
}

// Run the main function
main();