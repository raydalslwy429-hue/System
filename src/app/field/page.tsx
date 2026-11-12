import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";
import FieldQueue from "./FieldQueue";
import { Wrench, CheckCircle, Sparkles } from "lucide-react";

export default async function FieldDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    session.role !== "field_agent" &&
    session.role !== "admin" &&
    session.role !== "super_admin" &&
    session.role !== "general_admin"
  ) {
    redirect("/");
  }

  // Fetch all active assignments for this agent (assigned directly by user_id OR generally to department)
  // Dynamic query! Inspector name is strictly excluded from query for privacy!
  const query = `
    SELECT 
      a.id as asg_row_id,
      a.asg_id,
      a.case_id,
      a.case_number,
      a.round,
      a.assigned_dept,
      a.dept_name,
      a.admin_instructions,
      a.reassign_notes,
      a.status as asg_status,
      a.is_accepted,
      a.admin_feedback,
      c.location_name,
      c.nc_name,
      c.description,
      c.root_cause,
      c.inspector_notes,
      c.in_progress_note,
      c.obs_date,
      c.obs_time,
      c.status as case_status
    FROM case_assignments a
    JOIN cases_master c ON a.case_id = c.id
    WHERE (a.assigned_user_id = ? OR (a.assigned_dept = ? AND a.assigned_user_id IS NULL)) 
      AND a.status IN ('pending', 'completed', 'accepted', 'approved') AND c.status != 'closed'
    ORDER BY a.round DESC, a.case_number DESC
  `;

  const asgRes = await db.execute({
    sql: query,
    args: [session.id, session.department_code],
  });

  const assignments = asgRes.rows.map((r: any) => ({
    asgRowId: Number(r.asg_row_id),
    asgId: String(r.asg_id),
    caseId: Number(r.case_id),
    caseNumber: Number(r.case_number),
    round: Number(r.round),
    assignedDept: String(r.assigned_dept),
    deptName: String(r.dept_name),
    adminInstructions: String(r.admin_instructions || ""),
    reassignNotes: String(r.reassign_notes || ""),
    asgStatus: String(r.asg_status),
    isAccepted: Number(r.is_accepted) === 1 || r.asg_status === 'accepted' || r.asg_status === 'approved',
    adminFeedback: String(r.admin_feedback || ""),
    caseStatus: String(r.case_status || ""),
    locationName: String(r.location_name),
    ncName: String(r.nc_name),
    description: String(r.description),
    rootCause: String(r.root_cause || ""),
    inspectorNotes: String(r.inspector_notes || ""),
    inProgressNote: r.in_progress_note ? String(r.in_progress_note) : undefined,
    obsDate: String(r.obs_date),
    obsTime: String(r.obs_time),
  }));

  // Fetch closed cases with administrative feedback for this agent
  const closedRes = await db.execute({
    sql: `
      SELECT 
        c.id, c.case_number, c.location_name, c.nc_name, c.description, c.root_cause, c.inspector_notes, c.closed_at, 
        COALESCE(c.closed_feedback, a.admin_feedback, 'تم الإغلاق والاعتماد') as closed_feedback
      FROM cases_master c
      JOIN case_assignments a ON c.id = a.case_id
      WHERE (a.assigned_user_id = ? OR a.assigned_dept = ?) AND c.status = 'closed'
      GROUP BY c.id
      ORDER BY c.closed_at DESC LIMIT 20
    `,
    args: [session.id, session.department_code],
  });

  const closedCases = closedRes.rows.map((r: any) => ({
    id: Number(r.id),
    caseNumber: Number(r.case_number),
    locationName: String(r.location_name),
    ncName: String(r.nc_name),
    description: String(r.description),
    rootCause: String(r.root_cause || ""),
    inspectorNotes: String(r.inspector_notes || ""),
    closedAt: String(r.closed_at || ""),
    closedFeedback: String(r.closed_feedback || "تم الإغلاق والاعتماد"),
  }));

  // Split into New Assignments (Round 1) vs Returned (Round > 1)
  const newAssignments = assignments.filter((a) => a.round === 1 && !a.reassignNotes);
  const returnedAssignments = assignments.filter((a) => a.round > 1 || a.reassignNotes);

  return (
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col">
      <Navbar user={session} />

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        
        {/* Banner with Al-Marasim Luxury Identity */}
        <div className="mb-6 bg-gradient-to-l from-[#1B1111] via-[#2A1C16] to-[#1B1111] text-white p-6 sm:p-7 rounded-[2rem] border-2 border-[#D49A3D]/40 shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFC217]/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex items-center gap-4">
            <span className="p-3 bg-[#D49A3D] text-[#1B1111] rounded-2xl shadow-md">
              <Wrench className="w-7 h-7" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">لوحة تنفيذ التكليفات الميدانية</h2>
                <span className="text-[10px] bg-[#682722] text-amber-100 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  مطعم المراسيم
                </span>
              </div>
              <p className="text-xs font-semibold text-amber-200/80 mt-1">
                المسؤول: {session.full_name} ({session.department_name})
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2.5">
            <div className="px-3.5 py-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-200 rounded-xl text-xs font-black">
              جديدة: {newAssignments.length}
            </div>
            <div className="px-3.5 py-1.5 bg-[#682722]/60 border border-[#682722] text-rose-200 rounded-xl text-xs font-black">
              معادة: {returnedAssignments.length}
            </div>
          </div>
        </div>

        {/* Client Interactive Queues */}
        <FieldQueue
          newAssignments={newAssignments}
          returnedAssignments={returnedAssignments}
          closedCases={closedCases}
        />

      </main>
    </div>
  );
}
