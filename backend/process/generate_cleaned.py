import asyncio
import pm4py
import pandas as pd
import numpy as np
import json
import re
import os
import google.generativeai as genai
from openai import OpenAI

# ================== Helper functions ==================
# Hàm trích str -> json
async def extract_json_between_braces(text):
    # Xử lý nếu có markdown ```json
    text = text.strip()
    if text.startswith("```json"):
        text = text.replace("```json", "").strip()
    if text.endswith("```"):
        text = text[:-3].strip()    # xóa ``` cuối
        
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        json_str = match.group(0)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            print("JSON decode error:", e)
            print("Raw JSON string:\n", json_str)
        raise
    else:
        raise ValueError("Không tìm thấy JSON giữa dấu ngoặc.")


# Hàm call Gemini:
async def call_gemini(prompt, GEMINI_API_KEY):
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content(prompt)
    return response.text

# Hàm call Perplexity
async def call_perplexity(prompt, PERPLEXITY_API_KEY):
    client = OpenAI(
        api_key=PERPLEXITY_API_KEY,
        base_url="https://api.perplexity.ai"
    )

    response = client.chat.completions.create(
        model="sonar-pro",  # hoặc sonar-medium-online, sonar-small-online...
        messages=[
            {"role": "system", "content": "Bạn là trợ lý AI hữu ích."},
            {"role": "user", "content": prompt}
        ]
    )

    return(response.choices[0].message.content)

# Điền khuyết giá trị thiếu.
async def impute_groupwise(df, group_col, num_cols, cat_cols):
    df = df.copy()

    # ===== Xử lý cột số =====
    for col in num_cols:
        # Tính mean theo group
        group_mean = df.groupby(group_col)[col].transform('mean')
        # Điền thiếu bằng mean trong group
        df[col] = df[col].fillna(group_mean)
        # Nếu tất cả cùng thiếu thì fallback = 0
        df[col] = df[col].fillna(0)

    # ===== Xử lý cột phân loại =====
    for col in cat_cols:
        async def fill_mode(series):
            mode_val = series.mode()
            if not mode_val.empty:
                return series.fillna(mode_val.iloc[0])
            else:
                return series  # chưa fill nếu không có mode
        
        df[col] = df.groupby(group_col)[col].transform(fill_mode)
        # Fallback nếu toàn NaN trong group
        df[col] = df[col].fillna('Unknown')

    return df

# ================== Main preprocessing pipeline ==================
async def preprocess_event_logs(input_file_name, description_file_name, GEMINI_API_KEY, path='../data/'):
    # Đọc file description
    input_path = os.path.join(path, input_file_name)
    description_path = os.path.join(path, description_file_name)

    # Check file có tồn tại không
    if not os.path.exists(input_path):
        return {"error": f"Input file không tồn tại: {input_path}"}
    if not os.path.exists(description_path):
        return {"error": f"Description file không tồn tại: {description_path}"}

    with open(path + description_file_name, 'r', encoding='utf-8') as f:
        description_text = f.read()

    # Tìm thời gian bắt đầu, kết thúc từ file description
    find_start_end_times = f"""
    Bạn được cung cấp một đoạn mô tả dữ liệu event logs dưới đây:

    --- MÔ TẢ ---
    {description_text}
    --- HẾT MÔ TẢ ---

    Nhiệm vụ của bạn là:
    1. Xác định thời điểm **bắt đầu** (start_time) và **kết thúc** (end_time) của event log nếu có trong mô tả.
    2. Chuẩn hóa 2 thời điểm đó sang định dạng '%Y-%m-%d %H:%M:%S'.
    3. Trả về **duy nhất một đối tượng JSON** như sau:

    ```json
        {{
            "start_time": "%Y-%m-%d %H:%M:%S",
            "end_time": "%Y-%m-%d %H:%M:%S"
        }}

    Lưu ý: Chỉ trả về JSON. Không cần giải thích, không in thêm chữ nào khác. Nếu không tìm thấy, để giá trị là 'NULL'.
    """
    start_end_times_text = await call_gemini(find_start_end_times, GEMINI_API_KEY)
    start_end_times = await extract_json_between_braces(start_end_times_text)
    print('Trích xuất start_end_times.')

    # Load event logs
    logs = pm4py.read_xes(path + input_file_name)
    print('Load event logs.')

    # Chuyển event logs sang dataframe
    df_logs = pm4py.convert_to_dataframe(logs)
    df_columns = df_logs.columns

    # Tìm tên cột phù hợp cho Case ID, Activities Name, Timestamp.
    find_columns_name = f"""
    Dưới đây là danh sách cột từ một event log:
    {df_columns}

    Nếu chỉ có 1 cột timestamp, trả về dưới dạng JSON:
    - case_id_column
    - activity_column
    - timestamp_column

    Nếu có 2 cột timestamp, trả về dưới dạng JSON:
    - case_id_column
    - activity_column
    - start_timestamp_column
    - end_timestamp_column

    Lưu ý: Chỉ trả về JSON. Không cần giải thích, không in thêm chữ nào khác. Nếu không tìm thấy, để giá trị là 'NULL'.
    """

    main_column_names_text = await call_gemini(find_columns_name, GEMINI_API_KEY)
    main_column_names = await extract_json_between_braces(main_column_names_text)
    print('Lấy tên cột chính.')

    # Bước 1: Kiểm tra có đủ 3 cột chính. (ID, Activity, Timestamp)
    async def check_enough_main_columns(main_column_names):
        if len(main_column_names) == 3:
            if all(main_column_names[k] != 'NULL' for k in ['case_id_column', 'activity_column', 'timestamp_column']):
                return 'Enough 3 main columns.'
        elif len(main_column_names) == 4:
            if all(main_column_names[k] != 'NULL' for k in ['case_id_column', 'activity_column', 'start_timestamp_column', 'end_timestamp_column']):
                return 'Enough 4 main columns.'
        return 'Not enough main columns.'
    
    check_response = await check_enough_main_columns(main_column_names)
    print('Bước 1: Kiểm tra có đủ 3 cột chính.')

    # Bước 2: Đổi tên cột về đúng định dạng.
    if check_response == 'Enough 3 main columns.':
        df_logs.rename(columns={
            main_column_names['case_id_column']: 'case:concept:name',
            main_column_names['activity_column']: 'concept:name',
            main_column_names['timestamp_column']: 'time:timestamp'
        }, inplace=True)

    elif check_response == 'Enough 4 main columns.':
        df_logs.rename(columns={
            main_column_names['case_id_column']: 'case:concept:name',
            main_column_names['activity_column']: 'concept:name',
            main_column_names['start_timestamp_column']: 'time:start_timestamp',
            main_column_names['end_timestamp_column']: 'time:end_timestamp'
        }, inplace=True)

        if 'duration' not in df_logs.columns:
            df_logs['duration'] = df_logs['time:end_timestamp'] - df_logs['time:start_timestamp']

    else:
        raise ValueError("Not enough main columns to continue preprocessing.")
    print('Bước 2: Đổi tên cột về đúng định dạng.')


    # Bước 3: Loại bỏ cột toàn Nan hay chỉ có 1 giá trị
    df_logs = df_logs.loc[:, df_logs.nunique(dropna=False) > 1]
    print('Bước 3: Loại bỏ cột toàn Nan hay chỉ có 1 giá trị')

    # Bước 4: Loại bỏ các case không có hoạt động nào nằm trong start_time -> end_time
    print('Bước 4: Loại bỏ các case không có hoạt động nào nằm trong start_time -> end_time')
    if start_end_times['start_time'] != 'NULL' and start_end_times['end_time'] != 'NULL':
        df_logs = pm4py.filter_time_range(df_logs, start_end_times['start_time'], start_end_times['end_time'], mode='traces_intersecting')
    else:
        print('Không tìm thấy start_end hoặc time_end. Bỏ qua bước lọc thời gian.')

    # Bước 5: Xóa dòng thiếu thông tin ở các cột chính.
    # Bước 5.1: Xóa các dòng bị Null ở cột case:concept:name.
    df_logs = df_logs.loc[:, ~df_logs.columns.duplicated()].copy()
    df_logs = df_logs[~df_logs['case:concept:name'].isnull()].copy() 


    # Bước 5.2: Xóa các dòng bị Null ở cột chính còn lại.
    if check_response == 'Enough 3 main columns.':
        invalid_activities = df_logs[df_logs[['concept:name', 'time:timestamp']].isnull().any(axis=1)]  
    else: 
        invalid_activities = df_logs[df_logs[['concept:name', 'time:start_timestamp', 'time:end_timestamp']].isnull().any(axis=1)]

    cases_to_remove = invalid_activities['case:concept:name'].unique()
    df_logs = df_logs[~df_logs['case:concept:name'].isin(cases_to_remove)].copy()
    print('Bước 5: Xóa dòng thiếu thông tin ở các cột chính.')

    # Bước 6: Xóa các bản ghi trùng lặp ở các cột chính.
    if check_response == 'Enough 3 main columns.':
        df_logs = df_logs.drop_duplicates(subset=['case:concept:name', 'concept:name', 'time:timestamp'], keep='first').copy()
    else:
        df_logs = df_logs.drop_duplicates(subset=['case:concept:name', 'concept:name', 'time:start_timestamp', 'time:end_timestamp'], keep='first').copy()
    print('Bước 6: Xóa các bản ghi trùng lặp ở các cột chính.')

    # # Bước 7: Điền khuyết thông tin bị thiếu (ở các cột phụ), theo nguyên tắc.
    # #   Với các ô bị thiếu, lấy thông tin từ activities cùng case và điền vào.
    # #   Nếu cả case đều thiếu cột đó, điền 'Unknown' với categorical columns và 0 với numerical columns.
    # num_cols = df_logs.select_dtypes(include=['number']).columns.tolist()
    # cat_cols = df_logs.select_dtypes(include=['object', 'category', 'bool']).columns.tolist()
    # df_logs = impute_groupwise(df_logs, 'case:concept:name', num_cols, cat_cols)
    # print('Bước 7: Điền khuyết thông tin bị thiếu (ở các cột phụ), theo nguyên tắc')
    # print('Tiền xử lí dữ liệu xong.')

    return df_logs

from . import prinvohieuhoa
import traceback

async def clean_and_save_logs(folder_path, GEMINI_API_KEY=None):
    files = await asyncio.to_thread(os.listdir, folder_path)

    log_file = next((f for f in files if f.endswith('.xes') or f.endswith('.xes.gz')), None)
    desc_file = next((f for f in files if f.endswith('.txt')), None)

    if log_file is None or desc_file is None:
        print("[⚠️] Không tìm thấy file log (.xes/.xes.gz) hoặc file mô tả (.txt)")
        return None
    
    # Nếu preprocess_event_logs là async def:
    
    clean_df = await preprocess_event_logs(
            input_file_name=log_file,
            description_file_name=desc_file,
            GEMINI_API_KEY=GEMINI_API_KEY,
            path=folder_path)
      



    if clean_df is None:
        print("[⚠️] Không có logs nào được lưu vì quá trình preprocessing bị dừng.")
        return None

    
    clean_df = await asyncio.to_thread(
        pm4py.objects.log.util.dataframe_utils.convert_timestamp_columns_in_df,
        clean_df
    )
   

    # Convert sang EventLog
    event_log = pm4py.objects.conversion.log.converter.apply(clean_df)

    # Đảm bảo chỉ thêm _cleaned 1 lần
    base_name = log_file.replace('.xes.gz', '').replace('.xes', '')
    output_file = f"{base_name}_cleaned.xes"
    output_path = os.path.join(folder_path, output_file)

    pm4py.write_xes(event_log, output_path)
    print(f"[✅] Logs đã được lưu thành công vào: {output_path}")
    return output_file






