declare module "*.geojson" {
  const value: {
    features: Array<{
      properties?: { shapeName?: string };
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  };
  export default value;
}
