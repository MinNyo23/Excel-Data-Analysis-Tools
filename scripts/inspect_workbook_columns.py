import base64, io, json, sys
import pandas as pd

def inspect(payload):
  workbook = io.BytesIO(base64.b64decode(payload['file']['data']))
  excel = pd.ExcelFile(workbook)
  if not excel.sheet_names:
    raise ValueError('The workbook does not contain a readable sheet.')
  sheet_name = excel.sheet_names[0]
  columns = [str(column).strip() for column in pd.read_excel(excel, sheet_name=sheet_name, nrows=0).columns if str(column).strip()]
  return {'sheetName': sheet_name, 'columns': columns[:100]}

json.dump(inspect(json.load(sys.stdin)), sys.stdout, ensure_ascii=False)
