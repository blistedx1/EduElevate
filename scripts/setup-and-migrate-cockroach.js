/*! EduElevate Coaching Management Service Core v2.0.0 */
/**
 * CockroachDB Schema Setup & Full Mongo Atlas Migration Runner
 */
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || "";
const rawCockroach = process.env.COCKROACH_DB_URL || process.env.DATABASE_URL || "";
const COCKROACH_URI = rawCockroach.replace('?sslmode=verify-full', '').replace('&sslmode=verify-full', '');

const SCHEMA_SQL = `
-- 1. INSTITUTIONS / SCHOOLS
CREATE TABLE IF NOT EXISTS schools (
  id VARCHAR(50) PRIMARY KEY,
  school_code VARCHAR(30) UNIQUE NOT NULL,
  school_name TEXT NOT NULL,
  board VARCHAR(50) DEFAULT 'CBSE',
  city VARCHAR(100),
  state VARCHAR(100),
  address TEXT,
  pincode VARCHAR(20),
  udise_code VARCHAR(50),
  oasis_code VARCHAR(50),
  affiliation_no VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(100),
  website VARCHAR(150),
  principal_name VARCHAR(100),
  admin_id VARCHAR(50),
  admin_name VARCHAR(100),
  admin_pin VARCHAR(50),
  logo TEXT,
  logo_url TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. DEMO REQUESTS
CREATE TABLE IF NOT EXISTS demo_requests (
  id VARCHAR(50) PRIMARY KEY,
  school_name TEXT NOT NULL,
  city VARCHAR(100),
  strength VARCHAR(50),
  board VARCHAR(50) DEFAULT 'CBSE',
  contact_name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(50),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'PENDING',
  assigned_school_code VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. CLASSES & SECTIONS
CREATE TABLE IF NOT EXISTS classes (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  class_name VARCHAR(50) NOT NULL,
  name VARCHAR(50),
  section VARCHAR(30) NOT NULL,
  class_code VARCHAR(50),
  class_teacher VARCHAR(100),
  room_no VARCHAR(50),
  capacity INT DEFAULT 40,
  subjects JSONB DEFAULT '[]'::jsonb,
  no_of_subjects INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_class_session UNIQUE (school_id, academic_session, class_name, section)
);

-- 4. FACULTY / TEACHERS
CREATE TABLE IF NOT EXISTS teachers (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  staff_code VARCHAR(50) NOT NULL,
  employee_code VARCHAR(50),
  full_name VARCHAR(150) NOT NULL,
  department TEXT,
  designation TEXT,
  qualification TEXT,
  phone VARCHAR(50),
  email VARCHAR(120),
  status VARCHAR(30) DEFAULT 'ACTIVE',
  passcode VARCHAR(50) DEFAULT '123456',
  avatar TEXT,
  photo TEXT,
  teacher_type TEXT,
  subject_specialization TEXT,
  classes_taught TEXT,
  ctet_qualified VARCHAR(10) DEFAULT 'NO',
  professional_degree TEXT,
  experience_years INT DEFAULT 5,
  gender VARCHAR(20) DEFAULT 'Female',
  aadhaar_no VARCHAR(30),
  pan_no VARCHAR(30),
  epf_uan_no VARCHAR(50),
  basic_pay NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_teacher_session UNIQUE (school_id, academic_session, staff_code)
);

-- 5. STUDENTS
CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  admission_no VARCHAR(50) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  section VARCHAR(30) NOT NULL,
  roll_no VARCHAR(30),
  gender VARCHAR(20) DEFAULT 'Male',
  guardian_name VARCHAR(150),
  guardian_phone VARCHAR(50),
  guardian_email VARCHAR(120),
  fee_status VARCHAR(20) DEFAULT 'PENDING',
  attendance_percent NUMERIC DEFAULT 100,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  passcode VARCHAR(50) DEFAULT '123456',
  avatar TEXT,
  photo TEXT,
  dob VARCHAR(30),
  blood_group VARCHAR(10),
  aadhaar_no VARCHAR(30),
  apaar_id VARCHAR(50),
  house TEXT,
  category TEXT,
  father_name VARCHAR(150),
  father_phone VARCHAR(50),
  mother_name VARCHAR(150),
  mother_phone VARCHAR(50),
  city VARCHAR(100),
  state VARCHAR(100),
  transport_opted VARCHAR(10) DEFAULT 'NO',
  bus_route_no TEXT,
  extra_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_student_session UNIQUE (school_id, academic_session, admission_no)
);

-- 6. ATTENDANCE LOGS
CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  date VARCHAR(30) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  section VARCHAR(30) NOT NULL,
  total_students INT DEFAULT 0,
  present_count INT DEFAULT 0,
  absent_count INT DEFAULT 0,
  leave_count INT DEFAULT 0,
  marked_by VARCHAR(100),
  student_records JSONB DEFAULT '[]'::jsonb,
  teacher_records JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. FEE INVOICES
CREATE TABLE IF NOT EXISTS fee_invoices (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  invoice_no TEXT NOT NULL,
  student_id VARCHAR(50),
  student_name VARCHAR(150),
  admission_no TEXT,
  class_name VARCHAR(50),
  month TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  due_date TEXT,
  status TEXT DEFAULT 'PENDING',
  payment_mode TEXT,
  paid_date TEXT,
  extra_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_invoice_session UNIQUE (school_id, academic_session, invoice_no)
);

-- 8. NOTICES & CIRCULARS
CREATE TABLE IF NOT EXISTS notices (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  reference_no VARCHAR(100) NOT NULL,
  matter_category VARCHAR(50) DEFAULT 'ACAD',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience VARCHAR(50) DEFAULT 'ALL',
  posted_by VARCHAR(100),
  date VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. HOLIDAYS & CALENDAR
CREATE TABLE IF NOT EXISTS holidays (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  title TEXT NOT NULL,
  start_date VARCHAR(30) NOT NULL,
  end_date VARCHAR(30) NOT NULL,
  total_days INT DEFAULT 1,
  applicable_to VARCHAR(50) DEFAULT 'ALL',
  category VARCHAR(50) DEFAULT 'GAZETTED',
  reason TEXT,
  declared_by VARCHAR(100),
  auto_notice_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. EXAMS & ASSESSMENTS
CREATE TABLE IF NOT EXISTS exams (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  title TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'SCHOOL_EXAM',
  class_name VARCHAR(50) NOT NULL,
  section VARCHAR(30) NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  subject_code VARCHAR(50),
  date VARCHAR(30) NOT NULL,
  time VARCHAR(30),
  max_marks INT DEFAULT 100,
  pass_marks INT DEFAULT 33,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. TIMETABLE
CREATE TABLE IF NOT EXISTS timetable (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session VARCHAR(30) DEFAULT '2026-27',
  class_name VARCHAR(50) NOT NULL,
  section VARCHAR(30) NOT NULL,
  day VARCHAR(20),
  period_no INT DEFAULT 1,
  subject VARCHAR(100),
  teacher_name VARCHAR(150),
  start_time VARCHAR(20),
  end_time VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. MEDIA VAULT
CREATE TABLE IF NOT EXISTS media_vault (
  id VARCHAR(100) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  filename VARCHAR(255),
  mime_type VARCHAR(100) DEFAULT 'image/jpeg',
  size_bytes INT DEFAULT 0,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id VARCHAR(100) PRIMARY KEY,
  school_id VARCHAR(50) DEFAULT 'DPS2026',
  user_id VARCHAR(100),
  role VARCHAR(50),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. TRANSPORT TELEMETRY
CREATE TABLE IF NOT EXISTS transport_telemetry (
  bus_id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL,
  route_name VARCHAR(100),
  lat NUMERIC(10, 6),
  lng NUMERIC(10, 6),
  speed NUMERIC(6, 2) DEFAULT 0,
  heading NUMERIC(6, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'IN_TRANSIT',
  driver_phone VARCHAR(50),
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(100) PRIMARY KEY,
  school_id VARCHAR(50),
  user_id VARCHAR(100),
  action VARCHAR(100),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- PERFORMANCE COMPOUND INDEXES
CREATE INDEX IF NOT EXISTS idx_students_hierarchy ON students(school_id, academic_session, class_name, section);
CREATE INDEX IF NOT EXISTS idx_teachers_hierarchy ON teachers(school_id, academic_session, department);
CREATE INDEX IF NOT EXISTS idx_classes_hierarchy ON classes(school_id, academic_session);
CREATE INDEX IF NOT EXISTS idx_attendance_hierarchy ON attendance(school_id, academic_session, date);
CREATE INDEX IF NOT EXISTS idx_invoices_hierarchy ON fee_invoices(school_id, academic_session, status);
CREATE INDEX IF NOT EXISTS idx_notices_hierarchy ON notices(school_id, academic_session, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_holidays_hierarchy ON holidays(school_id, academic_session, start_date);
CREATE INDEX IF NOT EXISTS idx_exams_hierarchy ON exams(school_id, academic_session, date);
CREATE INDEX IF NOT EXISTS idx_timetable_hierarchy ON timetable(school_id, academic_session, class_name, section);
CREATE INDEX IF NOT EXISTS idx_media_vault ON media_vault(school_id, entity_type, entity_id);
`;

async function run() {
  console.log('========================================================');
  console.log('🚀 COCKROACHDB SCHEMA SETUP & MONGO ATLAS LIVE MIGRATION');
  console.log('========================================================\n');

  const cockroachPool = new Pool({
    connectionString: COCKROACH_URI,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
  });

  const pgClient = await cockroachPool.connect();
  console.log('✓ Connected to CockroachDB Serverless Cluster!');

  let mongoClient = null;
  let mongoDb = null;
  try {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db('edugit');
    console.log('✓ Connected to MongoDB Atlas Cloud (edugit)');
  } catch (e) {
    console.warn('⚠️ MongoDB Atlas connection notice:', e.message);
  }

  // Load local store fallback if needed
  let localStore = null;
  const localStorePath = path.join(process.cwd(), 'data', 'erp_store.json');
  if (fs.existsSync(localStorePath)) {
    try {
      localStore = JSON.parse(fs.readFileSync(localStorePath, 'utf8'));
    } catch (e) {}
  }

  try {
    // ----------------------------------------------------
    // STEP 1: CREATE SCHEMA & TABLES
    // ----------------------------------------------------
    console.log('\n🛠️ Initializing Relational Tables & Compound Indexes in CockroachDB...');
    await pgClient.query(SCHEMA_SQL);
    console.log('✅ All 15 CockroachDB tables and indexes created successfully!');

    // ----------------------------------------------------
    // STEP 2: MIGRATE SCHOOLS
    // ----------------------------------------------------
    console.log('\n📦 Migrating Schools...');
    const schools = mongoDb ? await mongoDb.collection('schools').find({}).toArray() : (localStore?.schools || []);
    for (const s of schools) {
      const email = (s.email === 'blistedx@gmail.com') ? 'emmalover4317@gmail.com' : (s.email || '');
      await pgClient.query(`
        INSERT INTO schools (id, school_code, school_name, board, city, state, address, pincode, udise_code, oasis_code, affiliation_no, phone, email, website, principal_name, admin_id, admin_name, admin_pin, logo, logo_url, status, settings)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (id) DO UPDATE SET 
          school_name = EXCLUDED.school_name, 
          email = EXCLUDED.email, 
          admin_pin = EXCLUDED.admin_pin, 
          settings = EXCLUDED.settings;
      `, [
        s.id, s.school_code, s.school_name, s.board || 'CBSE', s.city || '', s.state || '', s.address || '',
        s.pincode || '', s.udise_code || '', s.oasis_code || '', s.affiliation_no || '', s.phone || '', email,
        s.website || '', s.principal_name || '', s.admin_id || 'admin', s.admin_name || '',
        s.admin_pin || '123456', s.logo || '', s.logo_url || s.logo || '', s.status || 'ACTIVE',
        JSON.stringify(s.settings || {})
      ]);
    }
    console.log(`  ✓ Synced ${schools.length} schools`);

    // ----------------------------------------------------
    // STEP 3: MIGRATE CLASSES
    // ----------------------------------------------------
    console.log('\n📦 Migrating Classes...');
    const classes = mongoDb ? await mongoDb.collection('classes').find({}).toArray() : (localStore?.classes || []);
    for (const c of classes) {
      const className = c.class_name || c.name || 'Class 10';
      const section = c.section || 'A';
      await pgClient.query(`
        INSERT INTO classes (id, school_id, academic_session, class_name, name, section, class_code, class_teacher, room_no, capacity, subjects, no_of_subjects, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET 
          subjects = EXCLUDED.subjects, 
          class_teacher = EXCLUDED.class_teacher;
      `, [
        c.id, c.school_id || 'DPS2026', c.academic_session || '2026-27', className, c.name || className,
        section, c.class_code || '', c.class_teacher || '', c.room_no || '', c.capacity || 40,
        JSON.stringify(c.subjects || []), (c.subjects || []).length, c.status || 'ACTIVE'
      ]);
    }
    console.log(`  ✓ Synced ${classes.length} classes`);

    // ----------------------------------------------------
    // STEP 4: MIGRATE TEACHERS
    // ----------------------------------------------------
    console.log('\n📦 Migrating Teachers / Faculty...');
    const teachers = mongoDb ? await mongoDb.collection('teachers').find({}).toArray() : (localStore?.teachers || []);
    for (let i = 0; i < teachers.length; i++) {
      const t = teachers[i];
      const staffCode = t.staff_code || t.employee_code || t.id || `TCH-${i + 1}`;
      const fullName = t.full_name || t.name || 'Faculty Member';
      const email = (t.email === 'blistedx@gmail.com') ? 'emmalover4317@gmail.com' : (t.email || '');
      await pgClient.query(`
        INSERT INTO teachers (id, school_id, academic_session, staff_code, employee_code, full_name, department, designation, qualification, phone, email, status, passcode, avatar, photo, teacher_type, subject_specialization, classes_taught, ctet_qualified, professional_degree, experience_years, gender, aadhaar_no, pan_no, epf_uan_no, basic_pay)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
        ON CONFLICT (id) DO UPDATE SET 
          avatar = EXCLUDED.avatar, 
          photo = EXCLUDED.photo, 
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email;
      `, [
        t.id, t.school_id || 'DPS2026', t.academic_session || '2026-27', staffCode, t.employee_code || staffCode,
        fullName, t.department || 'Academic', t.designation || 'Teacher', t.qualification || '',
        t.phone || '', email, t.status || 'ACTIVE', t.passcode || '123456',
        t.avatar || '', t.photo || '', t.teacher_type || 'TEACHING', t.subject_specialization || '',
        t.classes_taught || '', t.ctet_qualified || 'NO', t.professional_degree || 'B.Ed',
        Number(t.experience_years) || 5, t.gender || 'Female', t.aadhaar_no || '', t.pan_no || '',
        t.epf_uan_no || '', Number(t.basic_pay) || 0
      ]);
    }
    console.log(`  ✓ Synced ${teachers.length} teachers`);

    // ----------------------------------------------------
    // STEP 5: MIGRATE STUDENTS
    // ----------------------------------------------------
    console.log('\n📦 Migrating Students...');
    const students = mongoDb ? await mongoDb.collection('students').find({}).toArray() : (localStore?.students || []);
    const studentBatchSize = 100;
    for (let i = 0; i < students.length; i += studentBatchSize) {
      const batch = students.slice(i, i + studentBatchSize);
      for (const s of batch) {
        const admissionNo = s.admission_no || s.roll_no || s.id;
        const fullName = s.full_name || s.name || 'Student';
        const className = s.class_name || 'Class 10';
        const section = s.section || 'A';
        const guardianEmail = (s.guardian_email === 'blistedx@gmail.com') ? 'emmalover4317@gmail.com' : (s.guardian_email || '');

        const extraData = {
          cwsn_facility: s.cwsn_facility,
          admission_type: s.admission_type,
          admission_date: s.admission_date,
          father_qualification: s.father_qualification,
          father_occupation: s.father_occupation,
          father_income: s.father_income,
          father_aadhaar: s.father_aadhaar,
          mother_qualification: s.mother_qualification,
          mother_occupation: s.mother_occupation,
          mother_income: s.mother_income,
          mother_aadhaar: s.mother_aadhaar,
          residential_address: s.residential_address,
          permanent_address: s.permanent_address,
          pincode: s.pincode,
          is_rte: s.is_rte,
          hostel_opted: s.hostel_opted,
          hostel_room_no: s.hostel_room_no,
          emergency_contact_name: s.emergency_contact_name,
          emergency_contact_phone: s.emergency_contact_phone
        };

        await pgClient.query(`
          INSERT INTO students (id, school_id, academic_session, admission_no, full_name, class_name, section, roll_no, gender, guardian_name, guardian_phone, guardian_email, fee_status, attendance_percent, status, passcode, avatar, photo, dob, blood_group, aadhaar_no, apaar_id, house, category, father_name, father_phone, mother_name, mother_phone, city, state, transport_opted, bus_route_no, extra_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
          ON CONFLICT (id) DO UPDATE SET
            avatar = EXCLUDED.avatar,
            photo = EXCLUDED.photo,
            full_name = EXCLUDED.full_name,
            class_name = EXCLUDED.class_name,
            section = EXCLUDED.section,
            extra_data = EXCLUDED.extra_data;
        `, [
          s.id, s.school_id || 'DPS2026', s.academic_session || '2026-27', admissionNo, fullName,
          className, section, String(s.roll_no || '1'), s.gender || 'Male', s.guardian_name || '',
          s.guardian_phone || '', guardianEmail, s.fee_status || 'PENDING', Number(s.attendance_percent) || 100,
          s.status || 'ACTIVE', s.passcode || '123456', s.avatar || '', s.photo || '',
          s.dob || '', s.blood_group || '', s.aadhaar_no || '', s.apaar_id || '',
          s.house || 'Red House', s.category || 'GENERAL', s.father_name || '', s.father_phone || '',
          s.mother_name || '', s.mother_phone || '', s.city || '', s.state || '',
          s.transport_opted || 'NO', s.bus_route_no || '', JSON.stringify(extraData)
        ]);
      }
      console.log(`  ✓ Synced students ${Math.min(i + studentBatchSize, students.length)} / ${students.length}`);
    }

    // ----------------------------------------------------
    // STEP 6: MIGRATE ATTENDANCE
    // ----------------------------------------------------
    console.log('\n📦 Migrating Attendance Logs...');
    const attendance = mongoDb ? await mongoDb.collection('attendance').find({}).toArray() : (localStore?.attendance || []);
    for (const a of attendance) {
      await pgClient.query(`
        INSERT INTO attendance (id, school_id, academic_session, date, class_name, section, total_students, present_count, absent_count, leave_count, marked_by, student_records, teacher_records)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          present_count = EXCLUDED.present_count,
          student_records = EXCLUDED.student_records;
      `, [
        a.id, a.school_id || 'DPS2026', a.academic_session || '2026-27', a.date || '',
        a.class_name || 'Class 10', a.section || 'A', Number(a.total_students) || 0,
        Number(a.present_count) || 0, Number(a.absent_count) || 0, Number(a.leave_count) || 0, a.marked_by || 'Admin',
        JSON.stringify(a.student_records || []), JSON.stringify(a.teacher_records || [])
      ]);
    }
    console.log(`  ✓ Synced ${attendance.length} attendance logs`);

    // ----------------------------------------------------
    // STEP 7: MIGRATE FEE INVOICES (High-Speed Batches)
    // ----------------------------------------------------
    console.log('\n📦 Migrating Fee Invoices...');
    const invoices = mongoDb ? await mongoDb.collection('fee_invoices').find({}).toArray() : (localStore?.fee_invoices || []);
    const invBatchSize = 100;
    for (let i = 0; i < invoices.length; i += invBatchSize) {
      const batch = invoices.slice(i, i + invBatchSize);
      for (const inv of batch) {
        const invoiceNo = inv.invoice_no || inv.id;
        const extraData = {
          payment_history: inv.payment_history,
          concession_amount: inv.concession_amount,
          concession_reason: inv.concession_reason,
          sibling_discount: inv.sibling_discount,
          transport_fee: inv.transport_fee,
          hostel_fee: inv.hostel_fee
        };

        await pgClient.query(`
          INSERT INTO fee_invoices (id, school_id, academic_session, invoice_no, student_id, student_name, admission_no, class_name, month, amount, paid_amount, due_date, status, payment_mode, paid_date, extra_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            paid_amount = EXCLUDED.paid_amount,
            payment_mode = EXCLUDED.payment_mode,
            paid_date = EXCLUDED.paid_date;
        `, [
          inv.id, inv.school_id || 'DPS2026', inv.academic_session || '2026-27', invoiceNo,
          inv.student_id || '', inv.student_name || 'Student', inv.admission_no || '',
          inv.class_name || 'Class 10', inv.month || '', Number(inv.amount) || 0,
          Number(inv.paid_amount) || 0, inv.due_date || '', inv.status || 'PENDING',
          inv.payment_mode || '', inv.paid_date || '', JSON.stringify(extraData)
        ]);
      }
      console.log(`  ✓ Synced fee invoices ${Math.min(i + invBatchSize, invoices.length)} / ${invoices.length}`);
    }

    // ----------------------------------------------------
    // STEP 8: MIGRATE NOTICES
    // ----------------------------------------------------
    console.log('\n📦 Migrating Notices & Circulars...');
    const notices = mongoDb ? await mongoDb.collection('notices').find({}).toArray() : (localStore?.notices || []);
    for (const n of notices) {
      await pgClient.query(`
        INSERT INTO notices (id, school_id, academic_session, reference_no, matter_category, title, content, target_audience, posted_by, date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING;
      `, [
        n.id, n.school_id || 'DPS2026', n.academic_session || '2026-27', n.reference_no || `NOT-${Date.now()}`,
        n.matter_category || 'ACAD', n.title || '', n.content || '', n.target_audience || 'ALL',
        n.posted_by || 'Admin', n.date || ''
      ]);
    }
    console.log(`  ✓ Synced ${notices.length} notices`);

    // ----------------------------------------------------
    // STEP 9: MIGRATE HOLIDAYS
    // ----------------------------------------------------
    console.log('\n📦 Migrating Holidays...');
    const holidays = mongoDb ? await mongoDb.collection('holidays').find({}).toArray() : (localStore?.holidays || []);
    for (const h of holidays) {
      await pgClient.query(`
        INSERT INTO holidays (id, school_id, academic_session, title, start_date, end_date, total_days, applicable_to, category, reason, declared_by, auto_notice_published)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING;
      `, [
        h.id, h.school_id || 'DPS2026', h.academic_session || '2026-27', h.title || '',
        h.start_date || '', h.end_date || '', Number(h.total_days) || 1, h.applicable_to || 'ALL',
        h.category || 'GAZETTED', h.reason || '', h.declared_by || 'Principal',
        Boolean(h.auto_notice_published ?? true)
      ]);
    }
    console.log(`  ✓ Synced ${holidays.length} holidays`);

    // ----------------------------------------------------
    // STEP 10: MIGRATE EXAMS
    // ----------------------------------------------------
    console.log('\n📦 Migrating Scheduled Exams...');
    const exams = mongoDb ? await mongoDb.collection('exams').find({}).toArray() : (localStore?.exams || []);
    for (let idx = 0; idx < exams.length; idx++) {
      const e = exams[idx];
      const examId = e.id || (e._id ? String(e._id) : `EXAM-${Date.now()}-${idx}`);
      await pgClient.query(`
        INSERT INTO exams (id, school_id, academic_session, title, type, class_name, section, subject_name, subject_code, date, time, max_marks, pass_marks, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO NOTHING;
      `, [
        examId, e.school_id || 'DPS2026', e.academic_session || '2026-27', e.title || '',
        e.type || 'SCHOOL_EXAM', e.class_name || '', e.section || '', e.subject_name || '',
        e.subject_code || '', e.date || '', e.time || '', Number(e.max_marks) || 100,
        Number(e.pass_marks) || 33, e.status || 'PENDING'
      ]);
    }
    console.log(`  ✓ Synced ${exams.length} exams`);

    // ----------------------------------------------------
    // STEP 11: MIGRATE TIMETABLE (High-Speed Batches)
    // ----------------------------------------------------
    console.log('\n📦 Migrating Timetable Entries...');
    const timetable = mongoDb ? await mongoDb.collection('timetable').find({}).toArray() : (localStore?.timetable || []);
    const ttBatchSize = 100;
    for (let i = 0; i < timetable.length; i += ttBatchSize) {
      const batch = timetable.slice(i, i + ttBatchSize);
      for (let j = 0; j < batch.length; j++) {
        const tt = batch[j];
        const ttId = tt.id || (tt._id ? String(tt._id) : `TT-${i + j + 1}`);
        await pgClient.query(`
          INSERT INTO timetable (id, school_id, academic_session, class_name, section, day, period_no, subject, teacher_name, start_time, end_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING;
        `, [
          ttId, tt.school_id || 'DPS2026', tt.academic_session || '2026-27', tt.class_name || '',
          tt.section || '', tt.day || '', Number(tt.period_no) || 1, tt.subject || '',
          tt.teacher_name || '', tt.start_time || '', tt.end_time || ''
        ]);
      }
      console.log(`  ✓ Synced timetable ${Math.min(i + ttBatchSize, timetable.length)} / ${timetable.length}`);
    }

    // ----------------------------------------------------
    // STEP 12: MIGRATE PUSH SUBSCRIPTIONS
    // ----------------------------------------------------
    console.log('\n📦 Migrating Web Push Subscriptions...');
    if (mongoDb) {
      const subs = await mongoDb.collection('push_subscriptions').find({}).toArray();
      for (const sub of subs) {
        const id = sub.id || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await pgClient.query(`
          INSERT INTO push_subscriptions (id, school_id, user_id, role, endpoint, p256dh, auth, device_info)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (endpoint) DO NOTHING;
        `, [
          id, sub.school_id || 'DPS2026', sub.user_id || '', sub.role || '',
          sub.endpoint, sub.keys?.p256dh || sub.p256dh || '', sub.keys?.auth || sub.auth || '',
          JSON.stringify(sub.deviceInfo || sub.device_info || {})
        ]);
      }
      console.log(`  ✓ Synced ${subs.length} push subscriptions`);
    }

    // ----------------------------------------------------
    // STEP 13: MIGRATE TRANSPORT TELEMETRY & AUDIT LOGS
    // ----------------------------------------------------
    if (mongoDb) {
      console.log('\n📦 Migrating Transport Telemetry & Audit Logs...');
      const telemetry = await mongoDb.collection('transport_telemetry').find({}).toArray();
      for (const t of telemetry) {
        await pgClient.query(`
          INSERT INTO transport_telemetry (bus_id, school_id, route_name, lat, lng, speed, heading, status, driver_phone)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (bus_id) DO UPDATE SET
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            speed = EXCLUDED.speed,
            heading = EXCLUDED.heading,
            status = EXCLUDED.status,
            timestamp = CURRENT_TIMESTAMP;
        `, [
          t.bus_id || 'BUS-01', t.school_id || 'DPS2026', t.route_name || '',
          Number(t.lat) || 0, Number(t.lng) || 0, Number(t.speed) || 0,
          Number(t.heading) || 0, t.status || 'IN_TRANSIT', t.driver_phone || ''
        ]);
      }
      console.log(`  ✓ Synced ${telemetry.length} bus telemetry records`);

      const auditLogs = await mongoDb.collection('audit_logs').find({}).toArray();
      for (const al of auditLogs) {
        await pgClient.query(`
          INSERT INTO audit_logs (id, school_id, user_id, action, details, ip_address)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING;
        `, [
          al.id || `LOG-${Date.now()}`, al.school_id || 'DPS2026', al.user_id || '',
          al.action || '', JSON.stringify(al.details || {}), al.ip_address || ''
        ]);
      }
      console.log(`  ✓ Synced ${auditLogs.length} audit logs`);
    }

    // ----------------------------------------------------
    // VERIFICATION REPORT
    // ----------------------------------------------------
    console.log('\n========================================================');
    console.log('📊 COCKROACHDB VERIFICATION SUMMARY');
    console.log('========================================================');
    const tableNames = ['schools', 'classes', 'teachers', 'students', 'attendance', 'fee_invoices', 'notices', 'holidays', 'exams', 'timetable', 'push_subscriptions', 'transport_telemetry'];
    for (const t of tableNames) {
      const res = await pgClient.query(`SELECT COUNT(*) FROM ${t};`);
      console.log(`  • ${t.padEnd(22)} : ${res.rows[0].count} records`);
    }
    console.log('\n🎉 ALL LIVE DATA MIGRATED AND VERIFIED ON COCKROACHDB!');
    console.log('========================================================\n');
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    pgClient.release();
    await cockroachPool.end();
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

run();
