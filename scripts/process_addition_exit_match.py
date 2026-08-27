import base64, io, json, re, sys
import pandas as pd

def key(series): return series.fillna('').astype(str).str.replace(r'[^a-zA-Z0-9]', '', regex=True).str.lower().str.strip()
def preview(dataframe): return {"columns":[str(column) for column in dataframe.columns],"rows":[[None if pd.isna(value) else value for value in row] for row in dataframe.head(50).itertuples(index=False,name=None)]} if not dataframe.empty else {"columns":[],"rows":[]}
def selected_column(dataframe, requested, fallback, label, required=False):
  column = requested or fallback
  if column and column in dataframe.columns: return column
  if requested: raise ValueError(f"Selected {label} column was not found: {requested}")
  if required: raise ValueError(f"Required {label} column missing: {fallback}")
  return None
def values(dataframe, column): return dataframe[column] if column else pd.Series('', index=dataframe.index)

def process(payload):
  original = pd.read_excel(io.BytesIO(base64.b64decode(payload['original']['data'])), dtype=str)
  exit_data = pd.read_excel(io.BytesIO(base64.b64decode(payload['exit']['data'])), dtype=str)
  mapping = payload.get('mapping') or {}
  original_phone = selected_column(original, mapping.get('originalPhone'), 'mobile_number', 'original Phone')
  original_nrc = selected_column(original, mapping.get('originalNrc'), 'identity_number', 'original NRC')
  original_corporate = selected_column(original, mapping.get('originalCorporateName'), 'corporate_name', 'original Corporate Name')
  exit_phone = selected_column(exit_data, mapping.get('secondPhone'), 'Mobile No', '2nd File Phone', required=True)
  exit_nrc = selected_column(exit_data, mapping.get('secondNrc'), 'NRC No', '2nd File NRC', required=True)
  for column in ['hospital_registration_number','fullname','date_of_birth']:
    if column not in original: original[column] = ''
  original['_m'] = key(values(original, original_phone)); original['_n'] = key(values(original, original_nrc))
  exit_data['_m'] = key(exit_data[exit_phone]); exit_data['_n'] = key(exit_data[exit_nrc])
  mobile_matches = original[original._m!=''].drop_duplicates('_m').set_index('_m')
  nrc_matches = original[original._n!=''].drop_duplicates('_n').set_index('_n')
  match_columns = {'hospital_registration_number':'hospital_registration_number','corporate_name':original_corporate,'fullname':'fullname','date_of_birth':'date_of_birth'}
  for output_column, source_column in match_columns.items():
    exit_data['Matched_'+output_column] = exit_data.apply(lambda row: (mobile_matches.loc[row._m][source_column] if source_column and row._m in mobile_matches.index else (nrc_matches.loc[row._n][source_column] if source_column and row._n in nrc_matches.index else '')), axis=1)
  both = exit_data._m.isin(set(mobile_matches.index)) & exit_data._n.isin(set(nrc_matches.index)); mobile_only = exit_data._m.isin(set(mobile_matches.index)) & ~exit_data._n.isin(set(nrc_matches.index)); nrc_only = ~exit_data._m.isin(set(mobile_matches.index)) & exit_data._n.isin(set(nrc_matches.index)); no_match = ~exit_data._m.isin(set(mobile_matches.index)) & ~exit_data._n.isin(set(nrc_matches.index))
  groups = {'Both Mobile & NRC Matched':exit_data[both],'Only Mobile Matched':exit_data[mobile_only],'Only NRC Matched':exit_data[nrc_only],'New Records (No Match)':exit_data[no_match]}; groups = {name:data.drop(columns=['_m','_n']) for name,data in groups.items()}
  summary = pd.DataFrame([{'Category':name,'Total Records':len(data)} for name,data in groups.items()]+[{'Category':'GRAND TOTAL (File 2 Size)','Total Records':len(exit_data)}]); output = io.BytesIO()
  with pd.ExcelWriter(output,engine='openpyxl') as writer:
    summary.to_excel(writer,sheet_name='Summary Report',index=False)
    for name,data in groups.items(): data.to_excel(writer,sheet_name=name,index=False)
  output.seek(0); return {'outputFilename':'Data_Validation_Match_Report.xlsx','summary':preview(summary),'groups':{name:preview(data) for name,data in groups.items()},'workbookBase64':base64.b64encode(output.read()).decode('ascii')}
json.dump(process(json.load(sys.stdin)),sys.stdout,ensure_ascii=False,allow_nan=False)
