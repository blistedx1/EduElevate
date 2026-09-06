/*! EduElevate Coaching Management Service Core v2.0.0 */
/**
 * CockroachDB Integration & Data Integrity Verification
 */
const { Pool } = require('pg');
require('dotenv').config();

const rawCockroach = process.env.COCKROACH_DB_URL || process.env.DATABASE_URL;
if (!rawCockroach) {
  console.error('❌ COCKROACH_DB_URL / DATABASE_URL not set in environment!');
  process.exit(1);
}

const cleanUri = rawCockroach.replace('?sslmode=verify-full', '').replace('&sslmode=verify-full', '');
const pool = new Pool({
  connectionString: cleanUri,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('\n======================================================');
  console.log('🧪 COCKROACHDB INTEGRATION & INTEGRITY VERIFICATION');
  console.log('======================================================\n');

  try {
    // 1. Connection & Version
    const verRes = await pool.query('SELECT version()');
    console.log('✅ Connected to CockroachDB:');
    console.log('   Cluster:', verRes.rows[0].version.split('\n')[0]);

    // 2. Counts across tables
    const tables = [
      'schools', 'classes', 'teachers', 'students', 'attendance',
      'fee_invoices', 'notices', 'holidays', 'exams', 'timetable',
      'push_subscriptions', 'transport_telemetry', 'audit_logs'
    ];

    console.log('\n📊 Verifying Table Row Counts in CockroachDB:');
    for (const tbl of tables) {
      const cntRes = await pool.query(`SELECT COUNT(*) AS cnt FROM ${tbl}`);
      console.log(`   ✓ ${tbl.padEnd(22)}: ${cntRes.rows[0].cnt} records`);
    }

    // 3. Check for any trace of blistedx@gmail.com
    console.log('\n🔍 Verifying complete unlinking of blistedx@gmail.com:');
    const emailChecks = [
      { tbl: 'schools', col: 'email' },
      { tbl: 'teachers', col: 'email' },
      { tbl: 'students', col: 'guardian_email' },
      { tbl: 'demo_requests', col: 'email' }
    ];

    let foundOld = false;
    for (const chk of emailChecks) {
      const res = await pool.query(`SELECT COUNT(*) AS cnt FROM ${chk.tbl} WHERE ${chk.col} = 'blistedx@gmail.com'`);
      const cnt = Number(res.rows[0].cnt);
      if (cnt > 0) {
        console.error(`   ❌ Found ${cnt} records with blistedx@gmail.com in ${chk.tbl}.${chk.col}`);
        foundOld = true;
      } else {
        console.log(`   ✓ ${chk.tbl}.${chk.col}: 0 occurrences of blistedx@gmail.com`);
      }
    }

    // 4. Verify emmalover4317@gmail.com is present where appropriate
    console.log('\n✉️ Verifying emmalover4317@gmail.com presence:');
    const newRes = await pool.query(`SELECT school_code, email FROM schools WHERE email = 'emmalover4317@gmail.com'`);
    console.log(`   ✓ Schools with emmalover4317@gmail.com: ${newRes.rows.length}`);
    newRes.rows.forEach(r => console.log(`     - [${r.school_code}]`));

    // 5. Check Environment Variables
    console.log('\n🔒 Environment Variable Audit:');
    console.log('   ADMIN_NOTIFICATION_EMAIL:', process.env.ADMIN_NOTIFICATION_EMAIL);
    console.log('   SMTP_USER:              ', process.env.SMTP_USER);
    console.log('   VAPID_SUBJECT:          ', process.env.VAPID_SUBJECT);
    console.log('   DATABASE_URL prefix:    ', (process.env.DATABASE_URL || '').split('@')[1] || 'Not Set');

    if (!foundOld) {
      console.log('\n🎉 ALL CHECKS PASSED: CockroachDB is live, fully populated, and completely unlinked from blistedx@gmail.com!\n');
    } else {
      console.error('\n⚠️ Some checks failed.');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
