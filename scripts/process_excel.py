import base64
import io
import json
import os
import sys
import pandas as pd


def clean_value(value):
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def frame_preview(frame, limit=8):
    if frame.empty:
        return {"columns": [], "rows": []}
    columns = [str(column) for column in frame.columns]
    rows = []
    for row in frame.head(limit).itertuples(index=False, name=None):
        rows.append([clean_value(value) for value in row])
    return {"columns": columns, "rows": rows}


def process(payload):
    addition_dfs = []
    deletion_dfs = []
    summary_data = []
    errors = []

    files = payload.get("files", [])
    for item in files:
        file_name = str(item.get("name", "uploaded.xlsx"))
        if not file_name.lower().endswith((".xlsx", ".xls")):
            errors.append(f"Skipped unsupported file: {file_name}")
            continue

        raw_filename = os.path.splitext(os.path.basename(file_name))[0]
        add_count = 0
        del_count = 0
        try:
            content = base64.b64decode(item["data"])
            excel_file = pd.ExcelFile(io.BytesIO(content))
            add_sheet = None
            del_sheet = None

            for sheet in excel_file.sheet_names:
                s_clean = sheet.strip().lower()
                if "addition" in s_clean or "add" in s_clean:
                    add_sheet = sheet
                elif "deletion" in s_clean or "del" in s_clean:
                    del_sheet = sheet

            if add_sheet:
                df_add = pd.read_excel(excel_file, sheet_name=add_sheet)
                df_add["Source_File"] = raw_filename
                addition_dfs.append(df_add)
                add_count = len(df_add)
            else:
                errors.append(f"No Addition sheet found in {file_name}")

            if del_sheet:
                df_del = pd.read_excel(excel_file, sheet_name=del_sheet)
                df_del["Source_File"] = raw_filename
                deletion_dfs.append(df_del)
                del_count = len(df_del)
            else:
                errors.append(f"No Deletion sheet found in {file_name}")

            summary_data.append(
                {
                    "Excel File Name": file_name,
                    "Addition Records": add_count,
                    "Deletion Records": del_count,
                    "Total Records": add_count + del_count,
                }
            )
        except Exception as exc:
            errors.append(f"Error reading {file_name}: {exc}")

    combined_addition = pd.concat(addition_dfs, ignore_index=True) if addition_dfs else pd.DataFrame()
    combined_deletion = pd.concat(deletion_dfs, ignore_index=True) if deletion_dfs else pd.DataFrame()
    df_summary = pd.DataFrame(summary_data)

    if not df_summary.empty:
        total_row = pd.DataFrame(
            [
                {
                    "Excel File Name": "TOTAL",
                    "Addition Records": df_summary["Addition Records"].sum(),
                    "Deletion Records": df_summary["Deletion Records"].sum(),
                    "Total Records": df_summary["Total Records"].sum(),
                }
            ]
        )
        df_summary = pd.concat([df_summary, total_row], ignore_index=True)

    output_filename = "Master_Combined_With_Summary.xlsx"
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df_summary.to_excel(writer, sheet_name="Summary Report", index=False)
        combined_addition.to_excel(writer, sheet_name="Addition", index=False)
        combined_deletion.to_excel(writer, sheet_name="Deletion", index=False)
    output.seek(0)

    return {
        "outputFilename": output_filename,
        "sheetNames": ["Summary Report", "Addition", "Deletion"],
        "fileCount": len(summary_data),
        "errors": errors,
        "summary": frame_preview(df_summary, limit=100),
        "addition": frame_preview(combined_addition),
        "deletion": frame_preview(combined_deletion),
        "additionCount": len(combined_addition),
        "deletionCount": len(combined_deletion),
        "workbookBase64": base64.b64encode(output.read()).decode("ascii"),
    }


def main():
    payload = json.load(sys.stdin)
    json.dump(process(payload), sys.stdout, ensure_ascii=False, allow_nan=False)


if __name__ == "__main__":
    main()
