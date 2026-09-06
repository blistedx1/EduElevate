/*! EduElevate Coaching Management Service Core v2.0.0 */
import { NextResponse } from 'next/server';
import { checkCockroachStatus, queryRows, isCockroachConfigured } from '@/lib/cockroach';
import { Database } from '@/lib/db';
import { requireAuth, requireRole, AGENCY_ONLY } from '@/lib/auth-guard';

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const status = await checkCockroachStatus();
    let cloudCounts = { schools: 0, students: 0, teachers: 0, classes: 0, attendance: 0, fee_invoices: 0, notices: 0 };
    
    if (status.connected) {
      try {
        const [schools, students, teachers, classes, attendance, fee_invoices, notices] = await Promise.all([
          queryRows<any>('SELECT COUNT(*) as cnt FROM schools;'),
          queryRows<any>('SELECT COUNT(*) as cnt FROM students;'),
          queryRows<any>('SELECT COUNT(*) as cnt FROM teachers;'),
          queryRows<any>('SELECT COUNT(*) as cnt FROM classes;'),
          queryRows<any>('SELECT COUNT(*) as cnt FROM attendance;'),
          queryRows<any>('SELECT COUNT(*) as cnt FROM fee_invoices;'),
          queryRows<any>('SELECT COUNT(*) as cnt FROM notices;')
        ]);
        cloudCounts = {
          schools: parseInt(schools[0]?.cnt || '0', 10),
          students: parseInt(students[0]?.cnt || '0', 10),
          teachers: parseInt(teachers[0]?.cnt || '0', 10),
          classes: parseInt(classes[0]?.cnt || '0', 10),
          attendance: parseInt(attendance[0]?.cnt || '0', 10),
          fee_invoices: parseInt(fee_invoices[0]?.cnt || '0', 10),
          notices: parseInt(notices[0]?.cnt || '0', 10)
        };
      } catch (e) {}
    }

    const localStudents = await Database.getStudents('DPS2026');
    const localTeachers = await Database.getTeachers('DPS2026');
    const localClasses = await Database.getClasses('DPS2026');
    const localAttendance = await Database.getAttendance('DPS2026');
    const localInvoices = await Database.getFeeInvoices('DPS2026');
    const localNotices = await Database.getNotices('DPS2026');

    return NextResponse.json({
      success: true,
      mongoStatus: {
        connected: status.connected,
        error: status.error,
        version: status.dbVersion,
        cluster: 'CockroachDB Serverless'
      },
      cloudCounts,
      localCounts: {
        students: localStudents.length,
        teachers: localTeachers.length,
        classes: localClasses.length,
        attendance: localAttendance.length,
        fee_invoices: localInvoices.length,
        notices: localNotices.length
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Upload / Sync all Local Data to CockroachDB Serverless
export async function POST(req: Request) {
  try {
    const auth = requireRole(req, AGENCY_ONLY);
    if (auth instanceof NextResponse) return auth;
    
    if (!isCockroachConfigured()) {
      const status = await checkCockroachStatus();
      return NextResponse.json({
        success: false,
        error: status.error || 'Cannot connect to CockroachDB Serverless. Check your connection string.'
      }, { status: 503 });
    }

    const schools = await Database.getSchools();
    const students = await Database.getStudents();
    const teachers = await Database.getTeachers();
    const classes = await Database.getClasses();
    const attendance = await Database.getAttendance();
    const fee_invoices = await Database.getFeeInvoices();
    const notices = await Database.getNotices();

    const results: any = {
      schools: schools.length,
      students: students.length,
      teachers: teachers.length,
      classes: classes.length,
      attendance: attendance.length,
      fee_invoices: fee_invoices.length,
      notices: notices.length
    };

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${students.length} students, ${teachers.length} teachers, ${classes.length} classes to CockroachDB Serverless!`,
      results
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
