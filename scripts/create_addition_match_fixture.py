import sys
from openpyxl import Workbook
def make(path, headers, rows):
 wb=Workbook(); ws=wb.active; ws.append(headers)
 for r in rows: ws.append(r)
 wb.save(path)
if sys.argv[1]=='original': make(sys.argv[2],['mobile_number','identity_number','hospital_registration_number','corporate_name','fullname','date_of_birth'],[['09-1','NRC-1','H1','Corp','Original Mobile','2000'],['09-2','NRC-2','H2','Corp','Original NRC','2001']])
else: make(sys.argv[2],['Mobile No','NRC No'],[['091','NRC1'],['091','NRC-x'],['099','NRC2'],['000','NONE']])
