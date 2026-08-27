import sys
from openpyxl import Workbook

workbook = Workbook()
sheet = workbook.active
sheet.title = "Records"
sheet.append(["Entity Name", "Status"])
sheet.append(["Fallback Entity", "Removed"])
workbook.create_sheet("Notes").append(["Info"])
workbook.save(sys.argv[1])
