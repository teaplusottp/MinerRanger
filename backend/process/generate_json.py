# Import libraries
import pm4py
import pandas as pd
import numpy as np
import re
import json
import google.generativeai as genai
from openai import OpenAI

from pm4py.statistics.traces.generic.log import case_arrival
from pm4py.statistics.variants.log import get as variants_get
from pm4py.statistics.traces.generic.pandas import case_statistics


from pm4py.visualization.petri_net import visualizer as petri_net_visualizer
from pm4py.visualization.heuristics_net import visualizer as hn_visualizer
from pm4py.algo.discovery.dfg import algorithm as dfg_discovery
from pm4py.statistics.start_activities.log import get as start_activities_get
from pm4py.statistics.end_activities.log import get as end_activities_get
from pm4py.visualization.dfg import visualizer as dfg_visualization
from pm4py.visualization.bpmn import visualizer as bpmn_visualizer
from pm4py.visualization.dotted_chart import visualizer as dotted_chart_visualizer
from pm4py.algo.discovery.temporal_profile import algorithm as temporal_profile_discovery
from pm4py.algo.conformance.tokenreplay import algorithm as token_based_replay



import matplotlib.pyplot as plt
import seaborn as sns
import os

def analysis_event_logs(input_file_name, description_file_name, GEMINI_API_KEY, path):
    # ================== Helper functions ==================
    # Hàm trích str -> json
    def extract_json_between_braces(text):
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
    def call_gemini(prompt, GEMINI_API_KEY):
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(prompt)
        return response.text
    
    # Đọc file description
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
    start_end_times_text = call_gemini(find_start_end_times, GEMINI_API_KEY)
    start_end_times = extract_json_between_braces(start_end_times_text)
    print('Trích xuất start_end_times.')

    # ================== LOAD DATASET ==================
    logs = pm4py.read_xes(path + input_file_name)
    print('Load clean dataset.')
    df_logs = pm4py.convert_to_dataframe(logs)

    # ================== BASIC STATISTICS ==================
    print('1. Basic Statistics.')
    num_events = df_logs.shape[0]
    num_activities = df_logs['concept:name'].nunique()
    num_cases = df_logs['case:concept:name'].nunique()
    variants = variants_get.get_variants(df_logs)
    num_variants = len(variants)

    # Số activities trung bình mỗi case.
    activities_per_case = df_logs.groupby("case:concept:name")["concept:name"].nunique()
    average_activities_per_case = round(activities_per_case.mean())
    max_activities_per_case = activities_per_case.max()
    min_activities_per_case = activities_per_case.min()

    # Thống kê activities by frequency
    unique_case_activities = df_logs[['case:concept:name', 'concept:name']].drop_duplicates()
    activities_frequency = unique_case_activities['concept:name'].value_counts().reset_index()

    if num_activities > 10:
        k_activities = 10
    else:
        k_activities = num_activities

    top_k_activities_with_frequency_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu và mô tả biểu đồ cho process mining từ event logs.  
    Tôi sẽ cung cấp cho bạn dữ liệu đầu vào của một biểu đồ và thông tin về loại biểu đồ.  
    Nhiệm vụ của bạn: 
    - Dùng dữ liệu được cung cấp để tạo mô tả chi tiết cho biểu đồ (insight). 
    - Tối đa 200 chữ, tiếng Việt.

    Dưới đây là dữ liệu đầu vào (dữ liệu gốc đã dùng để vẽ biểu đồ):

    {activities_frequency['concept:name'], activities_frequency['count']}
    """
    top_k_activities_with_frequency_chart_insight = call_gemini(top_k_activities_with_frequency_prompt, GEMINI_API_KEY)
    def get_k_variants(variants_with_frequency, num_cases, num_variants, min_k=10, coverage_threshold=85):
        coverage = 0
        k = 0
        min_coverage = 0

        if num_variants <= 10:
            return num_variants, 1, 0
        else:
            for variant in variants_with_frequency:
                percentage = variant[1] / num_cases 
                coverage += percentage
                k += 1

                if k > 10 and coverage >= 0.85:
                    min_coverage = percentage
                    break
            return k, coverage/100, min_coverage
    variants_with_frequency = variants_get.get_variants_sorted_by_count(variants)
    k_variants, coverage_variants, min_coverage_variants = get_k_variants(variants_with_frequency, num_cases, num_variants)

    # Top k variants
    top_k_variants = variants_with_frequency[:k_variants]
    top_k_variant_indexes = []
    top_k_variant_counts = []
    top_k_variant_names = []
    for i, (variant, count) in enumerate(top_k_variants, 1):
        top_k_variant_indexes.append(f"Variant {i}")
        top_k_variant_counts.append(count)
        top_k_variant_names.append(variant)
        percentage = round((count/num_cases*100), 2)
        # print(f"{i}. {variant} | {count} cases | {percentage}%")

    top_k_variant_chart_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu và mô tả biểu đồ.  
    Tôi sẽ cung cấp cho bạn dữ liệu đầu vào của một biểu đồ và thông tin về loại biểu đồ cho process mining từ event logs.  
    Nhiệm vụ của bạn: 
    - Sử dụng dữ liệu được cung cấp để tạo phần mô tả chi tiết cho biểu đồ (insight). 
    - Tối đa 200 chữ, tiếng Việt.
    Dưới đây là dữ liệu đầu vào (dữ liệu gốc đã dùng để vẽ biểu đồ):

    {top_k_variant_names, top_k_variant_counts}
    """
    top_k_variants_chart_insight = call_gemini(top_k_variant_chart_prompt, GEMINI_API_KEY)

    basic_statistics_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu.  
    Mục tiêu: Nhận đầu vào đã được tính toán trước (số liệu thống kê cơ bản + kết quả/insight từ các biểu đồ) và viết nhận xét về chúng.

    Nhiệm vụ:  
    1. Phân tích và tổng hợp insight từ các số liệu và biểu đồ tôi cung cấp.  
    2. Đưa ra đánh giá khách quan, chính xác, phù hợp với ngữ cảnh qui trình đang xét.
    3. Kết quả trả về là 1 đoạn text duy nhất, không quá 300 chữ, viết bằng tiếng Việt.
    4. Ngôn từ chuẩn mực và chuyên nghiệp, đây là 1 phần trong 1 bài báo cáo.
    5. Lưu ý không đưa ra gợi ý cải tiến, phần này không thuộc chức năng của bạn.


    Dưới đây là dữ liệu đầu vào (dữ liệu gốc để bạn phân tích và nhận xét):
    {{
    "basic_statistics": {{
        "log_name": {input_file_name},
        "num_events": {num_events},
        "num_cases": {num_cases},
        "num_activities": {num_activities},
        "num_variants": {num_variants},
        "activities_frequency": {activities_frequency},
        "average_activity_per_case": {average_activities_per_case},
        "top_k_activity_chart": {{
            "data": [{activities_frequency['concept:name']}, {activities_frequency['count']}],
            "insight": {top_k_activities_with_frequency_chart_insight}}},
        "top_k_variant_chart": {{
            "data": [{top_k_variant_names}, {top_k_variant_counts}],
            "insight": {top_k_variants_chart_insight}}}
    }}
    }}
    """
    basic_statistics_insight = call_gemini(basic_statistics_prompt, GEMINI_API_KEY)

    # ================== PROCESS DISCOVERY ==================
    print('2. Process Discovery.')
    filtered_logs = pm4py.filter_variants_top_k(logs, k_variants)

    tree = pm4py.discover_process_tree_inductive(filtered_logs)
    bpmn_graph = pm4py.convert_to_bpmn(tree)
    pm4py.write_bpmn(bpmn_graph, path + "bpmn_model.bpmn")

    dfg_freq = dfg_discovery.apply(filtered_logs, variant=dfg_discovery.Variants.FREQUENCY)
    dfg_perf = dfg_discovery.apply(filtered_logs, variant=dfg_discovery.Variants.PERFORMANCE)
    dfg_perf = {k: round(v / 86400, 2) for k, v in dfg_perf.items()}
    process_map_prompt = f"""
        Bạn là một hệ thống phân tích dữ liệu.  
        Mục tiêu: Nhận xét chung về BPMN model.

        Nhiệm vụ: 
        1. Mô tả chung mô hình qui trình BPMN được cung cấp.
        2. Phân tích và tổng hợp insight từ các BPMN model và số liệu thống kế được cung cấp: Điểm nào bị nghẽn, Hoạt động nào quan trọng,...
        3. Kết quả trả về là 1 đoạn text duy nhất, không quá 300 chữ, viết bằng tiếng Việt.
        4. Ngôn từ chuẩn mực và chuyên nghiệp, đây là 1 phần trong 1 bài báo cáo.
        5. Lưu ý không đưa ra gợi ý cải tiến, phần này không thuộc chức năng của bạn.


        Đầu vào: 
        - {path + 'bpmn_model.png'}
        - Thống kê tần suất: {dfg_freq} 
        - Thống kê hiệu năng: {dfg_perf} (đơn vị: ngày).
    """
    process_map_insight = call_gemini(process_map_prompt, GEMINI_API_KEY)
    
    # ================== PERFORMANCE ANALYSIS ==================
    print('3. Performance Analysis.')
    # Get all case durations
    all_case_durations = pm4py.get_all_case_durations(df_logs)
    all_case_durations = [round(duration / (24 * 3600), 2) for duration in all_case_durations] 

    # Max duration
    max_case_duration = max(all_case_durations)

    # Mean duration
    mean_case_duration = round(np.mean(all_case_durations), 2)

    # Min duration
    min_case_duration = min(all_case_durations)

    # Kernel Density Estimate Chart.
    plt.figure(figsize=(10, 5))
    sns.kdeplot(all_case_durations, bw_adjust=0.5, fill=True, color='blue')

    plt.title("Throughput Time Density")
    plt.xlabel("Case Duration (days)")
    plt.ylabel("Density")
    plt.grid(True, linestyle='--', alpha=0.3)
    plt.tight_layout()

    plt.savefig(path + "throughput_time_density.png", dpi=300)

    throughput_time_density_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu và mô tả biểu đồ cho process mining từ event logs.  

    Nhiệm vụ của bạn: 
    - Dùng dữ liệu được cung cấp để tạo mô tả chi tiết và đưa ra nhận xét cho biểu đồ (insight). 
    - Tối đa 200 chữ, tiếng Việt.

    Dưới đây là biểu đồ cần mô tả và nhận xét:

    {path + "throughput_time_density.png"}
    """
    throughput_time_density_insight = call_gemini(throughput_time_density_prompt, GEMINI_API_KEY)
    # Case Arrival Ratio: Thời gian trung bình giữa 2 case liên tiếp nhau, tính bằng thời điểm bắt đầu của mỗi case. 
    # -> Mức độ thường xuyên hệ thống tiếp nhận case mới.
    case_arrival_ratio = pm4py.get_case_arrival_average(df_logs)
    case_arrival_ratio = round(case_arrival_ratio / (24 * 3600), 2)

    # Case Dispersion Ratio: Thời gian trung bình giữa thời điểm kết thúc của 2 case liên tiếp
    # -> Đánh giá tốc độ xử lí đầu ra.
    case_dispersion_ratio = round(case_arrival.get_case_dispersion_avg(df_logs, parameters={case_arrival.Parameters.TIMESTAMP_KEY: "time:timestamp"}) / (24 * 3600), 2)
    
    gviz = dotted_chart_visualizer.apply(
        logs,
        attributes=["time:timestamp", "concept:name"],  # bắt buộc
    )

    dotted_chart_visualizer.save(gviz, path + "dotted_chart.png")

    dotted_chart_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu và mô tả biểu đồ cho process mining từ event logs.  

    Nhiệm vụ của bạn: 
    - Dùng dữ liệu được cung cấp để tạo mô tả chi tiết và đưa ra nhận xét cho biểu đồ (insight). 
    - Tối đa 200 chữ, tiếng Việt.

    Dưới đây là biểu đồ cần mô tả và nhận xét:

    {path + "dotted_chart.png"}
    """
    dotted_chart_insight = call_gemini(dotted_chart_prompt, GEMINI_API_KEY)

    temporal_profile = temporal_profile_discovery.apply(filtered_logs)
    temporal_profile_days = {
        k: (round(v[0] / 86400, 2), round(v[1] / 86400, 2)) for k, v in temporal_profile.items()
    }
    temporal_profile_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu và mô tả biểu đồ cho process mining từ event logs.  

    Nhiệm vụ của bạn: 
    - Dùng dữ liệu được cung cấp để tạo mô tả chi tiết và đưa ra nhận xét cho temporal profile của qui trình (insights).
    - Tối đa 200 chữ, tiếng Việt.

    Dưới đây là temporal profile cần mô tả và nhận xét, gồm các thông số (From, To, Mean (days), Std (days)): 

    {temporal_profile_days}
    """
    temporal_profile_insight = call_gemini(temporal_profile_prompt, GEMINI_API_KEY)
    
    performance_analysis_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu.  
    Mục tiêu: Nhận đầu vào đã được tính toán trước (các chỉ số hiệu năng của qui trình + kết quả/insight từ các biểu đồ) và viết nhận xét về chúng.

    Nhiệm vụ:  
    1. Phân tích và tổng hợp insight từ các chỉ số và biểu đồ tôi cung cấp.  
    2. Đưa ra đánh giá khách quan, chính xác, phù hợp với ngữ cảnh qui trình đang xét. 
    3. Kết quả trả về là 1 đoạn text duy nhất, không quá 300 chữ.
    4. Ngôn từ chuẩn mực và chuyên nghiệp, đây là 1 phần trong 1 bài báo cáo.
    5. Lưu ý không đưa ra gợi ý cải tiến, phần này không thuộc chức năng của bạn.

    Dưới đây là dữ liệu đầu vào (dữ liệu gốc để bạn phân tích và nhận xét):
    {{
    "performance_analysis": {{
        "mean_case_duration_hours": {mean_case_duration},
        "max_case_duration_hours": {max_case_duration},
        "min_case_duration_hours": {min_case_duration},
        "case_arrival_ratio": {case_arrival_ratio},
        "case_dispersion_ratio": {case_dispersion_ratio},
        "dotted_chart": {{
        "img_url": "{"dotted_chart.png"}",
        "insight": {dotted_chart_insight}
        }},
        "throughtput_time_density": {{
        "img_url": "{"throughput_time_density.png"}",
        "insight": {throughput_time_density_insight}
        }},
        "temporal_profile": {{
        "data": {temporal_profile_days},
        "insight": {temporal_profile_insight}
        }},
    }}
    }}
    """
    performance_analysis_insight = call_gemini(performance_analysis_prompt, GEMINI_API_KEY)
    
    # ================== CONFORMANCE CHECKING ==================
    print('4. Conformance Checking.')
    net, initial_marking, final_marking = pm4py.discover_petri_net_inductive(filtered_logs)
    parameters_tbr = {
        token_based_replay.Variants.TOKEN_REPLAY.value.Parameters.DISABLE_VARIANTS: True,
        token_based_replay.Variants.TOKEN_REPLAY.value.Parameters.ENABLE_PLTR_FITNESS: True
    }

    replayed_traces, place_fitness, trans_fitness, unwanted_activities = token_based_replay.apply(
        logs, net, initial_marking, final_marking, parameters=parameters_tbr
    )
    # Đếm số case không tuân thủ (fitness < 1)
    num_unfit_cases = sum(1 for t in replayed_traces if t["trace_fitness"] < 1.0)
    unfit_cases_percentage = np.round((num_unfit_cases / num_cases) * 100 if num_cases > 0 else 0, 2)

    # Filter logs of unfit cases
    list_trace_ids = logs['case:concept:name'].drop_duplicates().tolist()
    unfit_trace_indices = [i for i, t in enumerate(replayed_traces) if t["trace_fitness"] < 1.0]
    list_unfit_trace_ids = [list_trace_ids[i] for i in unfit_trace_indices]
    unfit_trace_logs = logs[logs['case:concept:name'].isin(list_unfit_trace_ids)]
    unfit_dfg_freq = dfg_discovery.apply(unfit_trace_logs, variant=dfg_discovery.Variants.FREQUENCY)
    unfit_edges = [e for e in unfit_dfg_freq.keys() if e not in dfg_freq.keys()]
    unfit_edges_with_count = [
        (e, unfit_dfg_freq[e])
        for e in unfit_dfg_freq.keys()
        if e not in dfg_freq.keys()
    ]
    unfit_edges_with_count_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu và mô tả biểu đồ cho process mining từ event logs.  

    Nhiệm vụ của bạn: 
    - Dùng dữ liệu được cung cấp để tạo mô tả chi tiết và đưa ra nhận xét cho các cạnh vi phạm qui trình chuẩn (nghĩa là không có trong qui trình chuẩn).
    - Tối đa 200 chữ, tiếng Việt.

    Dưới đây là thông tin được cung cấp:  

    {unfit_edges_with_count}
    """
    unfit_edges_with_count_insight = call_gemini(unfit_edges_with_count_prompt, GEMINI_API_KEY)
    
    unwanted_activity_names = list(unwanted_activities.keys())
    unwanted_activity_stats = []
    for name in unwanted_activity_names:
        count = len(unwanted_activities[name])
        percentage = round((count / num_cases) * 100 if num_cases > 0 else 0, 2)
        unwanted_activity_stats.append({
            "activity_name": name,
            "count": count,
            "percentage": percentage
        })
    # Lấy tên activity và số case
    activities = [item['activity_name'] for item in unwanted_activity_stats]
    counts = [item['count'] for item in unwanted_activity_stats]
    percentages = [item['percentage']*100 for item in unwanted_activity_stats]  # chuyển sang %

    # Vẽ biểu đồ cột
    plt.figure(figsize=(10, 6))
    bars = plt.barh(activities, counts, color='skyblue', edgecolor='black')
    plt.xlabel("Number of Cases")
    plt.title("Unwanted Activities in Event Log")

    # Thêm label phần trăm lên cột
    for bar, pct in zip(bars, percentages):
        width = bar.get_width()
        plt.text(width + 1, bar.get_y() + bar.get_height()/2, f"{pct:.1f}%", va='center')

    plt.gca().invert_yaxis()  # đảo thứ tự từ trên xuống dưới
    plt.tight_layout()

    # Lưu hình
    plt.savefig(path + "unwanted_activity_stats.png", dpi=300)
    unwanted_activity_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu và mô tả biểu đồ cho process mining từ event logs.  

    Nhiệm vụ của bạn: 
    - Dùng dữ liệu được cung cấp để tạo mô tả chi tiết và đưa ra nhận xét cho các hoạt động vi phạm qui trình chuẩn (nghĩa là không có trong qui trình chuẩn).
    - Tối đa 200 chữ, tiếng Việt.

    Dưới đây là thông tin được cung cấp:  

    {unwanted_activity_stats}
    """
    unwanted_activity_insight = call_gemini(unwanted_activity_prompt, GEMINI_API_KEY)
    
    conformance_checking_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu.  
    Mục tiêu: Nhận đầu vào đã được tính toán trước (các chỉ số hiệu năng của qui trình + kết quả/insight từ các biểu đồ) và viết nhận xét về chúng.

    Nhiệm vụ:  
    1. Phân tích và tổng hợp insight từ các chỉ số và biểu đồ tôi cung cấp.  
    2. Đưa ra đánh giá khách quan, chính xác, phù hợp với ngữ cảnh qui trình đang xét. 
    3. Kết quả trả về là 1 đoạn text duy nhất, không quá 300 chữ.
    4. Ngôn từ chuẩn mực và chuyên nghiệp, đây là 1 phần trong 1 bài báo cáo.
    5. Lưu ý không đưa ra gợi ý cải tiến, phần này không thuộc chức năng của bạn.

    Dưới đây là dữ liệu đầu vào (dữ liệu gốc để bạn phân tích và nhận xét):
    {{
    "conformance_checking": {{
        "num_unfit_cases": {num_unfit_cases},
        "unfit_cases_percentage": {unfit_cases_percentage},
        "unfit_edges_with_count": {{
        "data": {unfit_edges_with_count},
        "insight": {unfit_edges_with_count_insight}
        }},
        "unwanted_activity_stats": {{
        "data": {unwanted_activity_stats},
        "insight": {unwanted_activity_insight}
        }},
    }}
    }}
    """
    conformance_checking_insight = call_gemini(conformance_checking_prompt, GEMINI_API_KEY)
    # ================== ENHANCEMENT ==================
    print('5. Enhancement.')
    enhancement_prompt = f"""
    Bạn là một hệ thống phân tích dữ liệu.  
    Mục tiêu: Nhận đầu vào là các thông tin rút ra được từ qui trình, đưa ra gợi ý cải tiến.

    Nhiệm vụ:  
    1. Trình bày các hạn chế của qui trình đang có (150 chữ)
    2. Đưa ra cải tiến để giải quyét các hạn chế trên. Cải tiến cần logic và khả thi (250 chữ).
    3. Ngôn từ chuẩn mực và chuyên nghiệp, đây là 1 phần trong 1 bài báo cáo.

    Dưới đây là dữ liệu đầu vào (dữ liệu gốc để bạn phân tích và nhận xét):
    - Thông tin về qui trình đang xét: {input_file_name}, mô tả: {description_text}
    - Thống kê cơ bản: {basic_statistics_insight}
    - Mô hình qui trình: {process_map_insight}
    - Phân tích hiệu năng: {performance_analysis_insight}
    - Phân tích độ tuân thủ: {conformance_checking_insight}
    """
    enhancement_insight = call_gemini(enhancement_prompt, GEMINI_API_KEY)
    # ================== SAVE REPORT ==================
    print('6. Save report.json.')
    # Hàm ép keys về str và convert numpy types -> Python native
    def safe_json(obj):
        import numpy as np
        if isinstance(obj, dict):
            return {str(k): safe_json(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [safe_json(i) for i in obj]
        elif isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float32, np.float64)):
            return float(obj)
        else:
            return obj

    report = {
        "report_title": "",
        "description": "",
        "dataset_overview": {
            "log_name": "",
            "date_range": {"start_time": "", "end_time": ""}
        },
        "basic_statistics": {
            "num_events": 0,
            "num_cases": 0,
            "num_activities": 0,
            "num_variants": 0,
            "average_activity_per_case": 0,
            "top_k_activity_chart": {"data": [], "insight": ""},
            "top_k_variant_chart": {"data": [], "insight": ""},
            "insights": []
        },
        "process_discovery": {
            "k_variants": "",
            "bpmn_model": "",
            "dfg_freq": "",
            "dfg_perf": "",
            "bpmn_model_new": "",
            "insights": ""
        },
        "performance_analysis": {
            "mean_case_duration_days": 0,
            "max_case_duration_days": 0,
            "min_case_duration_days": 0,
            "case_arrival_ratio": 0,
            "case_dispersion_ratio": 0,
            "dotted_chart": {"img_url": "", "insight": ""},
            "throughput_time_density_chart": {"img_url": "", "insight": ""},
            "temporal_profile": {"data": "", "insight": ""},
            "insights": []
        },
        "conformance_checking": {
            "num_unfit_cases": "",
            "unfit_cases_percentage": "",
            "unfit_edges_with_count": {"data": "", "insight": ""},
            "unwanted_activity_stats": {"data": "", "insight": ""},
            "insights": ""
        },
        "enhancement": {
            "insights": []
        }
    }
    report_name = input_file_name.split(".")[0] + "_Report"
    # Gán dữ liệu vào report
    report['report_title'] = report_name
    report['description'] = description_text
    report['dataset_overview']['date_range']['start_time'] = str(start_end_times['start_time'])
    report['dataset_overview']['date_range']['end_time'] = str(start_end_times['end_time'])

    report['basic_statistics']['num_events'] = int(num_events)
    report['basic_statistics']['num_cases'] = int(num_cases)
    report['basic_statistics']['num_activities'] = int(num_activities)
    report['basic_statistics']['num_variants'] = int(num_variants)
    report['basic_statistics']['average_activity_per_case'] = float(average_activities_per_case)

    report['basic_statistics']['top_k_activity_chart']['data'] = [
        list(map(str, activities_frequency['concept:name'][:k_activities].tolist())),
        list(map(int, activities_frequency['count'][:k_activities].tolist()))
    ]
    report['basic_statistics']['top_k_activity_chart']['insight'] = top_k_activities_with_frequency_chart_insight
    report['basic_statistics']['top_k_variant_chart']['data'] = [
        list(map(str, top_k_variant_names)),
        list(map(int, top_k_variant_counts))
    ]
    report['basic_statistics']['top_k_variant_chart']['insight'] = top_k_variants_chart_insight
    report['basic_statistics']['insights'] = basic_statistics_insight

    report['process_discovery']['bpmn_model'] = "bpmn_model.png"
    report['process_discovery']['k_variants'] = int(k_variants)
    report['process_discovery']['dfg_freq'] = safe_json(dfg_freq)
    report['process_discovery']['dfg_perf'] = safe_json(dfg_perf)
    report['process_discovery']['insights'] = process_map_insight

    report['performance_analysis']['mean_case_duration_days'] = float(mean_case_duration)
    report['performance_analysis']['max_case_duration_days'] = float(max_case_duration)
    report['performance_analysis']['min_case_duration_days'] = float(min_case_duration)
    report['performance_analysis']['case_arrival_ratio'] = float(case_arrival_ratio)
    report['performance_analysis']['case_dispersion_ratio'] = float(case_dispersion_ratio)
    report['performance_analysis']['dotted_chart'] = {
        "img_url": "dotted_chart.png",
        "insight": dotted_chart_insight
    }
    report['performance_analysis']['throughput_time_density_chart'] = {
        "img_url": "throughput_time_density.png",
        "insight": throughput_time_density_insight
    }
    report['performance_analysis']['temporal_profile'] = {
        "data": safe_json(temporal_profile_days),
        "insight": temporal_profile_insight
    }
    report['performance_analysis']['insights'] = performance_analysis_insight

    report['conformance_checking']['num_unfit_cases'] = int(num_unfit_cases)
    report['conformance_checking']['unfit_cases_percentage'] = float(unfit_cases_percentage)
    report['conformance_checking']['unfit_edges_with_count'] = {
        "data": safe_json(unfit_edges_with_count),
        "insight": unfit_edges_with_count_insight
    }
    report['conformance_checking']['unwanted_activity_stats'] = {
        "data": safe_json(unwanted_activity_stats),
        "insight": unwanted_activity_insight
    }
    report['conformance_checking']['insights'] = conformance_checking_insight

    report['enhancement']['insights'] = enhancement_insight

    # Cuối cùng: dump ra JSON
    with open(path + "report.json", "w", encoding="utf-8") as f:
        json.dump(safe_json(report), f, indent=4, ensure_ascii=False)

    return True

async def gen_report(folder_path,  GEMINI_API_KEY):
    files = os.listdir(folder_path)
    log_file = next((f for f in files if f.endswith('_cleaned.xes')), None)
    desc_file = next((f for f in files if f.endswith('.txt')), None)

    if log_file is None or desc_file is None:
        print("[⚠️] Không tìm thấy file log (.xes/.xes.gz) hoặc file mô tả (.txt)")
        return None

    create_report = analysis_event_logs(log_file, desc_file, GEMINI_API_KEY, folder_path)
    if create_report:
        return True
    return False
