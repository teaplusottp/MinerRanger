# Import libraries
import os
import pm4py
import pandas as pd
import numpy as np
import re
import json
from dateutil import parser
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

#=================== FILTER LOGS WITH TIME RANGE ===================
def check_exist_logs(path, logs_name, start_time, end_time):
    """
    Kiểm tra xem file logs đã được filter theo khoảng thời gian hay chưa.
    
    Inputs:
        path (str): Đường dẫn folder chứa logs.
        logs_name (str): Tên file logs gốc (.xes).
        start_time (str): Thời gian bắt đầu filter, định dạng "YYYY-MM-DD HH:MM:SS".
        end_time (str): Thời gian kết thúc filter, định dạng "YYYY-MM-DD HH:MM:SS".
    
    Outputs:
        bool: True nếu file filter logs đã tồn tại, False nếu chưa.
    
    Purpose:
        Giúp tránh tạo lại file logs đã filter.
    """
    # Chuẩn hóa tên file giống format trong get_logs
    start_str = re.sub(r'[: ]', '-', start_time)
    end_str = re.sub(r'[: ]', '-', end_time)
    file_name = f"{start_str}__{end_str}.xes"
    out_path = os.path.join(path, file_name)

    if os.path.exists(out_path):
        return True
    else:
        return False

def get_logs(path, logs_name, start_time, end_time):
    """
    Lấy logs từ folder, có thể filter theo khoảng thời gian.

    Inputs:
        path (str): Đường dẫn folder chứa logs.
        logs_name (str): Tên file logs gốc (.xes).
        start_time (str): Thời gian bắt đầu filter, định dạng "YYYY-MM-DD HH:MM:SS" hoặc 'NULL'.
        end_time (str): Thời gian kết thúc filter, định dạng "YYYY-MM-DD HH:MM:SS" hoặc 'NULL'.
    
    Outputs:
        True: Nếu filter và lưu thành công.
        dict: {"info": "Filter logs is exist."} nếu file filter đã tồn tại.
    
    Purpose:
        Đọc logs, filter theo thời gian nếu cần, và lưu file filtered logs.
    """
    try:
        # Nếu file đã tồn tại, đọc luôn và trả về
        if check_exist_logs(path, start_time, end_time):
            return {"info": "Filter logs is exist."}

        # Nếu không filter, đọc toàn bộ logs
        if start_time == 'NULL' or end_time == 'NULL':
            return pm4py.read_xes(os.path.join(path, logs_name))

        # Parse start/end
        start_dt = parser.parse(start_time)
        end_dt = parser.parse(end_time)

        if start_dt >= end_dt:
            raise ValueError("Start time must be smaller than End time.")

        # Đọc report.json
        report_path = os.path.join(path, "report.json")
        with open(report_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        min_dt = parser.parse(data["dataset_overview"]["date_range"]["start_time"])
        max_dt = parser.parse(data["dataset_overview"]["date_range"]["end_time"])

        # So sánh thời gian (ép về naive để tránh TypeError)
        start_dt = start_dt.replace(tzinfo=None)
        end_dt = end_dt.replace(tzinfo=None)
        min_dt = min_dt.replace(tzinfo=None)
        max_dt = max_dt.replace(tzinfo=None)

        if start_dt < min_dt or end_dt > max_dt:
            raise ValueError("Range time to filter is out of event logs.")

        # Đọc log và filter
        logs = pm4py.read_xes(os.path.join(path, logs_name))
        filter_logs = pm4py.filter_time_range(
            logs, start_dt, end_dt, mode='traces_intersecting'
        )

        # Lưu file filter logs
        start_str = re.sub(r'[: ]', '-', start_time)
        end_str = re.sub(r'[: ]', '-', end_time)
        file_name = f"{start_str}__{end_str}.xes"
        out_path = os.path.join(path, file_name)
        pm4py.write_xes(filter_logs, out_path)

        return True

    except Exception as e:
        # Bất kỳ lỗi nào xảy ra đều raise
        raise e
    
#=================== BASIC STATISTICS ===================
def basic_statistics(path, filter_logs):
    """
    Tính toán các thống kê cơ bản của logs.

    Inputs:
        path (str): Đường dẫn folder chứa logs.
        filter_logs (str): Tên file xes đã được filter.
    
    Outputs:
        dict: Bao gồm số lượng events, activities, cases, variants, thống kê activities.
        keys:
            - logs_name
            - num_events
            - num_activities
            - num_cases
            - num_variants
            - variants
            - average_activities_per_case
            - max_activities_per_case
            - min_activities_per_case
            - activities_frequency (DataFrame)
    
    Purpose:
        Hiểu được cơ cấu dữ liệu logs trước khi phân tích hoặc khám phá quy trình.
    """
    # LOAD DATASET
    logs = pm4py.read_xes(path + filter_logs)
    print('Load clean dataset.')
    df_logs = pm4py.convert_to_dataframe(logs)
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

    return {
        "logs_name": filter_logs,
        "num_events": num_events,
        "num_activities": num_activities,
        "num_cases": num_cases,
        "num_variants": num_variants,
        "variants": variants,
        "average_activities_per_case": average_activities_per_case,
        "max_activities_per_case": max_activities_per_case,
        "min_activities_per_case": min_activities_per_case,
        "activities_frequency": activities_frequency
    }

#=================== PROCESS DISCOVERY ===================
def process_discovery(path, filter_logs_name):
    """
    Khám phá quy trình từ logs.

    Inputs:
        path (str): Đường dẫn folder chứa logs.
        filter_logs_name (str): Tên file xes đã được filter.
    
    Outputs:
        dict: Bao gồm BPMN model image, DFG tần suất và DFG hiệu năng.
        keys:
            - bpmn_model_image (str): Tên file hình ảnh BPMN.
            - dfg_freq (dict): DFG tần suất các activity.
            - dfg_discovery (dict): DFG thời gian trung bình giữa các activity (ngày).
    
    Purpose:
        Tạo mô hình BPMN và DFG để hình dung quy trình và hiệu năng thực tế.
    """
    # LOAD DATASET 
    logs = pm4py.read_xes(path + filter_logs_name)

    # DISCOVERY 
    tree = pm4py.discover_process_tree_inductive(logs)
    bpmn_graph = pm4py.convert_to_bpmn(tree)

    # SAVE BPMN IMAGE
    img_name = filter_logs_name.split(".")[0] + '_bpmn_model.png'
    gviz = bpmn_visualizer.apply(bpmn_graph)
    bpmn_visualizer.save(gviz, path + img_name)

    # DFG 
    dfg_freq = dfg_discovery.apply(logs, variant=dfg_discovery.Variants.FREQUENCY)
    dfg_perf = dfg_discovery.apply(logs, variant=dfg_discovery.Variants.PERFORMANCE)
    dfg_perf = {k: round(v / 86400, 2) for k, v in dfg_perf.items()}  # convert giây -> ngày

    return {
        "bpmn_model_image": img_name,
        "dfg_freq": dfg_freq,
        "dfg_discovery": dfg_perf
    }

#=================== PERFORMANCE ANALYSIS ===================
def performance_analysis(path, filter_logs_name):
    """
    Phân tích hiệu năng logs.

    Inputs:
        path (str): Đường dẫn folder chứa logs.
        filter_logs_name (str): Tên file xes đã được filter.
    
    Outputs:
        dict: Bao gồm các thông số hiệu năng.
        keys:
            - max_case_duration_days
            - mean_case_duration_days
            - min_case_duration_days
            - case_arrival_ratio_days
            - case_dispersion_ratio_days
    
    Purpose:
        Đánh giá thời gian thực hiện case, tốc độ xử lý và sự phân bố temporal của logs.
    """
    # LOAD DATASET 
    logs = pm4py.read_xes(path + filter_logs_name)

    # Get all case durations
    all_case_durations = pm4py.get_all_case_durations(logs)
    all_case_durations = [round(duration / (24 * 3600), 2) for duration in all_case_durations] 

    # Max duration
    max_case_duration = max(all_case_durations)

    # Mean duration
    mean_case_duration = round(np.mean(all_case_durations), 2)

    # Min duration
    min_case_duration = min(all_case_durations)

    # Case Arrival Ratio: Thời gian trung bình giữa 2 case liên tiếp nhau, tính bằng thời điểm bắt đầu của mỗi case. 
    # -> Mức độ thường xuyên hệ thống tiếp nhận case mới.
    case_arrival_ratio = pm4py.get_case_arrival_average(logs)
    case_arrival_ratio = round(case_arrival_ratio / (24 * 3600), 2)

    # Case Dispersion Ratio: Thời gian trung bình giữa thời điểm kết thúc của 2 case liên tiếp
    # -> Đánh giá tốc độ xử lí đầu ra.
    case_dispersion_ratio = round(case_arrival.get_case_dispersion_avg(logs, parameters={case_arrival.Parameters.TIMESTAMP_KEY: "time:timestamp"}) / (24 * 3600), 2)

    # Temporal Profile
    temporal_profile = temporal_profile_discovery.apply(logs)
    temporal_profile_days = {
        k: (round(v[0] / 86400, 2), round(v[1] / 86400, 2)) for k, v in temporal_profile.items()
    }
    return {
        "max_case_duration_days": max_case_duration,
        "mean_case_duration_days": mean_case_duration,
        "min_case_duration_days": min_case_duration,
        "case_arrival_ratio_days": case_arrival_ratio,
        "case_dispersion_ratio_days": case_dispersion_ratio,
    }

#=================== CONFORMANCE CHECKING ===================
def conformance_checking(path, filter_logs_name):
    """
    Kiểm tra mức độ tuân thủ quy trình và phát hiện các case không hợp lệ.

    Inputs:
        path (str): Đường dẫn folder chứa logs.
        filter_logs_name (str): Tên file xes đã được filter.
    
    Outputs:
        dict: Bao gồm các thông số tuân thủ và unwanted activities.
        keys:
            - num_cases
            - num_unfit_cases
            - unfit_cases_percentage
            - top_k_variants_used
            - coverage_top_k_variants
            - min_coverage_variant
            - unfit_dfg_freq
            - unfit_edges_with_count
            - unwanted_activity_stats
    
    Purpose:
        Phát hiện case không tuân thủ, phân tích top-k variants, và thống kê các activities không mong muốn.
    """
    # LOAD DATASET 
    logs = pm4py.read_xes(path + filter_logs_name)
    num_cases = len(logs)  # tổng số trace
    variants = variants_get.get_variants(logs)
    num_variants = len(variants)

    # TÍNH K VARIANTS 
    def get_k_variants(variants_with_frequency, num_cases, num_variants, min_k=10, coverage_threshold=0.85):
        coverage = 0
        k = 0
        min_coverage = 0

        if num_variants <= min_k:
            return num_variants, 1.0, 0
        else:
            for variant in variants_with_frequency:
                percentage = variant[1] / num_cases
                coverage += percentage
                k += 1
                if k > min_k and coverage >= coverage_threshold:
                    min_coverage = percentage
                    break
            return k, coverage, min_coverage

    variants_with_frequency = variants_get.get_variants_sorted_by_count(variants)
    k_variants, coverage_variants, min_coverage_variants = get_k_variants(variants_with_frequency, num_cases, num_variants)

    # FILTER TOP-K VARIANTS 
    filtered_logs = pm4py.filter_variants_top_k(logs, k_variants)

    # DISCOVER PETRI NET 
    net, initial_marking, final_marking = pm4py.discover_petri_net_inductive(filtered_logs)

    # TOKEN-BASED REPLAY 
    parameters_tbr = {
        token_based_replay.Variants.TOKEN_REPLAY.value.Parameters.DISABLE_VARIANTS: True,
        token_based_replay.Variants.TOKEN_REPLAY.value.Parameters.ENABLE_PLTR_FITNESS: True
    }

    replayed_traces, place_fitness, trans_fitness, unwanted_activities = token_based_replay.apply(
        logs, net, initial_marking, final_marking, parameters=parameters_tbr
    )

    # THỐNG KÊ CASE KHÔNG TUÂN THỦ 
    num_unfit_cases = sum(1 for t in replayed_traces if t["trace_fitness"] < 1.0)
    unfit_cases_percentage = round((num_unfit_cases / num_cases) * 100 if num_cases > 0 else 0, 2)

    # DFG FREQUENCY 
    dfg_freq_all = dfg_discovery.apply(logs, variant=dfg_discovery.Variants.FREQUENCY)

    # LOGS CÁC CASE KHÔNG TUÂN THỦ 
    list_trace_ids = logs['case:concept:name'].drop_duplicates().tolist()
    unfit_trace_indices = [i for i, t in enumerate(replayed_traces) if t["trace_fitness"] < 1.0]
    list_unfit_trace_ids = [list_trace_ids[i] for i in unfit_trace_indices]
    unfit_trace_logs = pm4py.filter_variants_top_k(logs, num_variants)  # có thể lọc logs theo list_unfit_trace_ids nếu muốn
    unfit_dfg_freq = dfg_discovery.apply(unfit_trace_logs, variant=dfg_discovery.Variants.FREQUENCY)
    unfit_edges_with_count = [
        (e, unfit_dfg_freq[e])
        for e in unfit_dfg_freq.keys()
        if e not in dfg_freq_all.keys()
    ]

    # UNWANTED ACTIVITIES 
    unwanted_activity_stats = []
    for name, traces in unwanted_activities.items():
        count = len(traces)
        percentage = round((count / num_cases) * 100 if num_cases > 0 else 0, 2)
        unwanted_activity_stats.append({
            "activity_name": name,
            "count": count,
            "percentage": percentage
        })

    return {
            "num_cases": num_cases,
            "num_unfit_cases": num_unfit_cases,
            "unfit_cases_percentage": unfit_cases_percentage,
            "top_k_variants_used": k_variants,
            "coverage_top_k_variants": coverage_variants,
            "min_coverage_variant": min_coverage_variants,
            "unfit_dfg_freq": unfit_dfg_freq,
            "unfit_edges_with_count": unfit_edges_with_count,
            "unwanted_activity_stats": unwanted_activity_stats,
        }

#=================== SIMULATOR ===================



