export type VehicleGeneration = {
  id: string;
  model: string;
  generation?: string;
  startYear: number;
  endYear?: number;
  variants: string[];
  transmissions?: string[];
};

export type VehicleMake = {
  make: string;
  vehicles: VehicleGeneration[];
};

const CURRENT_YEAR = new Date().getFullYear();

export const vehicleDatabase: VehicleMake[] = [
  {
    make: "Perodua",
    vehicles: [
      { id: "perodua-myvi-m300-2005", model: "Myvi", generation: "Gen 1 (M300)", startYear: 2005, endYear: 2008, variants: ["1.0 SR", "1.3 SX", "1.3 EZ"] },
      { id: "perodua-myvi-m300-fl-2008", model: "Myvi", generation: "Gen 1 Facelift", startYear: 2008, endYear: 2011, variants: ["1.3 Standard", "1.3 Premium", "1.3 SE"] },
      { id: "perodua-myvi-m600-2011", model: "Myvi", generation: "Gen 2 (M600 / Lagi Best)", startYear: 2011, endYear: 2014, variants: ["1.3 Standard G", "1.3 Premium X", "1.3 SE"] },
      { id: "perodua-myvi-icon-2015", model: "Myvi", generation: "Gen 2 (Icon)", startYear: 2015, endYear: 2017, variants: ["1.3 Standard G", "1.5 SE", "1.5 Extreme"] },
      { id: "perodua-myvi-m800-prefl-2017", model: "Myvi", generation: "Gen 3 (M800 Pre-FL)", startYear: 2017, endYear: 2021, variants: ["1.3 G", "1.3 X", "1.5 H", "1.5 AV"] },
      { id: "perodua-myvi-m800-fl-2021", model: "Myvi", generation: "Gen 3 (M800 Facelift)", startYear: 2021, variants: ["1.3 G", "1.5 X", "1.5 H", "1.5 AV"], transmissions: ["AUTO"] },

      { id: "perodua-axia-g1-prefl-2014", model: "Axia", generation: "Gen 1 (Pre-FL)", startYear: 2014, endYear: 2017, variants: ["1.0 E", "1.0 G", "1.0 SE", "1.0 AV"] },
      { id: "perodua-axia-g1-fl1-2017", model: "Axia", generation: "Gen 1 (Facelift 1)", startYear: 2017, endYear: 2019, variants: ["1.0 E", "1.0 G", "1.0 SE", "1.0 AV"] },
      { id: "perodua-axia-g1-fl2-2019", model: "Axia", generation: "Gen 1 (Facelift 2)", startYear: 2019, endYear: 2023, variants: ["1.0 E", "1.0 G", "1.0 GXtra", "1.0 SE", "1.0 AV", "1.0 Style"] },
      { id: "perodua-axia-dnga-2023", model: "Axia", generation: "Gen 2 (DNGA)", startYear: 2023, variants: ["1.0 E", "1.0 G", "1.0 X", "1.0 SE", "1.0 AV"] },

      { id: "perodua-bezza-prefl-2016", model: "Bezza", generation: "Pre-Facelift", startYear: 2016, endYear: 2020, variants: ["1.0 G", "1.3 Premium X", "1.3 AV"] },
      { id: "perodua-bezza-fl-2020", model: "Bezza", generation: "Facelift", startYear: 2020, variants: ["1.0 G", "1.3 Premium X", "1.3 AV"] },

      { id: "perodua-alza-mark1-2009", model: "Alza", generation: "Gen 1 (Mark I)", startYear: 2009, endYear: 2014, variants: ["1.5 GX", "1.5 EZ", "1.5 SE", "1.5 AV"] },
      { id: "perodua-alza-g1-fl-2014", model: "Alza", generation: "Gen 1 (Facelift)", startYear: 2014, endYear: 2022, variants: ["1.5 S", "1.5 SE", "1.5 AV"] },
      { id: "perodua-alza-dnga-2022", model: "Alza", generation: "Gen 2 (DNGA)", startYear: 2022, variants: ["1.5 X", "1.5 H", "1.5 AV"], transmissions: ["AUTO"] },

      { id: "perodua-viva-g1-2007", model: "Viva", generation: "Gen 1", startYear: 2007, endYear: 2014, variants: ["660 BX", "850 EX", "1.0 SX", "1.0 EZ", "1.0 Elite"] },
      { id: "perodua-kelisa-g1-2001", model: "Kelisa", generation: "Gen 1", startYear: 2001, endYear: 2007, variants: ["1.0 GX", "1.0 EZ", "1.0 SE"] },
      { id: "perodua-kancil-g1g2-1994", model: "Kancil", generation: "Gen 1 / Gen 2", startYear: 1994, endYear: 2009, variants: ["660 EX", "850 EX", "850 EZ"] },
      { id: "perodua-ativa-g1-2021", model: "Ativa", generation: "Gen 1", startYear: 2021, variants: ["1.0 Turbo X", "1.0 Turbo H", "1.0 Turbo AV"], transmissions: ["AUTO"] },
      { id: "perodua-aruz-g1-2019", model: "Aruz", generation: "Gen 1", startYear: 2019, variants: ["1.5 X", "1.5 AV"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Proton",
    vehicles: [
      { id: "proton-saga-iswara-1992", model: "Saga", generation: "Saga Iswara", startYear: 1992, endYear: 2003, variants: ["1.3 S", "1.3 LMST", "1.5 S"] },
      { id: "proton-saga-blm-2008", model: "Saga", generation: "BLM (Base Line Model)", startYear: 2008, endYear: 2010, variants: ["1.3 N", "1.3 M-Line", "1.6 SE"] },
      { id: "proton-saga-flx-2010", model: "Saga", generation: "FL / FLX", startYear: 2010, endYear: 2016, variants: ["1.3 Executive", "1.3 Standard", "1.6 SE"] },
      { id: "proton-saga-vvt-prefl-2016", model: "Saga", generation: "VVT (Gen 3 Pre-FL)", startYear: 2016, endYear: 2019, variants: ["1.3 Standard", "1.3 Executive", "1.3 Premium"] },
      { id: "proton-saga-mc-2019", model: "Saga", generation: "MC1 / MC2 (Facelift)", startYear: 2019, variants: ["1.3 Standard MT", "1.3 Standard AT", "1.3 Premium S"] },

      { id: "proton-persona-cm-2007", model: "Persona", generation: "Gen 1 (CM)", startYear: 2007, endYear: 2016, variants: ["1.6 Base", "1.6 Medium", "1.6 High", "1.6 SV"] },
      { id: "proton-persona-bh-2016", model: "Persona", generation: "Gen 2 (BH)", startYear: 2016, variants: ["1.6 Standard", "1.6 Executive", "1.6 Premium"] },

      { id: "proton-wira-g1-1993", model: "Wira", generation: "Gen 1", startYear: 1993, endYear: 2009, variants: ["1.3 GL", "1.5 GLi", "1.6 XLi", "1.8 EXi"] },
      { id: "proton-waja-g1-2000", model: "Waja", generation: "Gen 1", startYear: 2000, endYear: 2011, variants: ["1.6 4G18", "1.6 CamPro", "1.6 CPS", "1.8 Renault"] },
      { id: "proton-exora-2009", model: "Exora", generation: "CPS / CPT", startYear: 2009, endYear: 2023, variants: ["1.6 CPS Exec", "1.6 CPT Exec", "1.6 CPT Premium"] },

      { id: "proton-x50-g1-2020", model: "X50", generation: "Gen 1", startYear: 2020, variants: ["1.5T Standard", "1.5T Exec", "1.5T Premium", "1.5 TGDi Flagship"], transmissions: ["AUTO"] },
      { id: "proton-x70-g1-2018", model: "X70", generation: "Gen 1", startYear: 2018, variants: ["1.8 TGDi", "1.5 TGDi Exec", "1.5 TGDi Premium"], transmissions: ["AUTO"] },
      { id: "proton-s70-g1-2023", model: "S70", generation: "Gen 1", startYear: 2023, variants: ["1.5T Exec", "1.5T Premium", "1.5T Flagship", "1.5T Flagship X"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Toyota",
    vehicles: [
      { id: "toyota-vios-ncp42-2002", model: "Vios", generation: "NCP42 (Gen 1)", startYear: 2002, endYear: 2007, variants: ["1.5 E", "1.5 G", "1.5 Special Edition"] },
      { id: "toyota-vios-ncp93-2007", model: "Vios", generation: "NCP93 (Gen 2)", startYear: 2007, endYear: 2013, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 TRD Sportivo"] },
      { id: "toyota-vios-ncp150-2013", model: "Vios", generation: "NCP150 (Gen 3)", startYear: 2013, endYear: 2016, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 TRD Sportivo"] },
      { id: "toyota-vios-ncp150fl-2016", model: "Vios", generation: "NCP150 (Gen 3 FL)", startYear: 2016, endYear: 2019, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 GX"] },
      { id: "toyota-vios-nsp151-2019", model: "Vios", generation: "NSP151 (Gen 3.5)", startYear: 2019, endYear: 2023, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 GR Sport"] },
      { id: "toyota-vios-ac100-2023", model: "Vios", generation: "AC100 (Gen 4)", startYear: 2023, variants: ["1.5 E", "1.5 G"], transmissions: ["AUTO"] },

      { id: "toyota-camry-xv20-1997", model: "Camry", generation: "XV20 (Gen 4)", startYear: 1997, endYear: 2002, variants: ["2.2 GLi", "2.2 Crown", "3.0 V6"] },
      { id: "toyota-camry-xv30-2002", model: "Camry", generation: "XV30 (Gen 5)", startYear: 2002, endYear: 2006, variants: ["2.0E", "2.0G", "2.4G"] },
      { id: "toyota-camry-xv40-2006", model: "Camry", generation: "XV40 (Gen 6)", startYear: 2006, endYear: 2012, variants: ["2.0E", "2.0G", "2.4V"] },
      { id: "toyota-camry-xv50-2012", model: "Camry", generation: "XV50 (Gen 7)", startYear: 2012, endYear: 2018, variants: ["2.0E", "2.0G", "2.5V", "2.5 Hybrid"] },
      { id: "toyota-camry-xv70-2018", model: "Camry", generation: "XV70 (Gen 8)", startYear: 2018, endYear: 2024, variants: ["2.5V", "2.5V Dynamic Force"] },

      { id: "toyota-altis-e120-2001", model: "Corolla Altis", generation: "E120", startYear: 2001, endYear: 2008, variants: ["1.6E", "1.8G"] },
      { id: "toyota-altis-e140-2008", model: "Corolla Altis", generation: "E140 / E150", startYear: 2008, endYear: 2013, variants: ["1.6E", "1.8E", "1.8G", "2.0V"] },
      { id: "toyota-altis-e170-2013", model: "Corolla Altis", generation: "E170", startYear: 2013, endYear: 2019, variants: ["1.8E", "1.8G", "2.0V"] },
      { id: "toyota-altis-e210-2019", model: "Corolla Altis", generation: "E210", startYear: 2019, variants: ["1.8E", "1.8G", "1.8 GR Sport"], transmissions: ["AUTO"] },

      { id: "toyota-hilux-vigo-2005", model: "Hilux", generation: "Vigo (KUN25/26)", startYear: 2005, endYear: 2015, variants: ["2.5 D-4D", "3.0 D-4D"] },
      { id: "toyota-hilux-revo-2015", model: "Hilux", generation: "Revo (GUN125/126)", startYear: 2015, variants: ["2.4 Single Cab", "2.4 E", "2.4 G", "2.8 Rogue", "2.8 GR Sport"] },

      { id: "toyota-corolla-cross-xg10-2021", model: "Corolla Cross", generation: "XG10", startYear: 2021, variants: ["1.8 G", "1.8 V", "1.8 Hybrid", "GR Sport"], transmissions: ["AUTO"] },
      { id: "toyota-alphard-vellfire-ah20-2008", model: "Alphard / Vellfire", generation: "AH20 / ANH20", startYear: 2008, endYear: 2015, variants: ["2.4 X", "2.4 Z", "2.4 G", "3.5 V6"] },
      { id: "toyota-alphard-vellfire-ah30-2015", model: "Alphard / Vellfire", generation: "AH30 / AGH30", startYear: 2015, endYear: 2023, variants: ["2.5 X", "2.5 Z", "2.5 ZG", "3.5 V6", "Executive Lounge"] },
    ],
  },
  {
    make: "Honda",
    vehicles: [
      { id: "honda-city-gd-2002", model: "City", generation: "GD8 / GD3", startYear: 2002, endYear: 2008, variants: ["1.5 i-DSI", "1.5 VTEC"] },
      { id: "honda-city-gm23-2008", model: "City", generation: "GM2 / GM3", startYear: 2008, endYear: 2014, variants: ["1.5 S", "1.5 E", "1.5 V"] },
      { id: "honda-city-gm6-2014", model: "City", generation: "GM6", startYear: 2014, endYear: 2020, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 Hybrid"], transmissions: ["AUTO"] },
      { id: "honda-city-gn2-2020", model: "City", generation: "GN2", startYear: 2020, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 RS e:HEV"], transmissions: ["AUTO"] },

      { id: "honda-civic-fd-2006", model: "Civic", generation: "FD (FD1/FD2)", startYear: 2006, endYear: 2011, variants: ["1.8 i-VTEC", "2.0 i-VTEC", "Type R (FD2R)"] },
      { id: "honda-civic-fb-2012", model: "Civic", generation: "FB", startYear: 2012, endYear: 2016, variants: ["1.8 S", "2.0 S", "2.0 Navi", "Hybrid"] },
      { id: "honda-civic-fc-2016", model: "Civic", generation: "FC", startYear: 2016, endYear: 2021, variants: ["1.8 S", "1.5 Turbo TC", "1.5 Turbo TC-P"], transmissions: ["AUTO"] },
      { id: "honda-civic-fe-2022", model: "Civic", generation: "FE", startYear: 2022, variants: ["1.5 E", "1.5 V", "1.5 RS", "2.0 e:HEV RS", "Type R (FL5)"] },

      { id: "honda-hrv-ru-2015", model: "HR-V", generation: "RU", startYear: 2015, endYear: 2021, variants: ["1.8 S", "1.8 E", "1.8 V", "1.8 RS", "Hybrid"], transmissions: ["AUTO"] },
      { id: "honda-hrv-rv-2022", model: "HR-V", generation: "RV", startYear: 2022, variants: ["1.5 NA", "1.5 Turbo E", "1.5 Turbo V", "1.5 RS e:HEV"], transmissions: ["AUTO"] },
      { id: "honda-crv-rm-rw-rs-2012", model: "CR-V", generation: "RM / RW / RS", startYear: 2012, variants: ["2.0 i-VTEC", "1.5 Turbo", "2.0 e:HEV RS"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Nissan",
    vehicles: [
      { id: "nissan-almera-n17-2012", model: "Almera", generation: "N17", startYear: 2012, endYear: 2020, variants: ["1.5 E", "1.5 V", "1.5 VL"] },
      { id: "nissan-almera-n18-2020", model: "Almera", generation: "N18", startYear: 2020, variants: ["1.0 Turbo VL", "1.0 Turbo VLP", "1.0 Turbo VLT"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c26c27-2013", model: "Serena", generation: "C26 / C27", startYear: 2013, variants: ["2.0 S-Hybrid Highway Star", "2.0 S-Hybrid Premium"], transmissions: ["AUTO"] },
      { id: "nissan-navara-d40d23-2008", model: "Navara", generation: "D40 / NP300 (D23)", startYear: 2008, variants: ["2.5 SE", "2.5 V", "2.5 VL", "2.5 PRO-4X"] },
    ],
  },
  {
    make: "Mazda",
    vehicles: [
      { id: "mazda-3-bm-bn-bp-2014", model: "Mazda 3", generation: "BM / BN / BP", startYear: 2014, variants: ["1.5", "2.0 High", "2.0 High Plus", "2.0 Ignite Edition"] },
      { id: "mazda-cx5-ke-kf-2012", model: "CX-5", generation: "KE / KF", startYear: 2012, variants: ["2.0", "2.5", "2.2 Diesel", "2.5 Turbo"] },
      { id: "mazda-cx30-dm-2020", model: "CX-30", generation: "DM", startYear: 2020, variants: ["2.0 Core", "2.0 High", "2.0 High Plus"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Lexus",
    vehicles: [
      { id: "lexus-rx-al20-ala10-2015", model: "RX", generation: "AL20 / ALA10", startYear: 2015, variants: ["RX 300", "RX 350", "RX 500h F Sport"], transmissions: ["AUTO"] },
      { id: "lexus-nx-az10-az20-2014", model: "NX", generation: "AZ10 / AZ20", startYear: 2014, variants: ["NX 200t", "NX 300", "NX 250", "NX 350 F Sport"], transmissions: ["AUTO"] },
    ],
  },
];

export const popularVehicleIds = [
  "perodua-myvi-m800-fl-2021",
  "perodua-bezza-fl-2020",
  "perodua-axia-dnga-2023",
  "proton-saga-mc-2019",
  "toyota-vios-nsp151-2019",
  "toyota-vios-ac100-2023",
  "honda-city-gm6-2014",
  "nissan-almera-n17-2012",
];

export function yearsForVehicle(vehicle: VehicleGeneration) {
  const finalYear = vehicle.endYear ?? CURRENT_YEAR;
  return Array.from(
    { length: finalYear - vehicle.startYear + 1 },
    (_, index) => finalYear - index
  );
}

export function transmissionsForVehicle(vehicle: VehicleGeneration) {
  return vehicle.transmissions || ["AUTO", "MANUAL"];
}

export function vehicleLabel(
  make: string,
  vehicle: VehicleGeneration,
  year?: string,
  variant?: string,
  transmission?: string
) {
  return [make, vehicle.model, vehicle.generation, year, variant, transmission]
    .filter(Boolean)
    .join(" ");
}
