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
  timezone?: string;
  /** Metres from the Open-Meteo reply. Not used by the risk score. */
  elevation?: number;
  hourly?: OpenMeteoHourly;
  daily?: OpenMeteoDaily;
};

export type DayAssessment = {
  date: string;
  /** Null when the day has no complete hourly data. The screen shows "sin datos". */
  level: RiskLevel | null;
  reason: string;
  score: number;
  /** Wet hours in the scored local day. Null when that day was not scored. */
  wetHours: number | null;
  /** Scored daily max (`temperature_2m_max`), °C. Null when that day was not scored. */
  tmax: number | null;
  /** Sum of precipitation on those same hours, mm. Null when that day was not scored. */
  rain: number | null;
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
  /** False for a bad, empty, missing-timezone, or wrong-timezone forecast. No day levels. */
  available: boolean;
  /** The forecast timezone when the week was scored. Null when the reply was rejected. */
  timezone: string | null;
  days: DayAssessment[];
  plan: ActionPlan;
  footer: string;
};
