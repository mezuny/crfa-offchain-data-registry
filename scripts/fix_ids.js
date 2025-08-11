#!/usr/bin/env node

/**
 * Script to fix invalid IDs in JSON files and generate proper 8-character IDs.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generates a random alphanumeric ID of a specified length.
 * @param {number} [length=8] - The desired length of the ID.
 * @returns {string} The generated random ID.
 */
function generateRandomId(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

/**
 * Gets all existing valid IDs from JSON files to avoid duplicates.
 * @param {string} dappsDir - The path to the directory containing JSON files.
 * @returns {Set<string>} A Set of all existing valid IDs.
 */
function getExistingIds(dappsDir) {
    const existingIds = new Set();
    const jsonFiles = fs.readdirSync(dappsDir).filter(file => path.extname(file) === '.json');

    for (const jsonFile of jsonFiles) {
        const filePath = path.join(dappsDir, jsonFile);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (data.id && data.id.length === 8 && /^[a-zA-Z0-9]+$/.test(data.id)) {
                existingIds.add(data.id);
            }
        } catch (error) {
            continue; // Skip files that are not valid JSON
        }
    }

    return existingIds;
}

/**
 * Generates a unique ID that doesn't exist in the provided set.
 * @param {Set<string>} existingIds - A Set of existing IDs to check against.
 * @param {number} [length=8] - The desired length of the ID.
 * @returns {string} The unique ID.
 */
function generateUniqueId(existingIds, length = 8) {
    let newId;
    do {
        newId = generateRandomId(length);
    } while (existingIds.has(newId));

    existingIds.add(newId);
    return newId;
}

/**
 * Fixes the ID in a specific file if it's invalid.
 * @param {string} filePath - The path to the JSON file.
 * @param {Set<string>} existingIds - A Set of existing IDs to check against and update.
 * @returns {boolean} True if the ID was fixed, false otherwise.
 */
function fixFileId(filePath, existingIds) {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const currentId = data.id || '';

        // Check if ID is invalid (not 8 alphanumeric characters)
        if (!(currentId.length === 8 && /^[a-zA-Z0-9]+$/.test(currentId))) {
            const newId = generateUniqueId(existingIds);
            const oldId = currentId;
            data.id = newId;

            // Write back to file with proper formatting
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');

            console.log(`✅ Fixed ${path.basename(filePath)}: '${oldId}' -> '${newId}'`);
            return true;
        } else {
            console.log(`✅ ${path.basename(filePath)}: ID '${currentId}' is already valid`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error processing ${path.basename(filePath)}: ${error.message}`);
        return false;
    }
}

/**
 * Main function to fix all invalid IDs.
 */
function main() {
    const rootDir = path.resolve(__dirname, '..');
    const dappsDir = path.join(rootDir, 'dApps');

    if (!fs.existsSync(dappsDir)) {
        console.error(`❌ dApps directory not found: ${dappsDir}`);
        return;
    }

    console.log('🔍 Finding files with invalid IDs...');

    const existingIds = getExistingIds(dappsDir);
    console.log(`📊 Found ${existingIds.size} existing valid IDs`);

    const jsonFiles = fs.readdirSync(dappsDir)
        .filter(file => path.extname(file) === '.json')
        .sort();

    let fixedCount = 0;

    for (const jsonFile of jsonFiles) {
        if (fixFileId(path.join(dappsDir, jsonFile), existingIds)) {
            fixedCount++;
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   🔧 Fixed files: ${fixedCount}`);
    console.log(`   📄 Total files: ${jsonFiles.length}`);
}

// Run the main function
main();