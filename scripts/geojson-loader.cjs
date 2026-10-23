/** Lets the client bundle import the pinned department boundaries. */
module.exports = function geojsonLoader(source) {
  const text = typeof source === "string" ? source : source.toString("utf8");
  return `export default ${JSON.stringify(JSON.parse(text))}`;
};
