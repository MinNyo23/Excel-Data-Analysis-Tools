import base64
import io
import json
import re
import sys
import pandas as pd

def cell(value):
    if pd.isna(value): return None
    return value.item() if hasattr(value, "item") else value

def preview(frame, limit=50):
    if frame.empty: return {"columns": [], "rows": []}
    return {"columns": [str(c) for c in frame.columns], "rows": [[cell(v) for v in r] for r in frame.head(limit).itertuples(index=False, name=None)]}

def entity_column(frame):
    for col in frame.columns:
        clean = re.sub(r"[^a-zA-Z0-9]", "", str(col)).lower()
        if clean == "entityname" or "entity" in clean: return col
    return None

def process(payload):
    item = payload["file"]
    workbook = pd.ExcelFile(io.BytesIO(base64.b64decode(item["data"])))
    frames = {sheet: pd.read_excel(workbook, sheet_name=sheet) for sheet in workbook.sheet_names}
    counts_by_sheet, entities = {}, set()
    for sheet, frame in frames.items():
        col = entity_column(frame)
        counts = frame[col].dropna().astype(str).str.strip().value_counts().to_dict() if col is not None and not frame.empty else {}
        counts_by_sheet[sheet] = counts
        entities.update(counts)
    rows = []
    for index, entity in enumerate(sorted(entities), 1):
        row = {"Sr No": index, "Entity Name": entity}
        total = 0
        for sheet in workbook.sheet_names:
            count = int(counts_by_sheet[sheet].get(entity, 0))
            row[f"{sheet} Count"] = count
            total += count
        row["Grand Total"] = total
        rows.append(row)
    summary = pd.DataFrame(rows)
    if not summary.empty:
        total = {"Sr No": "", "Entity Name": "TOTAL"}
        for sheet in workbook.sheet_names: total[f"{sheet} Count"] = int(summary[f"{sheet} Count"].sum())
        total["Grand Total"] = int(summary["Grand Total"].sum())
        summary = pd.concat([summary, pd.DataFrame([total])], ignore_index=True)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="Entity Summary", index=False)
        for sheet, frame in frames.items(): frame.to_excel(writer, sheet_name=sheet, index=False)
    output.seek(0)
    return {"outputFilename": "Entity_Summary_Final_Report.xlsx", "sheetNames": ["Entity Summary", *workbook.sheet_names], "sourceSheetCount": len(workbook.sheet_names), "entityCount": len(entities), "summary": preview(summary), "workbookBase64": base64.b64encode(output.read()).decode("ascii")}

if __name__ == "__main__": json.dump(process(json.load(sys.stdin)), sys.stdout, ensure_ascii=False, allow_nan=False)
