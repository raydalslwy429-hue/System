const path = require("path");
const fs = require("fs");
const { createClient } = require("@libsql/client");

const projectDir = path.resolve(__dirname, "..");
const envPath = path.join(projectDir, ".env.local");

function readEnv(file) {
  const res = {};
  if (!fs.existsSync(file)) return res;
  fs.readFileSync(file, "utf8").split(/\r?\n/).forEach(line => {
    const idx = line.indexOf("=");
    if (idx > 0) {
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      res[line.slice(0, idx).trim()] = val;
    }
  });
  return res;
}

const env = readEnv(envPath);
const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

function escapeXML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateExcelWorkbookXML(options) {
  const title = options.title || "مطعم المراسيم - تصدير البيانات الأساسية";
  const sheets = options.sheets || [];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>${escapeXML(title)}</Author>
  <Created>${new Date().toISOString()}</Created>
  <Company>مطعم المراسيم almaRasim</Company>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/>
   <Borders/>
   <Font ss:FontName="Segoe UI, Tahoma, Arial" x:CharSet="178" ss:Size="11" ss:Color="#1B1111"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1" ss:ReadingOrder="RightToLeft"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2A1C16"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2A1C16"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2A1C16"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2A1C16"/>
   </Borders>
   <Font ss:FontName="Segoe UI, Tahoma, Arial" x:CharSet="178" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#682722" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowEven">
   <Alignment ss:Vertical="Center" ss:WrapText="1" ss:ReadingOrder="RightToLeft"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI, Tahoma, Arial" x:CharSet="178" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowOdd">
   <Alignment ss:Vertical="Center" ss:WrapText="1" ss:ReadingOrder="RightToLeft"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI, Tahoma, Arial" x:CharSet="178" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FAF7F4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CenterCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI, Tahoma, Arial" x:CharSet="178" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
 </Styles>`;

  for (const sheet of sheets) {
    xml += `
 <Worksheet ss:Name="${escapeXML(sheet.name)}">
  <Table ss:DefaultRowHeight="26" ss:StyleID="Default">`;

    for (const col of sheet.columns) {
      const width = col.width || 120;
      xml += `\n   <Column ss:AutoFitWidth="0" ss:Width="${width}"/>`;
    }

    // Header Row
    xml += `\n   <Row ss:Height="32" ss:StyleID="HeaderStyle">`;
    for (const col of sheet.columns) {
      xml += `\n    <Cell><Data ss:Type="String">${escapeXML(col.header)}</Data></Cell>`;
    }
    xml += `\n   </Row>`;

    // Data Rows
    sheet.rows.forEach((row, idx) => {
      const styleId = idx % 2 === 0 ? "DataRowEven" : "DataRowOdd";
      xml += `\n   <Row ss:Height="24" ss:StyleID="${styleId}">`;

      for (const col of sheet.columns) {
        const val = row[col.key];
        const isNum = typeof val === "number" && !isNaN(val);
        const cellStyle = isNum ? ` ss:StyleID="CenterCell"` : "";

        if (val === null || val === undefined || val === "") {
          xml += `\n    <Cell${cellStyle}><Data ss:Type="String">-</Data></Cell>`;
        } else if (isNum) {
          xml += `\n    <Cell${cellStyle}><Data ss:Type="Number">${val}</Data></Cell>`;
        } else {
          xml += `\n    <Cell${cellStyle}><Data ss:Type="String">${escapeXML(val)}</Data></Cell>`;
        }
      }
      xml += `\n   </Row>`;
    });

    xml += `
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Layout x:Orientation="Landscape"/>
   </PageSetup>
   <DisplayRightToLeft/>
   <Unsynced/>
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>`;
  }

  xml += `\n</Workbook>`;
  return xml;
}

async function main() {
  console.log("Fetching Master Data from Turso Cloud Database...");

  // 1. Users
  const usersRes = await client.execute(`
    SELECT 
      u.id, u.user_number, u.full_name, u.pin_code, u.role, 
      u.department_code, u.department_name, u.job_title, u.status,
      u.home_department_code, u.home_section_code, u.supervised_departments,
      u.can_receive_cases, u.can_close_assigned_cases, u.can_export_excel,
      u.can_create_daily_report, u.can_view_daily_archive, u.custom_role_name,
      u.created_at
    FROM users u
    ORDER BY COALESCE(u.user_number, u.id) ASC
  `);

  const roleLabelMap = {
    super_admin: "مدير نظام عام (Super Admin)",
    general_admin: "مدير عام",
    admin: "مسؤول إدارة / مشرف",
    inspector: "مفتش جودة ومتابعة",
    field_agent: "منفذ ميداني",
    viewer: "مشاهد / رقابي فقط",
  };

  const usersRows = usersRes.rows.map(u => ({
    id: u.id,
    user_number: u.user_number || u.id,
    full_name: u.full_name || "-",
    pin_code: u.pin_code || "****",
    role: roleLabelMap[u.role] || u.role || "-",
    department_name: u.department_name || u.department_code || "-",
    department_code: u.department_code || "-",
    home_department_code: u.home_department_code || "-",
    home_section_code: u.home_section_code || "-",
    job_title: u.job_title || "-",
    supervised_departments: u.supervised_departments || "الكل (all)",
    can_receive_cases: u.can_receive_cases == 1 ? "نعم (مستقبل مهام)" : "لا",
    can_close_assigned_cases: u.can_close_assigned_cases == 1 ? "نعم" : "لا",
    can_export_excel: u.can_export_excel == 1 ? "نعم" : "لا",
    can_create_daily_report: u.can_create_daily_report == 1 ? "نعم" : "لا",
    can_view_daily_archive: u.can_view_daily_archive == 1 ? "نعم" : "لا",
    status: u.status === "active" ? "نشط" : "معطل",
    created_at: u.created_at || "-",
  }));

  // 2. Departments
  const deptsRes = await client.execute(`
    SELECT d.id, d.code, d.name, d.status, d.created_at,
           COUNT(l.id) as sections_count
    FROM departments d
    LEFT JOIN locations l ON d.code = l.department_code
    GROUP BY d.id
    ORDER BY d.name ASC
  `);

  const deptsRows = deptsRes.rows.map(d => ({
    id: d.id,
    code: d.code || "-",
    name: d.name || "-",
    sections_count: Number(d.sections_count || 0),
    status: d.status === "active" ? "نشط" : "معطل",
    created_at: d.created_at || "-",
  }));

  // 3. Locations & Sections
  const locsRes = await client.execute(`
    SELECT l.id, l.code, l.name, l.department_code, 
           COALESCE(d.name, l.department_code) as department_name,
           l.status, l.created_at
    FROM locations l
    LEFT JOIN departments d ON l.department_code = d.code
    ORDER BY department_name ASC, l.name ASC
  `);

  const locsRows = locsRes.rows.map(l => ({
    id: l.id,
    code: l.code || "-",
    name: l.name || "-",
    department_name: l.department_name || "-",
    department_code: l.department_code || "-",
    status: l.status === "active" ? "نشط" : "معطل",
    created_at: l.created_at || "-",
  }));

  // 4. Categories / Non-Conformances
  const catsRes = await client.execute(`
    SELECT c.id, c.code, c.name, c.severity, c.department_code, c.section_code,
           COALESCE(d.name, c.department_code) as department_name,
           COALESCE(l.name, c.section_code) as section_name,
           c.status, c.description, c.created_at
    FROM categories c
    LEFT JOIN departments d ON c.department_code = d.code
    LEFT JOIN locations l ON c.section_code = l.code
    ORDER BY c.id ASC
  `);

  const severityMap = {
    high: "عالي الخطورة ⚠️",
    medium: "متوسط الخطورة ⚡",
    low: "عادي / منخفض ℹ️",
  };

  const catsRows = catsRes.rows.map(c => ({
    id: c.id,
    code: c.code || "-",
    name: c.name || "-",
    severity: severityMap[c.severity] || c.severity || "-",
    department_name: c.department_name || "-",
    section_name: c.section_name || "-",
    description: c.description || "-",
    status: c.status === "active" ? "نشط" : "معطل",
    created_at: c.created_at || "-",
  }));

  console.log(`Counts: Users=${usersRows.length}, Depts=${deptsRows.length}, Locations=${locsRows.length}, Categories=${catsRows.length}`);

  const workbookOptions = {
    title: "النظام الإداري لمطاعم المراسيم - تصدير البيانات الأساسية الشاملة",
    sheets: [
      {
        name: "المستخدمون_والصلاحيات",
        columns: [
          { header: "م", key: "id", width: 50 },
          { header: "الرقم الوظيفي", key: "user_number", width: 90 },
          { header: "الاسم الكامل", key: "full_name", width: 170 },
          { header: "المسمى الوظيفي", key: "job_title", width: 140 },
          { header: "الدور بالنظام", key: "role", width: 150 },
          { header: "رمز الدخول PIN", key: "pin_code", width: 90 },
          { header: "الإدارة الحالية", key: "department_name", width: 140 },
          { header: "كود الإدارة الحالية", key: "department_code", width: 110 },
          { header: "الإدارة الأصيلة للمستخدم", key: "home_department_code", width: 140 },
          { header: "القسم الأصيل", key: "home_section_code", width: 110 },
          { header: "الإدارات الخاضعة لمتابعته", key: "supervised_departments", width: 160 },
          { header: "يستقبل تكليفات؟", key: "can_receive_cases", width: 110 },
          { header: "يعتمد ويغلق تكليفات؟", key: "can_close_assigned_cases", width: 130 },
          { header: "تصدير إكسيل", key: "can_export_excel", width: 90 },
          { header: "إنشاء تقرير يومي", key: "can_create_daily_report", width: 110 },
          { header: "أرشيف التقارير", key: "can_view_daily_archive", width: 100 },
          { header: "الحالة", key: "status", width: 80 },
          { header: "تاريخ الإنشاء", key: "created_at", width: 130 },
        ],
        rows: usersRows,
      },
      {
        name: "الإدارات_العامة",
        columns: [
          { header: "م", key: "id", width: 50 },
          { header: "كود الإدارة", key: "code", width: 110 },
          { header: "اسم الإدارة", key: "name", width: 220 },
          { header: "عدد الأقسام والمواقع التابعة", key: "sections_count", width: 150 },
          { header: "الحالة", key: "status", width: 80 },
          { header: "تاريخ الإنشاء", key: "created_at", width: 130 },
        ],
        rows: deptsRows,
      },
      {
        name: "المواقع_والأقسام",
        columns: [
          { header: "م", key: "id", width: 50 },
          { header: "كود القسم / الموقع", key: "code", width: 120 },
          { header: "اسم القسم والموقع التشغيلي", key: "name", width: 220 },
          { header: "الإدارة التابع لها", key: "department_name", width: 200 },
          { header: "كود الإدارة", key: "department_code", width: 110 },
          { header: "الحالة", key: "status", width: 80 },
          { header: "تاريخ الإنشاء", key: "created_at", width: 130 },
        ],
        rows: locsRows,
      },
      {
        name: "حالات_عدم_المطابقة",
        columns: [
          { header: "م", key: "id", width: 50 },
          { header: "كود المخالفة", key: "code", width: 110 },
          { header: "مسمى حالة عدم المطابقة", key: "name", width: 240 },
          { header: "مستوى الخطورة", key: "severity", width: 120 },
          { header: "الإدارة المسؤولة", key: "department_name", width: 180 },
          { header: "القسم / الموقع المخصص", key: "section_name", width: 180 },
          { header: "وصف المخالفة المعياري", key: "description", width: 260 },
          { header: "الحالة", key: "status", width: 80 },
          { header: "تاريخ التسجيل", key: "created_at", width: 130 },
        ],
        rows: catsRows,
      },
    ],
  };

  const xmlContent = generateExcelWorkbookXML(workbookOptions);

  // Output paths:
  // 1. Workspace
  const workspaceOut = path.join(projectDir, "marasim_system_master_data.xls");
  fs.writeFileSync(workspaceOut, xmlContent, "utf8");
  console.log("Successfully wrote Excel to:", workspaceOut);

  // 2. Artifact Directory
  const artifactDir = "C:\\Users\\مطعم المراسيم\\.gemini\\antigravity\\brain\\c6b6b151-e06d-4061-8c1a-34161e97a8a9";
  if (fs.existsSync(artifactDir)) {
    const artifactOut = path.join(artifactDir, "marasim_system_master_data.xls");
    fs.writeFileSync(artifactOut, xmlContent, "utf8");
    console.log("Successfully wrote Excel to Artifact Dir:", artifactOut);
  }
}

main().catch(console.error);
