import base64
import io
import json
import re
import sys

import pandas as pd


def clean(value):
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def preview(frame, limit=50):
    return {"columns": [str(c) for c in frame.columns], "rows": [[clean(v) for v in row] for row in frame.head(limit).itertuples(index=False, name=None)]} if not frame.empty else {"columns": [], "rows": []}


def process(payload):
    item = payload["file"]
    data = base64.b64decode(item["data"])
    workbook = pd.ExcelFile(io.BytesIO(data))
    if not workbook.sheet_names:
        raise ValueError("The workbook does not contain any sheets.")
    source_sheet = workbook.sheet_names[0]
    frame = pd.read_excel(workbook, sheet_name=0)
    name_col = None
    nrc_col = None
    for column in frame.columns:
        cleaned = re.sub(r"[^a-zA-Z0-9]", "", str(column)).lower()
        if "fullname" in cleaned or "employeename" in cleaned or cleaned == "employeefullname":
            name_col = column
        elif "nrc" in cleaned or "nrcno" in cleaned:
            nrc_col = column
    if name_col is None and "Employee Full Name" in frame.columns:
        name_col = "Employee Full Name"
    if nrc_col is None and "NRC No" in frame.columns:
        nrc_col = "NRC No"
    if name_col is None or nrc_col is None:
        raise ValueError(f"Could not find required columns. Detected columns: {[str(c) for c in frame.columns]}")

    duplicate_mask = frame.duplicated(subset=[name_col, nrc_col], keep="first")
    clean_data = frame[~duplicate_mask].copy()
    duplicates = frame[duplicate_mask].copy()
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        clean_data.to_excel(writer, sheet_name="Clean Data", index=False)
        duplicates.to_excel(writer, sheet_name="Duplicates Moved", index=False)
    output.seek(0)
    return {
        "outputFilename": "Processed_Duplicates_Moved.xlsx",
        "sheetNames": ["Clean Data", "Duplicates Moved"],
        "sourceFilename": item["name"],
        "sourceSheet": source_sheet,
        "nameColumn": str(name_col),
        "nrcColumn": str(nrc_col),
        "originalCount": len(frame),
        "cleanCount": len(clean_data),
        "duplicateCount": len(duplicates),
        "cleanData": preview(clean_data),
        "duplicates": preview(duplicates),
        "workbookBase64": base64.b64encode(output.read()).decode("ascii"),
    }


if __name__ == "__main__":
    json.dump(process(json.load(sys.stdin)), sys.stdout, ensure_ascii=False, allow_nan=False)
