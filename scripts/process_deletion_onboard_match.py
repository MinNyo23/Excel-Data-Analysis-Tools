import base64, io, json, re, sys
import pandas as pd
def clean(s): return s.fillna('').astype(str).str.replace(r'[^a-zA-Z0-9]','',regex=True).str.lower().str.strip()
def prev(d): return {'columns':[str(c) for c in d.columns],'rows':[[None if pd.isna(v) else v for v in r] for r in d.head(50).itertuples(index=False,name=None)]} if not d.empty else {'columns':[],'rows':[]}
def go(p):
 a=pd.read_excel(io.BytesIO(base64.b64decode(p['onboard']['data'])),dtype=str); b=pd.read_excel(io.BytesIO(base64.b64decode(p['deletion']['data'])),dtype=str)
 for c in ['identity_number','hospital_registration_number','corporate_name']:
  if c not in a:a[c]=''
 if 'NRC No' not in b:raise ValueError('Required deletion-file column missing: NRC No')
 a['_n']=clean(a.identity_number);b['_n']=clean(b['NRC No']);x=a[a._n!=''].drop_duplicates('_n').set_index('_n'); b['Matched_hospital_registration_number']=b._n.map(x.hospital_registration_number);b['Matched_corporate_name']=b._n.map(x.corporate_name);m=b._n.isin(set(x.index));yes=b[m].drop(columns='_n');no=b[~m].drop(columns='_n');s=pd.DataFrame([{'Category':'Matched List (NRC Found)','Total Records':len(yes)},{'Category':'No Match List (NRC Not Found)','Total Records':len(no)},{'Category':'GRAND TOTAL (File 2 Size)','Total Records':len(b)}]);o=io.BytesIO()
 with pd.ExcelWriter(o,engine='openpyxl') as w:s.to_excel(w,sheet_name='Summary Report',index=False);yes.to_excel(w,sheet_name='Matched List',index=False);no.to_excel(w,sheet_name='No Match List',index=False)
 o.seek(0);return {'outputFilename':'NRC_Match_Report.xlsx','summary':prev(s),'matched':prev(yes),'noMatch':prev(no),'workbookBase64':base64.b64encode(o.read()).decode()}
json.dump(go(json.load(sys.stdin)),sys.stdout,ensure_ascii=False,allow_nan=False)
