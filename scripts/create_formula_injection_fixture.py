import sys

from openpyxl import Workbook


workbook = Workbook()
sheet = workbook.active
sheet.title = "Imported data"
sheet.append(["=HYPERLINK(\"https://untrusted.example\",\"Open\")", "+1+1", "-1+1", "@SUM(A1:A1)"])
workbook.save(sys.argv[1])
