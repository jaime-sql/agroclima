export type RiskLevel = "bajo" | "medio" | "alto";

export type DayForecast = {
  date: string;
  humidityPct: number;
  rainMm: number;
  tempC: number;
};

export type DayRisk = {
  date: string;
  level: RiskLevel;
  reasons: string[];
};
