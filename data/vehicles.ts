export type VehicleGeneration = {
  id: string;
  model: string;
  generation?: string;
  startYear: number;
  endYear: number;
  variants: string[];
};

export type VehicleMake = {
  make: string;
  vehicles: VehicleGeneration[];
};

export const vehicleDatabase: VehicleMake[] = [
  {
    make: "Perodua",
    vehicles: [
      { id: "perodua-myvi-gen1", model: "Myvi", generation: "Gen 1", startYear: 2005, endYear: 2011, variants: ["1.0", "1.3"] },
      { id: "perodua-myvi-gen2", model: "Myvi", generation: "Gen 2", startYear: 2011, endYear: 2017, variants: ["1.3", "1.5"] },
      { id: "perodua-myvi-gen3", model: "Myvi", generation: "Gen 3 / D20N / M800", startYear: 2018, endYear: 2026, variants: ["1.3", "1.5"] },
      { id: "perodua-axia-g1", model: "Axia", generation: "Gen 1", startYear: 2014, endYear: 2022, variants: ["1.0"] },
      { id: "perodua-axia-d74a", model: "Axia", generation: "D74A", startYear: 2023, endYear: 2026, variants: ["1.0"] },
      { id: "perodua-bezza", model: "Bezza", startYear: 2016, endYear: 2026, variants: ["1.0", "1.3"] },
      { id: "perodua-alza-g1", model: "Alza", generation: "Gen 1", startYear: 2009, endYear: 2021, variants: ["1.5"] },
      { id: "perodua-alza-w150", model: "Alza", generation: "W150", startYear: 2022, endYear: 2026, variants: ["1.5"] },
      { id: "perodua-viva", model: "Viva", startYear: 2007, endYear: 2014, variants: ["660", "850", "1.0"] },
      { id: "perodua-kelisa", model: "Kelisa", startYear: 2001, endYear: 2007, variants: ["850", "1.0"] },
      { id: "perodua-kenari", model: "Kenari", startYear: 2000, endYear: 2009, variants: ["1.0"] },
      { id: "perodua-kancil", model: "Kancil", startYear: 1994, endYear: 2009, variants: ["660", "850"] },
    ],
  },
  {
    make: "Proton",
    vehicles: [
      { id: "proton-saga-blm", model: "Saga", generation: "BLM", startYear: 2008, endYear: 2010, variants: ["1.3"] },
      { id: "proton-saga-fl", model: "Saga", generation: "FL", startYear: 2010, endYear: 2011, variants: ["1.3"] },
      { id: "proton-saga-flx", model: "Saga", generation: "FLX", startYear: 2011, endYear: 2016, variants: ["1.3"] },
      { id: "proton-saga-vvt", model: "Saga", generation: "VVT", startYear: 2016, endYear: 2026, variants: ["1.3"] },
      { id: "proton-exora-cps", model: "Exora", generation: "CPS", startYear: 2009, endYear: 2011, variants: ["1.6 CPS"] },
      { id: "proton-exora-bold", model: "Exora", generation: "Bold / CFE", startYear: 2011, endYear: 2023, variants: ["1.6 CFE"] },
      { id: "proton-preve", model: "Preve", startYear: 2012, endYear: 2018, variants: ["1.6 IAFM+", "1.6 CFE"] },
      { id: "proton-suprima-s", model: "Suprima S", startYear: 2013, endYear: 2019, variants: ["1.6 CFE"] },
      { id: "proton-waja-mmc", model: "Waja", generation: "MMC", startYear: 2000, endYear: 2007, variants: ["1.6"] },
      { id: "proton-waja-campro", model: "Waja", generation: "Campro", startYear: 2006, endYear: 2011, variants: ["1.6"] },
      { id: "proton-gen2", model: "Gen2", startYear: 2004, endYear: 2012, variants: ["1.3", "1.6"] },
      { id: "proton-persona-g1", model: "Persona", generation: "Gen 1", startYear: 2007, endYear: 2016, variants: ["1.6"] },
      { id: "proton-persona-vvt", model: "Persona", generation: "VVT", startYear: 2016, endYear: 2026, variants: ["1.6"] },
      { id: "proton-satria-neo", model: "Satria Neo", startYear: 2006, endYear: 2015, variants: ["1.6"] },
      { id: "proton-wira", model: "Wira", startYear: 1993, endYear: 2009, variants: ["1.3", "1.5", "1.6", "1.8"] },
    ],
  },
  {
    make: "Toyota",
    vehicles: [
      { id: "toyota-vios-ncp42", model: "Vios", generation: "NCP42", startYear: 2003, endYear: 2007, variants: ["1.5"] },
      { id: "toyota-vios-ncp93", model: "Vios", generation: "NCP93", startYear: 2007, endYear: 2013, variants: ["1.5"] },
      { id: "toyota-vios-ncp150", model: "Vios", generation: "NCP150", startYear: 2013, endYear: 2018, variants: ["1.5"] },
      { id: "toyota-vios-nsp151", model: "Vios", generation: "NSP151", startYear: 2019, endYear: 2023, variants: ["1.5"] },
      { id: "toyota-yaris-nsp151", model: "Yaris", generation: "NSP151", startYear: 2019, endYear: 2026, variants: ["1.5"] },
      { id: "toyota-camry-acv30", model: "Camry", generation: "ACV30", startYear: 2002, endYear: 2006, variants: ["2.0", "2.4"] },
      { id: "toyota-camry-acv40", model: "Camry", generation: "ACV40 / ACV41", startYear: 2006, endYear: 2011, variants: ["2.0", "2.4"] },
      { id: "toyota-altis-18", model: "Corolla Altis", generation: "1.8", startYear: 2008, endYear: 2013, variants: ["1.8"] },
      { id: "toyota-wish-18", model: "Wish", generation: "1.8", startYear: 2009, endYear: 2017, variants: ["1.8"] },
      { id: "toyota-hiace-rzh112", model: "Hiace", generation: "RZH112", startYear: 1995, endYear: 2004, variants: ["2.0"] },
      { id: "toyota-innova-tgn40", model: "Innova", generation: "TGN40", startYear: 2005, endYear: 2015, variants: ["2.0"] },
      { id: "toyota-fortuner-27", model: "Fortuner", generation: "2.7", startYear: 2005, endYear: 2015, variants: ["2.7"] },
    ],
  },
  {
    make: "Honda",
    vehicles: [
      { id: "honda-city-gm2", model: "City", generation: "GM2", startYear: 2009, endYear: 2013, variants: ["1.5"] },
      { id: "honda-city-gm6", model: "City", generation: "GM6", startYear: 2014, endYear: 2020, variants: ["1.5"] },
      { id: "honda-city-gn", model: "City", generation: "GN", startYear: 2020, endYear: 2026, variants: ["1.5", "1.5 e:HEV"] },
      { id: "honda-civic-fd", model: "Civic", generation: "FD", startYear: 2006, endYear: 2011, variants: ["1.8", "2.0"] },
      { id: "honda-civic-fb", model: "Civic", generation: "FB", startYear: 2012, endYear: 2015, variants: ["1.8", "2.0"] },
      { id: "honda-civic-fc", model: "Civic", generation: "FC", startYear: 2016, endYear: 2021, variants: ["1.8", "1.5 Turbo"] },
      { id: "honda-hrv-ru", model: "HR-V", generation: "RU", startYear: 2015, endYear: 2021, variants: ["1.8"] },
    ],
  },
  {
    make: "Nissan",
    vehicles: [
      { id: "nissan-almera-n17", model: "Almera", generation: "N17", startYear: 2012, endYear: 2020, variants: ["1.5"] },
      { id: "nissan-almera-n18", model: "Almera", generation: "N18", startYear: 2020, endYear: 2026, variants: ["1.0 Turbo"] },
      { id: "nissan-sentra-b13", model: "Sentra", generation: "B13", startYear: 1991, endYear: 1995, variants: ["1.6"] },
      { id: "nissan-sentra-b14", model: "Sentra", generation: "B14", startYear: 1995, endYear: 2000, variants: ["1.6"] },
      { id: "nissan-sentra-n16", model: "Sentra", generation: "N16", startYear: 2000, endYear: 2012, variants: ["1.6", "1.8"] },
      { id: "nissan-urvan-e25", model: "Urvan", generation: "E25", startYear: 2001, endYear: 2012, variants: ["2.5"] },
    ],
  },
  {
    make: "Mitsubishi",
    vehicles: [
      { id: "mitsubishi-pajero-4m40", model: "Pajero", generation: "4M40", startYear: 1993, endYear: 2000, variants: ["2.8 Diesel"] },
    ],
  },
  {
    make: "Isuzu",
    vehicles: [
      { id: "isuzu-trooper-g200", model: "Trooper", generation: "UBS / G200", startYear: 1988, endYear: 1998, variants: ["2.0"] },
    ],
  },
];

export const popularVehicleIds = [
  "perodua-myvi-gen3",
  "perodua-bezza",
  "perodua-axia-g1",
  "proton-saga-vvt",
  "toyota-vios-ncp93",
  "toyota-vios-ncp150",
  "honda-city-gm6",
  "nissan-almera-n17",
];

export function yearsForVehicle(vehicle: VehicleGeneration) {
  return Array.from(
    { length: vehicle.endYear - vehicle.startYear + 1 },
    (_, index) => vehicle.endYear - index
  );
}

export function vehicleLabel(make: string, vehicle: VehicleGeneration, year?: string, variant?: string) {
  return [make, vehicle.model, vehicle.generation, year, variant].filter(Boolean).join(" ");
}
