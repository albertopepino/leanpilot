"""SPC Service — Pure-Python statistical process control calculations.

No external dependencies (no numpy/scipy). All formulas implemented from
standard SPC references (AIAG SPC Manual, Montgomery).
"""

import math
from typing import Optional

# ─── SPC Constants ───────────────────────────────────────────────────────────
# Tabulated constants for control charts (subgroup sizes 2-25)
# Source: AIAG SPC Reference Manual

# A2 constants for X-bar R chart
A2 = {
    2: 1.880, 3: 1.023, 4: 0.729, 5: 0.577,
    6: 0.483, 7: 0.419, 8: 0.373, 9: 0.337, 10: 0.308,
    11: 0.285, 12: 0.266, 13: 0.249, 14: 0.235, 15: 0.223,
    16: 0.212, 17: 0.203, 18: 0.194, 19: 0.187, 20: 0.180,
    21: 0.173, 22: 0.167, 23: 0.162, 24: 0.157, 25: 0.153,
}

# D3, D4 constants for R chart
D3 = {
    2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0,
    6: 0.0, 7: 0.076, 8: 0.136, 9: 0.184, 10: 0.223,
    11: 0.256, 12: 0.283, 13: 0.307, 14: 0.328, 15: 0.347,
    16: 0.363, 17: 0.378, 18: 0.391, 19: 0.403, 20: 0.415,
    21: 0.425, 22: 0.434, 23: 0.443, 24: 0.451, 25: 0.459,
}

D4 = {
    2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114,
    6: 2.004, 7: 1.924, 8: 1.864, 9: 1.816, 10: 1.777,
    11: 1.744, 12: 1.717, 13: 1.693, 14: 1.672, 15: 1.653,
    16: 1.636, 17: 1.621, 18: 1.608, 19: 1.597, 20: 1.585,
    21: 1.575, 22: 1.566, 23: 1.557, 24: 1.548, 25: 1.541,
}

# A3 constants for X-bar S chart
A3 = {
    2: 2.659, 3: 1.954, 4: 1.628, 5: 1.427,
    6: 1.287, 7: 1.182, 8: 1.099, 9: 1.032, 10: 0.975,
    11: 0.927, 12: 0.886, 13: 0.850, 14: 0.817, 15: 0.789,
    16: 0.763, 17: 0.739, 18: 0.718, 19: 0.698, 20: 0.680,
    21: 0.663, 22: 0.647, 23: 0.633, 24: 0.619, 25: 0.606,
}

# B3, B4 constants for S chart
B3 = {
    2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0,
    6: 0.030, 7: 0.118, 8: 0.185, 9: 0.239, 10: 0.284,
    11: 0.321, 12: 0.354, 13: 0.382, 14: 0.406, 15: 0.428,
    16: 0.448, 17: 0.466, 18: 0.482, 19: 0.497, 20: 0.510,
    21: 0.523, 22: 0.534, 23: 0.545, 24: 0.555, 25: 0.565,
}

B4 = {
    2: 3.267, 3: 2.568, 4: 2.266, 5: 2.089,
    6: 1.970, 7: 1.882, 8: 1.815, 9: 1.761, 10: 1.716,
    11: 1.679, 12: 1.646, 13: 1.618, 14: 1.594, 15: 1.572,
    16: 1.552, 17: 1.534, 18: 1.518, 19: 1.503, 20: 1.490,
    21: 1.477, 22: 1.466, 23: 1.455, 24: 1.445, 25: 1.435,
}

# d2 constants (for estimating sigma from R-bar)
d2 = {
    2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326,
    6: 2.534, 7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078,
    11: 3.173, 12: 3.258, 13: 3.336, 14: 3.407, 15: 3.472,
    16: 3.532, 17: 3.588, 18: 3.640, 19: 3.689, 20: 3.735,
    21: 3.778, 22: 3.819, 23: 3.858, 24: 3.895, 25: 3.931,
}

# c4 constants (for estimating sigma from S-bar)
c4 = {
    2: 0.7979, 3: 0.8862, 4: 0.9213, 5: 0.9400,
    6: 0.9515, 7: 0.9594, 8: 0.9650, 9: 0.9693, 10: 0.9727,
    11: 0.9754, 12: 0.9776, 13: 0.9794, 14: 0.9810, 15: 0.9823,
    16: 0.9835, 17: 0.9845, 18: 0.9854, 19: 0.9862, 20: 0.9869,
    21: 0.9876, 22: 0.9882, 23: 0.9887, 24: 0.9892, 25: 0.9896,
}


# ─── Helper Functions ────────────────────────────────────────────────────────


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _std_dev(values: list[float], ddof: int = 1) -> float:
    """Sample standard deviation."""
    n = len(values)
    if n <= ddof:
        return 0.0
    m = _mean(values)
    ss = sum((x - m) ** 2 for x in values)
    return math.sqrt(ss / (n - ddof))


def _range(values: list[float]) -> float:
    if not values:
        return 0.0
    return max(values) - min(values)


def _clamp_n(n: int) -> int:
    """Clamp subgroup size to valid range for constants tables."""
    return max(2, min(n, 25))


# ─── Western Electric Rules ─────────────────────────────────────────────────


def detect_western_electric_violations(
    values: list[float],
    cl: float,
    ucl: float,
    lcl: float,
) -> list[dict]:
    """
    Detect Western Electric (WECO) rule violations:
    Rule 1: One point beyond 3-sigma (UCL/LCL)
    Rule 2: Nine consecutive points on same side of center line
    Rule 3: Six consecutive points steadily increasing or decreasing
    Rule 4: Fourteen consecutive points alternating up and down
    """
    violations: list[dict] = []
    n = len(values)

    # Rule 1: Beyond 3-sigma
    for i, v in enumerate(values):
        if v > ucl or v < lcl:
            violations.append({
                "rule": 1,
                "rule_name": "Beyond 3-sigma",
                "point_index": i,
                "subgroup_index": i,
                "value": round(v, 6),
            })

    # Rule 2: Nine consecutive on same side
    if n >= 9:
        for i in range(n - 8):
            segment = values[i:i + 9]
            above = all(v > cl for v in segment)
            below = all(v < cl for v in segment)
            if above or below:
                violations.append({
                    "rule": 2,
                    "rule_name": "9 consecutive same side",
                    "point_index": i + 8,
                    "subgroup_index": i + 8,
                    "value": round(values[i + 8], 6),
                })

    # Rule 3: Six consecutive increasing or decreasing
    if n >= 6:
        for i in range(n - 5):
            segment = values[i:i + 6]
            increasing = all(segment[j + 1] > segment[j] for j in range(5))
            decreasing = all(segment[j + 1] < segment[j] for j in range(5))
            if increasing or decreasing:
                violations.append({
                    "rule": 3,
                    "rule_name": "6 consecutive trend",
                    "point_index": i + 5,
                    "subgroup_index": i + 5,
                    "value": round(values[i + 5], 6),
                })

    # Rule 4: Fourteen consecutive alternating
    if n >= 14:
        for i in range(n - 13):
            segment = values[i:i + 14]
            alternating = True
            for j in range(12):
                d1 = segment[j + 1] - segment[j]
                d2 = segment[j + 2] - segment[j + 1]
                if d1 * d2 >= 0:  # same direction = not alternating
                    alternating = False
                    break
            if alternating:
                violations.append({
                    "rule": 4,
                    "rule_name": "14 alternating",
                    "point_index": i + 13,
                    "subgroup_index": i + 13,
                    "value": round(values[i + 13], 6),
                })

    # Deduplicate by (rule, point_index)
    seen = set()
    unique = []
    for v in violations:
        key = (v["rule"], v["point_index"])
        if key not in seen:
            seen.add(key)
            unique.append(v)

    return unique


# ─── Chart Calculations ─────────────────────────────────────────────────────


def calculate_xbar_r(
    subgroups: list[list[float]],
    n: int,
) -> dict:
    """X-bar R chart: means and ranges."""
    n_clamped = _clamp_n(n)
    xbars = [_mean(sg) for sg in subgroups]
    ranges = [_range(sg) for sg in subgroups]

    xbar_bar = _mean(xbars)
    r_bar = _mean(ranges)

    a2 = A2.get(n_clamped, 0.577)
    d3_val = D3.get(n_clamped, 0.0)
    d4_val = D4.get(n_clamped, 2.114)

    xbar_ucl = xbar_bar + a2 * r_bar
    xbar_lcl = xbar_bar - a2 * r_bar

    r_ucl = d4_val * r_bar
    r_lcl = d3_val * r_bar

    xbar_violations = detect_western_electric_violations(xbars, xbar_bar, xbar_ucl, xbar_lcl)
    r_violations = detect_western_electric_violations(ranges, r_bar, r_ucl, r_lcl)

    # Estimate sigma from R-bar
    d2_val = d2.get(n_clamped, 2.326)
    sigma_est = r_bar / d2_val if d2_val > 0 else 0.0

    return {
        "charts": [
            {
                "chart_label": "X-bar",
                "values": [round(v, 6) for v in xbars],
                "control_limits": {"ucl": round(xbar_ucl, 6), "cl": round(xbar_bar, 6), "lcl": round(xbar_lcl, 6)},
                "violations": xbar_violations,
            },
            {
                "chart_label": "R",
                "values": [round(v, 6) for v in ranges],
                "control_limits": {"ucl": round(r_ucl, 6), "cl": round(r_bar, 6), "lcl": round(r_lcl, 6)},
                "violations": r_violations,
            },
        ],
        "sigma_est": sigma_est,
        "mean": xbar_bar,
    }


def calculate_xbar_s(
    subgroups: list[list[float]],
    n: int,
) -> dict:
    """X-bar S chart: means and standard deviations."""
    n_clamped = _clamp_n(n)
    xbars = [_mean(sg) for sg in subgroups]
    stds = [_std_dev(sg, ddof=1) for sg in subgroups]

    xbar_bar = _mean(xbars)
    s_bar = _mean(stds)

    a3_val = A3.get(n_clamped, 1.427)
    b3_val = B3.get(n_clamped, 0.0)
    b4_val = B4.get(n_clamped, 2.089)

    xbar_ucl = xbar_bar + a3_val * s_bar
    xbar_lcl = xbar_bar - a3_val * s_bar

    s_ucl = b4_val * s_bar
    s_lcl = b3_val * s_bar

    xbar_violations = detect_western_electric_violations(xbars, xbar_bar, xbar_ucl, xbar_lcl)
    s_violations = detect_western_electric_violations(stds, s_bar, s_ucl, s_lcl)

    # Estimate sigma from S-bar
    c4_val = c4.get(n_clamped, 0.9400)
    sigma_est = s_bar / c4_val if c4_val > 0 else 0.0

    return {
        "charts": [
            {
                "chart_label": "X-bar",
                "values": [round(v, 6) for v in xbars],
                "control_limits": {"ucl": round(xbar_ucl, 6), "cl": round(xbar_bar, 6), "lcl": round(xbar_lcl, 6)},
                "violations": xbar_violations,
            },
            {
                "chart_label": "S",
                "values": [round(v, 6) for v in stds],
                "control_limits": {"ucl": round(s_ucl, 6), "cl": round(s_bar, 6), "lcl": round(s_lcl, 6)},
                "violations": s_violations,
            },
        ],
        "sigma_est": sigma_est,
        "mean": xbar_bar,
    }


def calculate_p_chart(
    defectives: list[float],
    sample_sizes: list[int],
) -> dict:
    """p-chart: proportion defective."""
    k = len(defectives)
    proportions = [
        d / n if n > 0 else 0.0
        for d, n in zip(defectives, sample_sizes)
    ]
    total_defective = sum(defectives)
    total_inspected = sum(sample_sizes)
    p_bar = total_defective / total_inspected if total_inspected > 0 else 0.0

    n_bar = _mean([float(n) for n in sample_sizes])
    ucl = p_bar + 3 * math.sqrt(p_bar * (1 - p_bar) / n_bar) if n_bar > 0 and p_bar < 1 else p_bar
    lcl = max(0.0, p_bar - 3 * math.sqrt(p_bar * (1 - p_bar) / n_bar)) if n_bar > 0 and p_bar < 1 else 0.0

    violations = detect_western_electric_violations(proportions, p_bar, ucl, lcl)

    # Sigma estimate for capability
    sigma_est = math.sqrt(p_bar * (1 - p_bar)) if p_bar < 1 else 0.0

    return {
        "charts": [
            {
                "chart_label": "p",
                "values": [round(v, 6) for v in proportions],
                "control_limits": {"ucl": round(ucl, 6), "cl": round(p_bar, 6), "lcl": round(lcl, 6)},
                "violations": violations,
            },
        ],
        "sigma_est": sigma_est,
        "mean": p_bar,
    }


def calculate_np_chart(
    defectives: list[float],
    sample_size: int,
) -> dict:
    """np-chart: number defective (constant sample size)."""
    k = len(defectives)
    total_defective = sum(defectives)
    n = sample_size
    np_bar = total_defective / k if k > 0 else 0.0
    p_bar = np_bar / n if n > 0 else 0.0

    ucl = np_bar + 3 * math.sqrt(np_bar * (1 - p_bar)) if p_bar < 1 else np_bar
    lcl = max(0.0, np_bar - 3 * math.sqrt(np_bar * (1 - p_bar))) if p_bar < 1 else 0.0

    violations = detect_western_electric_violations(defectives, np_bar, ucl, lcl)

    sigma_est = math.sqrt(np_bar * (1 - p_bar)) if p_bar < 1 else 0.0

    return {
        "charts": [
            {
                "chart_label": "np",
                "values": [round(v, 6) for v in defectives],
                "control_limits": {"ucl": round(ucl, 6), "cl": round(np_bar, 6), "lcl": round(lcl, 6)},
                "violations": violations,
            },
        ],
        "sigma_est": sigma_est,
        "mean": np_bar,
    }


def calculate_c_chart(
    defect_counts: list[float],
) -> dict:
    """c-chart: count of defects per unit (constant opportunity)."""
    k = len(defect_counts)
    c_bar = _mean(defect_counts)

    ucl = c_bar + 3 * math.sqrt(c_bar) if c_bar > 0 else 0.0
    lcl = max(0.0, c_bar - 3 * math.sqrt(c_bar)) if c_bar > 0 else 0.0

    violations = detect_western_electric_violations(defect_counts, c_bar, ucl, lcl)

    sigma_est = math.sqrt(c_bar) if c_bar > 0 else 0.0

    return {
        "charts": [
            {
                "chart_label": "c",
                "values": [round(v, 6) for v in defect_counts],
                "control_limits": {"ucl": round(ucl, 6), "cl": round(c_bar, 6), "lcl": round(lcl, 6)},
                "violations": violations,
            },
        ],
        "sigma_est": sigma_est,
        "mean": c_bar,
    }


def calculate_u_chart(
    defect_counts: list[float],
    sample_sizes: list[int],
) -> dict:
    """u-chart: defects per unit (variable sample size)."""
    rates = [
        c / n if n > 0 else 0.0
        for c, n in zip(defect_counts, sample_sizes)
    ]
    total_defects = sum(defect_counts)
    total_units = sum(sample_sizes)
    u_bar = total_defects / total_units if total_units > 0 else 0.0

    n_bar = _mean([float(n) for n in sample_sizes])
    ucl = u_bar + 3 * math.sqrt(u_bar / n_bar) if n_bar > 0 and u_bar > 0 else u_bar
    lcl = max(0.0, u_bar - 3 * math.sqrt(u_bar / n_bar)) if n_bar > 0 and u_bar > 0 else 0.0

    violations = detect_western_electric_violations(rates, u_bar, ucl, lcl)

    sigma_est = math.sqrt(u_bar) if u_bar > 0 else 0.0

    return {
        "charts": [
            {
                "chart_label": "u",
                "values": [round(v, 6) for v in rates],
                "control_limits": {"ucl": round(ucl, 6), "cl": round(u_bar, 6), "lcl": round(lcl, 6)},
                "violations": violations,
            },
        ],
        "sigma_est": sigma_est,
        "mean": u_bar,
    }


# ─── Process Capability ─────────────────────────────────────────────────────


def calculate_capability(
    mean: float,
    sigma: float,
    usl: Optional[float],
    lsl: Optional[float],
    all_values: list[float] | None = None,
) -> dict | None:
    """Calculate Cp, Cpk, Pp, Ppk."""
    if usl is None and lsl is None:
        return None
    if sigma <= 0:
        return {
            "cp": None, "cpk": None, "pp": None, "ppk": None,
            "sigma_level": None,
            "mean": round(mean, 6),
            "std_dev": 0.0,
            "usl": usl, "lsl": lsl,
        }

    cp = cpk = pp = ppk = sigma_level = None

    # Short-term (within-subgroup) Cp, Cpk
    if usl is not None and lsl is not None:
        cp = (usl - lsl) / (6 * sigma)
    if usl is not None:
        cpu = (usl - mean) / (3 * sigma)
    else:
        cpu = None
    if lsl is not None:
        cpl = (mean - lsl) / (3 * sigma)
    else:
        cpl = None

    if cpu is not None and cpl is not None:
        cpk = min(cpu, cpl)
    elif cpu is not None:
        cpk = cpu
    elif cpl is not None:
        cpk = cpl

    # Long-term (overall) Pp, Ppk using overall std dev
    if all_values and len(all_values) > 1:
        overall_sigma = _std_dev(all_values, ddof=1)
        if overall_sigma > 0:
            if usl is not None and lsl is not None:
                pp = (usl - lsl) / (6 * overall_sigma)
            ppu = (usl - mean) / (3 * overall_sigma) if usl is not None else None
            ppl = (mean - lsl) / (3 * overall_sigma) if lsl is not None else None
            if ppu is not None and ppl is not None:
                ppk = min(ppu, ppl)
            elif ppu is not None:
                ppk = ppu
            elif ppl is not None:
                ppk = ppl

    # Sigma level (Z-score)
    if cpk is not None:
        sigma_level = cpk * 3  # Z = Cpk * 3

    return {
        "cp": round(cp, 4) if cp is not None else None,
        "cpk": round(cpk, 4) if cpk is not None else None,
        "pp": round(pp, 4) if pp is not None else None,
        "ppk": round(ppk, 4) if ppk is not None else None,
        "sigma_level": round(sigma_level, 2) if sigma_level is not None else None,
        "mean": round(mean, 6),
        "std_dev": round(sigma, 6),
        "usl": usl,
        "lsl": lsl,
    }


# ─── Main Calculation Dispatcher ────────────────────────────────────────────


def calculate_spc(
    chart_type: str,
    measurements: list[list[float]],
    subgroup_size: int = 5,
    usl: Optional[float] = None,
    lsl: Optional[float] = None,
    sample_sizes: Optional[list[int]] = None,
) -> dict:
    """
    Main entry point: calculate SPC charts, control limits, WECO violations,
    and process capability.
    """
    k = len(measurements)
    n = subgroup_size

    if chart_type == "xbar_r":
        result = calculate_xbar_r(measurements, n)
    elif chart_type == "xbar_s":
        result = calculate_xbar_s(measurements, n)
    elif chart_type == "p":
        # measurements = [[defectives_count]] per subgroup
        defectives = [sg[0] if sg else 0 for sg in measurements]
        sizes = sample_sizes or [n] * k
        result = calculate_p_chart(defectives, sizes)
    elif chart_type == "np":
        defectives = [sg[0] if sg else 0 for sg in measurements]
        result = calculate_np_chart(defectives, n)
    elif chart_type == "c":
        counts = [sg[0] if sg else 0 for sg in measurements]
        result = calculate_c_chart(counts)
    elif chart_type == "u":
        counts = [sg[0] if sg else 0 for sg in measurements]
        sizes = sample_sizes or [n] * k
        result = calculate_u_chart(counts, sizes)
    else:
        raise ValueError(f"Unknown chart type: {chart_type}")

    # Flatten all values for capability
    all_values = []
    for sg in measurements:
        all_values.extend(sg)

    # Capability (only meaningful for variable data charts)
    capability = None
    if chart_type in ("xbar_r", "xbar_s") and (usl is not None or lsl is not None):
        capability = calculate_capability(
            mean=result["mean"],
            sigma=result["sigma_est"],
            usl=usl,
            lsl=lsl,
            all_values=all_values,
        )

    # Count violations across all chart panels
    total_violations = set()
    for chart in result["charts"]:
        for v in chart["violations"]:
            total_violations.add(v["point_index"])

    pct_in_control = ((k - len(total_violations)) / k * 100) if k > 0 else 100.0

    return {
        "chart_type": chart_type,
        "subgroup_size": n,
        "total_subgroups": k,
        "charts": result["charts"],
        "capability": capability,
        "pct_in_control": round(pct_in_control, 2),
    }
