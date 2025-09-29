from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional, Union

import google.generativeai as genai
import numpy as np
import pandas as pd
import pm4py
from dateutil import parser
from openai import OpenAI

from pm4py.algo.conformance.tokenreplay import algorithm as token_based_replay
from pm4py.algo.discovery.dfg import algorithm as dfg_discovery
from pm4py.algo.discovery.temporal_profile import algorithm as temporal_profile_discovery
from pm4py.statistics.end_activities.log import get as end_activities_get
from pm4py.statistics.start_activities.log import get as start_activities_get
from pm4py.statistics.traces.generic.log import case_arrival
from pm4py.statistics.traces.generic.pandas import case_statistics
from pm4py.statistics.variants.log import get as variants_get
from pm4py.visualization.bpmn import visualizer as bpmn_visualizer
from pm4py.visualization.dfg import visualizer as dfg_visualization
from pm4py.visualization.dotted_chart import visualizer as dotted_chart_visualizer
from pm4py.visualization.heuristics_net import visualizer as hn_visualizer
from pm4py.visualization.petri_net import visualizer as petri_net_visualizer

from chatbot.dataset_context import get_dataset_context


def _dataset_dir(path: Optional[str] = None) -> Path:
    ctx = get_dataset_context()
    artefacts = getattr(ctx, "artefacts", None) if ctx else None
    if artefacts is not None:
        base = Path(artefacts.local_dir)
        base.mkdir(parents=True, exist_ok=True)
        return base
    if path:
        base = Path(path)
        base.mkdir(parents=True, exist_ok=True)
        return base
    return Path.cwd()


def _ensure_report() -> Optional[dict]:
    ctx = get_dataset_context()
    artefacts = getattr(ctx, "artefacts", None) if ctx else None
    if artefacts is not None:
        return artefacts.report
    return None


def _ensure_logs_path(base_dir: Path, logs_name: str) -> Path:
    ctx = get_dataset_context()
    artefacts = getattr(ctx, "artefacts", None) if ctx else None
    if artefacts is not None:
        for candidate in (logs_name,):
            try:
                return artefacts.ensure_local_file(candidate, file_type="log_cleaned")
            except FileNotFoundError:
                try:
                    return artefacts.ensure_local_file(candidate, file_type="log_raw")
                except FileNotFoundError:
                    continue
    path = base_dir / logs_name
    if not path.exists():
        raise FileNotFoundError(f"Log file not found: {path}")
    return path


def _register_generated_file(path: Path) -> None:
    ctx = get_dataset_context()
    artefacts = getattr(ctx, "artefacts", None) if ctx else None
    if artefacts is not None:
        artefacts.register_local_file(path)


# =================== FILTER LOGS WITH TIME RANGE ===================

def check_exist_logs(path, logs_name, start_time, end_time):
    """Check if a time-filtered log already exists."""

    base_dir = _dataset_dir(path)
    start_str = re.sub(r"[: ]", "-", start_time)
    end_str = re.sub(r"[: ]", "-", end_time)
    file_name = f"{start_str}__{end_str}.xes"
    out_path = base_dir / file_name
    return out_path.exists()


def get_logs(path, logs_name, start_time, end_time):
    """Fetch logs for the dataset and optionally filter by time range."""

    base_dir = _dataset_dir(path)
    try:
        logs_path = _ensure_logs_path(base_dir, logs_name)
    except FileNotFoundError as exc:
        raise ValueError(str(exc)) from exc

    try:
        if start_time == "NULL" or end_time == "NULL":
            return pm4py.read_xes(str(logs_path))

        start_dt = parser.parse(start_time).replace(tzinfo=None)
        end_dt = parser.parse(end_time).replace(tzinfo=None)
        if start_dt >= end_dt:
            raise ValueError("Start time must be smaller than End time.")

        report_data = _ensure_report()
        if report_data is None:
            report_path = base_dir / "report.json"
            with report_path.open("r", encoding="utf-8") as f_report:
                report_data = json.load(f_report)

        dataset_range = report_data.get("dataset_overview", {}).get("date_range", {})
        min_dt = parser.parse(dataset_range.get("start_time"))
        max_dt = parser.parse(dataset_range.get("end_time"))
        min_dt = min_dt.replace(tzinfo=None)
        max_dt = max_dt.replace(tzinfo=None)
        if start_dt < min_dt or end_dt > max_dt:
            raise ValueError("Range time to filter is out of event logs.")

        logs = pm4py.read_xes(str(logs_path))
        filter_logs = pm4py.filter_time_range(
            logs, start_dt, end_dt, mode="traces_intersecting"
        )

        start_str = re.sub(r"[: ]", "-", start_time)
        end_str = re.sub(r"[: ]", "-", end_time)
        file_name = f"{start_str}__{end_str}.xes"
        out_path = base_dir / file_name
        pm4py.write_xes(filter_logs, str(out_path))
        _register_generated_file(out_path)
        return True

    except Exception as exc:  # noqa: BLE001
        raise exc


# =================== BASIC STATISTICS ===================

def _load_event_log(filter_logs: Union[str, object], base_dir: Path):
    if isinstance(filter_logs, str):
        target = base_dir / filter_logs
        if not target.exists():
            raise FileNotFoundError(f"Filtered log not found: {target}")
        return pm4py.read_xes(str(target))
    return filter_logs


def basic_statistics(path, filter_logs):
    """Compute basic statistics of the event log."""

    base_dir = _dataset_dir(path)
    logs = _load_event_log(filter_logs, base_dir)
    print("Load clean dataset.")
    df_logs = pm4py.convert_to_dataframe(logs)
    num_events = df_logs.shape[0]
    num_activities = df_logs['concept:name'].nunique()
    num_cases = df_logs['case:concept:name'].nunique()
    variants = variants_get.get_variants(df_logs)
    num_variants = len(variants)

    activities_per_case = df_logs.groupby("case:concept:name")["concept:name"].nunique()
    average_activities_per_case = round(activities_per_case.mean())
    max_activities_per_case = activities_per_case.max()
    min_activities_per_case = activities_per_case.min()

    unique_case_activities = df_logs[['case:concept:name', 'concept:name']].drop_duplicates()
    activities_frequency = unique_case_activities['concept:name'].value_counts().reset_index()

    return {
        "logs_name": getattr(filter_logs, "name", ""),
        "num_events": num_events,
        "num_activities": num_activities,
        "num_cases": num_cases,
        "num_variants": num_variants,
        "variants": variants,
        "average_activities_per_case": average_activities_per_case,
        "max_activities_per_case": max_activities_per_case,
        "min_activities_per_case": min_activities_per_case,
        "activities_frequency": activities_frequency,
    }


# =================== PROCESS DISCOVERY ===================

def process_discovery(path, filter_logs_name):
    """Run process discovery on the event log."""

    base_dir = _dataset_dir(path)
    log_path = base_dir / filter_logs_name
    logs = pm4py.read_xes(str(log_path))

    tree = pm4py.discover_process_tree_inductive(logs)
    bpmn_graph = pm4py.convert_to_bpmn(tree)

    img_name = filter_logs_name.split('.')[0] + '_bpmn_model.png'
    gviz = bpmn_visualizer.apply(bpmn_graph)
    output_path = base_dir / img_name
    bpmn_visualizer.save(gviz, str(output_path))
    _register_generated_file(output_path)

    dfg_freq = dfg_discovery.apply(logs, variant=dfg_discovery.Variants.FREQUENCY)
    dfg_perf = dfg_discovery.apply(logs, variant=dfg_discovery.Variants.PERFORMANCE)
    dfg_perf = {k: round(v / 86400, 2) for k, v in dfg_perf.items()}

    return {
        "bpmn_model_image": img_name,
        "dfg_freq": dfg_freq,
        "dfg_discovery": dfg_perf,
    }


# =================== PERFORMANCE ANALYSIS ===================

def performance_analysis(path, filter_logs_name):
    """Analyse performance metrics for the event log."""

    base_dir = _dataset_dir(path)
    log_path = base_dir / filter_logs_name
    logs = pm4py.read_xes(str(log_path))

    all_case_durations = pm4py.get_all_case_durations(logs)
    all_case_durations = [round(duration / (24 * 3600), 2) for duration in all_case_durations]

    max_case_duration = max(all_case_durations)
    mean_case_duration = round(np.mean(all_case_durations), 2)
    min_case_duration = min(all_case_durations)

    case_arrival_ratio = pm4py.get_case_arrival_average(logs)
    case_arrival_ratio = round(case_arrival_ratio / (24 * 3600), 2)

    case_dispersion_ratio = round(
        case_arrival.get_case_dispersion_avg(
            logs, parameters={case_arrival.Parameters.TIMESTAMP_KEY: "time:timestamp"}
        ) / (24 * 3600),
        2,
    )

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
        "temporal_profile_days": temporal_profile_days,
    }


# =================== CONFORMANCE CHECKING ===================

def conformance_checking(path, filter_logs_name):
    """Evaluate conformance of the event log against the discovered model."""

    base_dir = _dataset_dir(path)
    log_path = base_dir / filter_logs_name
    logs = pm4py.read_xes(str(log_path))
    num_cases = len(logs)
    variants = variants_get.get_variants(logs)
    num_variants = len(variants)

    def get_k_variants(variants_with_frequency, num_cases, num_variants, min_k=10, coverage_threshold=0.85):
        coverage = 0
        k = 0
        min_coverage = 0
        if num_variants <= min_k:
            return num_variants, 1.0, 0
        for variant in variants_with_frequency:
            percentage = variant[1] / num_cases
            coverage += percentage
            k += 1
            if k > min_k and coverage >= coverage_threshold:
                min_coverage = percentage
                break
        return k, coverage, min_coverage

    variants_with_frequency = variants_get.get_variants_sorted_by_count(variants)
    k_variants, coverage_variants, min_coverage_variants = get_k_variants(
        variants_with_frequency, num_cases, num_variants
    )

    filtered_logs = pm4py.filter_variants_top_k(logs, k_variants)
    net, initial_marking, final_marking = pm4py.discover_petri_net_inductive(filtered_logs)

    parameters_tbr = {
        token_based_replay.Variants.TOKEN_REPLAY.value.Parameters.DISABLE_VARIANTS: True,
        token_based_replay.Variants.TOKEN_REPLAY.value.Parameters.ENABLE_PLTR_FITNESS: True,
    }

    replayed_traces, place_fitness, trans_fitness, unwanted_activities = token_based_replay.apply(
        logs, net, initial_marking, final_marking, parameters=parameters_tbr
    )

    num_unfit_cases = sum(1 for t in replayed_traces if t["trace_fitness"] < 1.0)
    unfit_cases_percentage = round((num_unfit_cases / num_cases) * 100 if num_cases > 0 else 0, 2)

    dfg_freq_all = dfg_discovery.apply(logs, variant=dfg_discovery.Variants.FREQUENCY)

    list_trace_ids = logs['case:concept:name'].drop_duplicates().tolist()
    unfit_trace_indices = [i for i, t in enumerate(replayed_traces) if t["trace_fitness"] < 1.0]
    list_unfit_trace_ids = [list_trace_ids[i] for i in unfit_trace_indices]
    unfit_trace_logs = pm4py.filter_variants_top_k(logs, num_variants)
    unfit_dfg_freq = dfg_discovery.apply(unfit_trace_logs, variant=dfg_discovery.Variants.FREQUENCY)
    unfit_edges_with_count = [
        (edge, unfit_dfg_freq[edge])
        for edge in unfit_dfg_freq.keys()
        if edge not in dfg_freq_all.keys()
    ]

    unwanted_activity_stats = []
    for name, traces in unwanted_activities.items():
        count = len(traces)
        percentage = round((count / num_cases) * 100 if num_cases > 0 else 0, 2)
        unwanted_activity_stats.append(
            {
                "activity_name": name,
                "count": count,
                "percentage": percentage,
            }
        )

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


# =================== SIMULATOR ===================
