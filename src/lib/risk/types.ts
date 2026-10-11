export type RiskLevel = "bajo" | "medio" | "alto";

/** Parsed Open-Meteo `/v1/forecast` fields used by the rust rules. */
export type OpenMeteoHourly = {
  time: string[];
  temperature_2m: Array<number | null>;
  relative_humidity_2m: Array<number | null>;
  precipitation: Array<number | null>;
  precipitation_probability: Array<number | null>;
};

export type OpenMeteoDaily = {
  time: string[];
  temperature_2m_max: Array<number | null>;
  temperature_2m_min: Array<number | null>;
  precipitation_sum: Array<number | null>;
  precipitation_hours: Array<number | null>;
  precipitation_probability_max: Array<number | null>;
};

export type OpenMeteoForecast = {
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
};

export type DayAssessment = {
  date: string;
  level: RiskLevel;
  reason: string;
  score: number;
  wetHours: number;
  warmWetHours: number;
  optWetHours: number;
  rainDay: boolean;
  latencyBand: boolean;
  consecutiveBonus: boolean;
};

export type SprayWindow = {
  start: string;
  end: string;
};

export type ActionPlan = {
  fungicideClasses: string[];
  doseNote: string;
  nextDryWindow: SprayWindow | null;
};

export type WeekAssessment = {
  days: DayAssessment[];
  plan: ActionPlan;
  footer: string;
};
