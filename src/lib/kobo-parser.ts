import * as XLSX from "xlsx";

export interface ParsedKoboQuestion {
  question_code: string;
  question_text: string;
  field_type: "text" | "textarea" | "number" | "select" | "radio" | "image" | "date" | "time" | "gps";
  is_required: boolean;
  options?: string[];
  step_number: number;
  order_index: number;
  help_text?: string;
  placeholder?: string;
}

export interface ParsedKoboForm {
  code: string;
  title: string;
  description?: string;
  questions: ParsedKoboQuestion[];
  stepsCount: number;
}

export function parseKoboXLSForm(buffer: Buffer, defaultTitle?: string): ParsedKoboForm {
  const wb = XLSX.read(buffer, { type: "buffer" });
  
  // Find sheets case-insensitively
  const sheetNames = wb.SheetNames;
  const findSheet = (name: string) => {
    const found = sheetNames.find((s) => s.trim().toLowerCase() === name.toLowerCase());
    return found ? wb.Sheets[found] : null;
  };

  const surveySheet = findSheet("survey") || wb.Sheets[sheetNames[0]];
  const choicesSheet = findSheet("choices");
  const settingsSheet = findSheet("settings");

  if (!surveySheet) {
    throw new Error("لم يتم العثور على ورقة الأسئلة (survey) في ملف الإكسيل");
  }

  // 1. Parse Settings
  let formTitle = defaultTitle || "استمارة مستوردة من Kobo";
  let formCode = `kobo_${Date.now()}`;
  let formDesc = "استمارة تم استيرادها تلقائياً من ملف XLSForm / KoboToolbox";

  if (settingsSheet) {
    const settingsData = XLSX.utils.sheet_to_json<Record<string, any>>(settingsSheet);
    if (settingsData.length > 0) {
      const s = settingsData[0];
      if (s.form_title || s["form_title::Arabic (ar)"]) {
        formTitle = String(s.form_title || s["form_title::Arabic (ar)"]).trim();
      }
      if (s.form_id || s.id_string) {
        formCode = String(s.form_id || s.id_string).trim().toLowerCase().replace(/\s+/g, "_");
      }
      if (s.description) {
        formDesc = String(s.description).trim();
      }
    }
  }

  // 2. Parse Choices
  const choiceMap = new Map<string, string[]>();
  if (choicesSheet) {
    const choicesData = XLSX.utils.sheet_to_json<Record<string, any>>(choicesSheet);
    choicesData.forEach((c) => {
      const listName = String(c.list_name || c.listname || "").trim();
      if (!listName) return;

      // Extract label prioritizing Arabic
      const label = String(
        c.label ||
        c["label::Arabic (ar)"] ||
        c["label::العربية"] ||
        c["label::ar"] ||
        c["label::arabic"] ||
        c.name ||
        ""
      ).trim();

      if (label) {
        if (!choiceMap.has(listName)) {
          choiceMap.set(listName, []);
        }
        choiceMap.get(listName)!.push(label);
      }
    });
  }

  // 3. Parse Survey Questions
  const surveyData = XLSX.utils.sheet_to_json<Record<string, any>>(surveySheet);
  const questions: ParsedKoboQuestion[] = [];
  let currentStep = 1;
  let orderIndex = 1;

  // Metadata types to ignore
  const ignoreTypes = new Set([
    "start",
    "end",
    "today",
    "deviceid",
    "phonenumber",
    "username",
    "simserial",
    "subscriberid",
    "audit",
    "calculate",
  ]);

  for (const row of surveyData) {
    const rawType = String(row.type || "").trim();
    if (!rawType) continue;

    const lowerType = rawType.toLowerCase();

    // Check if group begins
    if (lowerType === "begin_group" || lowerType === "begin group" || lowerType === "begin_repeat") {
      // If questions already added in current step, bump step
      if (questions.some((q) => q.step_number === currentStep)) {
        currentStep++;
      }
      continue;
    }

    if (lowerType === "end_group" || lowerType === "end group" || lowerType === "end_repeat") {
      continue;
    }

    // Ignore non-interactive metadata
    if (ignoreTypes.has(lowerType)) {
      continue;
    }

    const qName = String(row.name || `q_${orderIndex}`).trim();
    const qText = String(
      row.label ||
      row["label::Arabic (ar)"] ||
      row["label::العربية"] ||
      row["label::ar"] ||
      row["label::arabic"] ||
      qName
    ).trim();

    if (!qText || qText === "false") continue;

    const isRequired =
      String(row.required || "").trim().toLowerCase() === "true" ||
      String(row.required || "").trim() === "1" ||
      String(row.required || "").trim().toLowerCase() === "yes";

    const helpText = row.hint ? String(row.hint).trim() : undefined;

    // Detect Field Type & Options
    let fieldType: ParsedKoboQuestion["field_type"] = "text";
    let options: string[] | undefined = undefined;

    if (lowerType.startsWith("select_one") || lowerType.startsWith("select one")) {
      const parts = rawType.split(/\s+/);
      const listName = parts[1]?.trim();
      options = listName ? choiceMap.get(listName) : undefined;
      // If choices <= 5, radio buttons give optimal mobile UX; otherwise dropdown select
      if (options && options.length <= 5) {
        fieldType = "radio";
      } else {
        fieldType = "select";
      }
    } else if (lowerType.startsWith("select_multiple") || lowerType.startsWith("select multiple")) {
      const parts = rawType.split(/\s+/);
      const listName = parts[1]?.trim();
      options = listName ? choiceMap.get(listName) : undefined;
      fieldType = "radio";
    } else if (lowerType === "integer" || lowerType === "decimal") {
      fieldType = "number";
    } else if (lowerType === "date") {
      fieldType = "date";
    } else if (lowerType === "time") {
      fieldType = "time";
    } else if (lowerType === "image" || lowerType === "photo") {
      fieldType = "image";
    } else if (lowerType === "geopoint") {
      fieldType = "gps";
    } else if (lowerType === "text") {
      const isMulti =
        String(row.appearance || "").includes("multiline") ||
        qText.includes("ملاحظات") ||
        qText.includes("وصف") ||
        qText.includes("توضيح");
      fieldType = isMulti ? "textarea" : "text";
    } else if (lowerType === "note") {
      fieldType = "text";
    }

    questions.push({
      question_code: qName,
      question_text: qText,
      field_type: fieldType,
      is_required: isRequired,
      options,
      step_number: currentStep,
      order_index: orderIndex++,
      help_text: helpText,
      placeholder: options ? undefined : "أدخل الإجابة هنا...",
    });
  }

  return {
    code: formCode,
    title: formTitle,
    description: formDesc,
    questions,
    stepsCount: currentStep,
  };
}
