import sys
import pandas as pd

pd.DataFrame([{
    'Employee Full Name':'Aye Aye', 'Employee ID':'EMP-01', 'Mobile No':'09123456789',
    'NRC No':'12/ABC(N)123456', 'Father Name':'U Aye', 'Date of Birth':'31/12/1990',
    'Email':'aye@example.com', 'Gender':'Female', 'Nationality':'Myanmar', 'Address':'Yangon',
}]).to_excel(sys.argv[1],index=False)
