import pkg from "pg";
const { Pool } = pkg;

import {
    DBS_DATABASE_HOST,
    DBS_DATABASE_NAME,
    DBS_DATABASE_USER,
    DBS_DATABASE_PORT,
    DBS_DATABASE_PASSWORD
} from "./config.js";

export const DBSync = new Pool({
    database:       DBS_DATABASE_NAME,
    host:           DBS_DATABASE_HOST,
    password:       DBS_DATABASE_PASSWORD,
    user:           DBS_DATABASE_USER,
    port:           DBS_DATABASE_PORT,
});

export default DBSync;