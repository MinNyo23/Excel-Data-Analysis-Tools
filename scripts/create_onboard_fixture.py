import sys
import pandas as pd

kind, output = sys.argv[1], sys.argv[2]
if kind == 'onboard':
    pd.DataFrame([
        {'identity_number':'12/ABC(N)123456','hospital_registration_number':'H-001','corporate_name':'Alpha Care'},
        {'identity_number':'34/DEF(N)654321','hospital_registration_number':'H-002','corporate_name':'Beta Care'},
    ]).to_excel(output,index=False)
else:
    pd.DataFrame([
        {'NRC No':'12/ABC(N)123456','Employee':'Match'},
        {'NRC No':'99/ZZZ(N)000000','Employee':'No match'},
    ]).to_excel(output,index=False)
