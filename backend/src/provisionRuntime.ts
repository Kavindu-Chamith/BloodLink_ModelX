import dotenv from 'dotenv';
import { Pool } from 'pg';
dotenv.config();

/** Provision a dedicated login for this database; never use it for migrations. */
export async function provisionRuntime(ownerConnection: string, runtimeConnection: string) {
  const owner = new URL(ownerConnection), runtime = new URL(runtimeConnection);
  if (owner.hostname !== runtime.hostname || (owner.port || '5432') !== (runtime.port || '5432') || owner.pathname !== runtime.pathname) throw new Error('Runtime and migration connections must name the same database server');
  const database = decodeURIComponent(runtime.pathname.slice(1));
  const role = decodeURIComponent(runtime.username), password = decodeURIComponent(runtime.password);
  if (!/^[a-z][a-z0-9_]{0,58}$/.test(database) || role !== database + '_api' || owner.username === runtime.username) throw new Error('Use a dedicated runtime username named <database>_api');
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(password)) throw new Error('Use a random 32-128 character URL-safe runtime password');
  const connection = new Pool({ connectionString: ownerConnection, connectionTimeoutMillis: 5000 });
  const client = await connection.connect();
  try {
    await client.query('BEGIN');
    const existing = (await client.query(`SELECT oid, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = $1`, [role])).rows[0];
    if (existing) {
      if (existing.rolsuper || existing.rolcreatedb || existing.rolcreaterole || existing.rolreplication || existing.rolbypassrls || (await client.query('SELECT 1 FROM pg_auth_members WHERE member = $1', [existing.oid])).rowCount) throw new Error('Existing runtime role has elevated privileges; review it before provisioning');
      await client.query(`ALTER ROLE "${role}" LOGIN PASSWORD '${password}' NOINHERIT CONNECTION LIMIT 20`);
    } else {
      await client.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 20`);
    }
    await client.query(`GRANT CONNECT ON DATABASE "${database}" TO "${role}"`);
    await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'")).rows;
    for (const { tablename } of tables) {
      const quoted = '"' + String(tablename).replace(/"/g, '""') + '"';
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${quoted} TO "${role}"`);
    }
    await client.query(`REVOKE ALL ON TABLE public.schema_migrations FROM "${role}"`);
    await client.query(`GRANT SELECT ON TABLE public.schema_migrations TO "${role}"`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${role}"`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${role}"`);
    await client.query(`ALTER ROLE "${role}" IN DATABASE "${database}" SET statement_timeout = '15s'`);
    await client.query(`ALTER ROLE "${role}" IN DATABASE "${database}" SET lock_timeout = '5s'`);
    await client.query(`ALTER ROLE "${role}" IN DATABASE "${database}" SET idle_in_transaction_session_timeout = '60s'`);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await connection.end(); }
}

if (require.main === module) {
  if (!process.env.MIGRATION_DATABASE_URL || !process.env.DATABASE_URL) {
    console.error('Configure MIGRATION_DATABASE_URL and a dedicated DATABASE_URL first'); process.exitCode = 1;
  } else {
    provisionRuntime(process.env.MIGRATION_DATABASE_URL, process.env.DATABASE_URL)
      .then(() => console.log('Runtime database privileges configured. No credentials are logged.'))
      .catch(error => { console.error('Runtime provisioning failed:', error.code || error.message); process.exitCode = 1; });
  }
}
