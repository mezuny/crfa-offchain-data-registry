import { Pool } from 'pg';
import DBSync from "./db.js";

// interface IDBSyncScriptData {
//     script_id: number
//     tx_id: number
//     hash: string
//     type: 'PlutusV1' | 'PlutusV2' | 'PlutusV3' | 'timelock'
//     json: string
//     bytes: string
//     serialised_size: number
// }

export const fetchScriptData = async (paymentCred) => {

    if (!paymentCred) { return null }

    const DBSyncScriptData = await DBSync.query(`SELECT id, tx_id, ENCODE(hash, 'hex') as hash, type, json, ENCODE(bytes, 'hex') as bytes, serialised_size FROM script WHERE hash = DECODE($1, 'hex')`,
        [
            paymentCred
        ])

    return DBSyncScriptData.rows[0] ?? null
}