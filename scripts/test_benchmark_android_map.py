import unittest

from benchmark_android_map import percentile, summarize


class BenchmarkStatisticsTests(unittest.TestCase):
    def test_nearest_rank_uses_all_twenty_observed_samples(self):
        samples = list(range(20, 0, -1))
        self.assertEqual(percentile(samples, 0.5), 10)
        self.assertEqual(percentile(samples, 0.95), 19)
        self.assertEqual(samples[0], 20)

    def test_missing_samples_are_not_reported_as_zero_latency(self):
        self.assertEqual(summarize([])["count"], 0)
        self.assertIsNone(summarize([])["p50"])
        self.assertIsNone(summarize([])["p95"])

    def test_invalid_times_and_quantiles_fail(self):
        for samples, quantile in [([-1], 0.5), ([float("nan")], 0.5), ([float("inf")], 0.95), ([1], 0), ([1], 1.1)]:
            with self.assertRaises(ValueError):
                percentile(samples, quantile)


if __name__ == "__main__":
    unittest.main()
