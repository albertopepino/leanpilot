"""
Tests for OEE (Overall Equipment Effectiveness) calculation.

The OEE formula is:
    OEE = Availability x Performance x Quality

Where:
    Availability = Run Time / Planned Time
    Performance  = Total Pieces / Max Possible Pieces
                   (Max Possible Pieces = Run Time * 60 / Ideal Cycle Time)
    Quality      = Good Pieces / Total Pieces

All values returned as percentages (0-100), OEE as (A*P*Q)/10000.
"""
import pytest
from app.services.oee_calculator import OEECalculator


# ---------------------------------------------------------------------------
# Markers
# ---------------------------------------------------------------------------
pytestmark = [pytest.mark.unit, pytest.mark.oee]


# ---------------------------------------------------------------------------
# Perfect OEE (100%)
# ---------------------------------------------------------------------------
class TestPerfectOEE:
    """All components at 100 %."""

    def test_perfect_oee(self):
        """When run_time == planned_time, all pieces are good, and production
        exactly matches ideal cycle time, OEE should be 100 %."""
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=480,
            total_pieces=4800,
            good_pieces=4800,
            ideal_cycle_time_sec=6.0,  # 480 min * 60 / 6 sec = 4800 pieces
        )
        assert result["availability"] == 100.0
        assert result["performance"] == 100.0
        assert result["quality"] == 100.0
        assert result["oee"] == 100.0

    def test_perfect_returns_dict_keys(self):
        result = OEECalculator.calculate_oee(480, 480, 4800, 4800, 6.0)
        assert set(result.keys()) == {"availability", "performance", "quality", "oee"}


# ---------------------------------------------------------------------------
# Realistic scenario (~65 % OEE — world-class benchmark is 85 %)
# ---------------------------------------------------------------------------
class TestRealisticOEE:
    """Typical factory scenario with some downtime, speed losses, and scrap."""

    def test_realistic_scenario(self):
        # Planned: 480 min, ran 420 min (60 min downtime)
        # Ideal cycle 6 sec => max possible in 420 min = 420*60/6 = 4200
        # Actually produced 3500, of which 3200 good
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=420,
            total_pieces=3500,
            good_pieces=3200,
            ideal_cycle_time_sec=6.0,
        )
        # Availability = 420/480 = 87.5 %
        assert result["availability"] == 87.5
        # Performance = 3500/4200 = 83.33 %
        assert result["performance"] == pytest.approx(83.33, abs=0.01)
        # Quality = 3200/3500 = 91.43 %
        assert result["quality"] == pytest.approx(91.43, abs=0.01)
        # OEE = (87.5 * 83.33 * 91.43) / 10000 ≈ 66.63
        assert result["oee"] == pytest.approx(66.63, abs=0.1)

    def test_oee_always_less_than_or_equal_to_min_component(self):
        """OEE can never exceed the lowest individual component."""
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=420,
            total_pieces=3500,
            good_pieces=3200,
            ideal_cycle_time_sec=6.0,
        )
        min_component = min(
            result["availability"], result["performance"], result["quality"]
        )
        assert result["oee"] <= min_component

    def test_high_availability_low_quality(self):
        """Machine runs all shift, but scrap rate is terrible."""
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=480,
            total_pieces=4800,
            good_pieces=2400,  # 50 % quality
            ideal_cycle_time_sec=6.0,
        )
        assert result["availability"] == 100.0
        assert result["performance"] == 100.0
        assert result["quality"] == 50.0
        assert result["oee"] == 50.0

    def test_low_availability_high_quality(self):
        """Machine ran half the planned time but everything produced was good."""
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=240,
            total_pieces=2400,
            good_pieces=2400,
            ideal_cycle_time_sec=6.0,
        )
        assert result["availability"] == 50.0
        assert result["performance"] == 100.0
        assert result["quality"] == 100.0
        assert result["oee"] == 50.0


# ---------------------------------------------------------------------------
# Edge cases: zero values
# ---------------------------------------------------------------------------
class TestZeroEdgeCases:
    """Boundary conditions where one or more inputs are zero."""

    def test_zero_planned_time_returns_all_zeros(self):
        """Division by zero guard: planned_time_min <= 0."""
        result = OEECalculator.calculate_oee(
            planned_time_min=0,
            run_time_min=0,
            total_pieces=0,
            good_pieces=0,
            ideal_cycle_time_sec=6.0,
        )
        assert result == {"availability": 0, "performance": 0, "quality": 0, "oee": 0}

    def test_negative_planned_time_returns_all_zeros(self):
        result = OEECalculator.calculate_oee(
            planned_time_min=-100,
            run_time_min=50,
            total_pieces=100,
            good_pieces=90,
            ideal_cycle_time_sec=6.0,
        )
        assert result["oee"] == 0

    def test_zero_total_pieces(self):
        """Machine ran but produced nothing."""
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=480,
            total_pieces=0,
            good_pieces=0,
            ideal_cycle_time_sec=6.0,
        )
        # Availability = 100 %, Performance = 0 % (0 / 4800), Quality = 0 %
        assert result["availability"] == 100.0
        assert result["performance"] == 0
        assert result["quality"] == 0
        assert result["oee"] == 0

    def test_zero_good_pieces(self):
        """Produced pieces but every single one was scrap."""
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=480,
            total_pieces=1000,
            good_pieces=0,
            ideal_cycle_time_sec=6.0,
        )
        assert result["quality"] == 0
        assert result["oee"] == 0

    def test_zero_run_time(self):
        """Planned production but machine never ran."""
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=0,
            total_pieces=0,
            good_pieces=0,
            ideal_cycle_time_sec=6.0,
        )
        assert result["availability"] == 0
        assert result["oee"] == 0

    def test_zero_ideal_cycle_time(self):
        """Ideal cycle time is zero — performance cannot be computed."""
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=480,
            total_pieces=1000,
            good_pieces=900,
            ideal_cycle_time_sec=0,
        )
        assert result["performance"] == 0
        assert result["oee"] == 0


# ---------------------------------------------------------------------------
# Rounding
# ---------------------------------------------------------------------------
class TestRounding:
    """Verify that results are rounded to 2 decimal places."""

    def test_values_rounded_to_two_decimals(self):
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=333,
            total_pieces=2777,
            good_pieces=2501,
            ideal_cycle_time_sec=7.3,
        )
        for key in ("availability", "performance", "quality", "oee"):
            value_str = str(result[key])
            if "." in value_str:
                decimals = len(value_str.split(".")[1])
                assert decimals <= 2, f"{key}={result[key]} has more than 2 decimals"


# ---------------------------------------------------------------------------
# Over-performance (machine faster than ideal)
# ---------------------------------------------------------------------------
class TestOverPerformance:
    """Performance > 100 % when machine runs faster than ideal cycle time."""

    def test_over_performance(self):
        # Ideal: 6 sec/piece => max in 480 min = 4800
        # Actual produced: 5500 (faster than ideal)
        result = OEECalculator.calculate_oee(
            planned_time_min=480,
            run_time_min=480,
            total_pieces=5500,
            good_pieces=5500,
            ideal_cycle_time_sec=6.0,
        )
        assert result["performance"] > 100.0
        assert result["oee"] > 100.0  # Mathematically possible though unusual
