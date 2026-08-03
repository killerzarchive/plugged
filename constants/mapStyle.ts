// Map colors aligned to app dark theme tokens:
// bg=#000000  bg2=#111111  bg3=#1A1A1A  border=#222222  border2=#2A2A2A

export const DARK_MAP_STYLE = [
  // Base canvas — matches bg2
  { elementType: "geometry",           stylers: [{ color: "#111111" }] },

  // Kill all labels by default, re-enable selectively
  { elementType: "labels",             stylers: [{ visibility: "off" }] },
  { elementType: "labels.icon",        stylers: [{ visibility: "off" }] },

  // ── POI — killed (users create hotspots themselves) ───────────────────────
  { featureType: "poi",                stylers: [{ visibility: "off" }] },
  { featureType: "transit",            stylers: [{ visibility: "off" }] },

  // ── Roads — bg3 / border / border2 ───────────────────────────────────────
  { featureType: "road",               elementType: "geometry",           stylers: [{ color: "#1A1A1A" }] },
  { featureType: "road",               elementType: "geometry.stroke",    stylers: [{ color: "#111111" }] },
  { featureType: "road",               elementType: "labels.icon",        stylers: [{ visibility: "off" }] },
  { featureType: "road",               elementType: "labels.text",        stylers: [{ visibility: "on" }] },
  { featureType: "road",               elementType: "labels.text.fill",   stylers: [{ color: "#555555" }] },
  { featureType: "road",               elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },

  { featureType: "road.highway",       elementType: "geometry",           stylers: [{ color: "#2A2A2A" }] },
  { featureType: "road.highway",       elementType: "labels.text",        stylers: [{ visibility: "on" }] },
  { featureType: "road.highway",       elementType: "labels.text.fill",   stylers: [{ color: "#666666" }] },
  { featureType: "road.highway",       elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },
  { featureType: "road.highway",       elementType: "labels.icon",        stylers: [{ visibility: "off" }] },

  { featureType: "road.arterial",      elementType: "geometry",           stylers: [{ color: "#1A1A1A" }] },
  { featureType: "road.arterial",      elementType: "labels.text",        stylers: [{ visibility: "on" }] },
  { featureType: "road.arterial",      elementType: "labels.text.fill",   stylers: [{ color: "#555555" }] },
  { featureType: "road.arterial",      elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },

  { featureType: "road.local",         elementType: "geometry",           stylers: [{ color: "#181818" }] },
  { featureType: "road.local",         elementType: "labels.text",        stylers: [{ visibility: "on" }] },
  { featureType: "road.local",         elementType: "labels.text.fill",   stylers: [{ color: "#444444" }] },
  { featureType: "road.local",         elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },

  // ── Administrative — border / border2 ────────────────────────────────────
  { featureType: "administrative",               elementType: "geometry.stroke", stylers: [{ color: "#222222" }, { visibility: "on" }] },
  { featureType: "administrative.country",       elementType: "geometry.stroke", stylers: [{ color: "#2A2A2A" }, { visibility: "on" }] },
  { featureType: "administrative.province",      elementType: "geometry.stroke", stylers: [{ color: "#222222" }, { visibility: "on" }] },
  { featureType: "administrative.locality",      elementType: "labels.text",        stylers: [{ visibility: "on" }] },
  { featureType: "administrative.locality",      elementType: "labels.text.fill",   stylers: [{ color: "#666666" }] },
  { featureType: "administrative.locality",      elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },
  { featureType: "administrative.neighborhood",  elementType: "labels.text",        stylers: [{ visibility: "on" }] },
  { featureType: "administrative.neighborhood",  elementType: "labels.text.fill",   stylers: [{ color: "#555555" }] },
  { featureType: "administrative.neighborhood",  elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },
  { featureType: "administrative.land_parcel",   elementType: "labels",             stylers: [{ visibility: "off" }] },

  // ── Water — pure bg (#000000) so it reads as void ─────────────────────────
  { featureType: "water",              elementType: "geometry",        stylers: [{ color: "#000000" }] },
  { featureType: "water",              elementType: "labels.text",     stylers: [{ visibility: "off" }] },

  // ── Landscape — bg / bg2 ──────────────────────────────────────────────────
  { featureType: "landscape",          elementType: "geometry",        stylers: [{ color: "#111111" }] },
  { featureType: "landscape.natural",  elementType: "geometry",        stylers: [{ color: "#0d0d0d" }] },
  { featureType: "landscape",          elementType: "labels",          stylers: [{ visibility: "off" }] },
];
