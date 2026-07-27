export const supportedLocales = ["en", "sv", "de", "da", "no", "fi"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const messages: Record<SupportedLocale, Record<string, string>> = {
  en: {
    appName: "Weathertrip",
    planTrip: "Plan trip",
    results: "Results",
    startLocation: "Start location",
    weatherFit: "Weather fit"
  },
  sv: {
    appName: "Weathertrip",
    planTrip: "Planera resa",
    results: "Resultat",
    startLocation: "Startplats",
    weatherFit: "Vadret passar"
  },
  de: {
    appName: "Weathertrip",
    planTrip: "Reise planen",
    results: "Ergebnisse",
    startLocation: "Startort",
    weatherFit: "Wetter passt"
  },
  da: {
    appName: "Weathertrip",
    planTrip: "Planlaeg tur",
    results: "Resultater",
    startLocation: "Startsted",
    weatherFit: "Vejret passer"
  },
  no: {
    appName: "Weathertrip",
    planTrip: "Planlegg tur",
    results: "Resultater",
    startLocation: "Startsted",
    weatherFit: "Vaeret passer"
  },
  fi: {
    appName: "Weathertrip",
    planTrip: "Suunnittele matka",
    results: "Tulokset",
    startLocation: "Lahtopaikka",
    weatherFit: "Saa sopii"
  }
};
