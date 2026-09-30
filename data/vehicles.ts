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
  modelOrder?: string[];
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
      { id: "perodua-myvi-m800-prefl-2018", model: "Myvi", generation: "Gen 3 (M800 Pre-FL)", startYear: 2018, endYear: 2021, variants: ["1.3 G", "1.3 X", "1.5 H", "1.5 AV"] },
      { id: "perodua-myvi-m800-fl-2021", model: "Myvi", generation: "Gen 3 (M800 Facelift)", startYear: 2021, variants: ["1.3 G", "1.5 X", "1.5 H", "1.5 AV"], transmissions: ["AUTO"] },

      { id: "perodua-axia-g1-prefl-2014", model: "Axia", generation: "Gen 1 (Pre-FL)", startYear: 2014, endYear: 2016, variants: ["1.0 E", "1.0 G", "1.0 SE", "1.0 AV"] },
      { id: "perodua-axia-g1-fl1-2017", model: "Axia", generation: "Gen 1 (Facelift 1)", startYear: 2017, endYear: 2018, variants: ["1.0 E", "1.0 G", "1.0 SE", "1.0 AV"] },
      { id: "perodua-axia-g1-fl2-2019", model: "Axia", generation: "Gen 1 (Facelift 2)", startYear: 2019, endYear: 2022, variants: ["1.0 E", "1.0 G", "1.0 GXtra", "1.0 SE", "1.0 AV", "1.0 Style"] },
      { id: "perodua-axia-dnga-2023", model: "Axia", generation: "Gen 2 (DNGA)", startYear: 2023, variants: ["1.0 E", "1.0 G", "1.0 X", "1.0 SE", "1.0 AV"] },

      { id: "perodua-bezza-prefl-2016", model: "Bezza", generation: "Pre-Facelift", startYear: 2016, endYear: 2019, variants: ["1.0 G", "1.3 Premium X", "1.3 AV"] },
      { id: "perodua-bezza-fl-2020", model: "Bezza", generation: "Facelift", startYear: 2020, variants: ["1.0 G", "1.3 Premium X", "1.3 AV"] },

      { id: "perodua-alza-mark1-2009", model: "Alza", generation: "Gen 1 (Mark I)", startYear: 2009, endYear: 2013, variants: ["1.5 GX", "1.5 EZ", "1.5 SE", "1.5 AV"] },
      { id: "perodua-alza-g1-fl-2014", model: "Alza", generation: "Gen 1 (Facelift)", startYear: 2014, endYear: 2021, variants: ["1.5 S", "1.5 SE", "1.5 AV"] },
      { id: "perodua-alza-dnga-2022", model: "Alza", generation: "Gen 2 (DNGA)", startYear: 2022, variants: ["1.5 X", "1.5 H", "1.5 AV"], transmissions: ["AUTO"] },

      { id: "perodua-viva-g1-2007", model: "Viva", generation: "Gen 1", startYear: 2007, endYear: 2014, variants: ["660 BX", "850 EX", "1.0 SX", "1.0 EZ", "1.0 Elite"] },
      { id: "perodua-kelisa-g1-2001", model: "Kelisa", generation: "Gen 1", startYear: 2001, endYear: 2007, variants: ["1.0 GX", "1.0 EZ", "1.0 SE"] },
      { id: "perodua-kenari-prefl-2000", model: "Kenari", generation: "Pre-Facelift", startYear: 2000, endYear: 2002, variants: ["1.0 EX", "1.0 GX", "1.0 EZ"] },
      { id: "perodua-kenari-fl-2003", model: "Kenari", generation: "Facelift", startYear: 2003, endYear: 2009, variants: ["1.0 GX", "1.0 EZ", "1.0 EZS", "1.0 GX Aero", "1.0 EZ Aero", "1.0 RS"] },
      { id: "perodua-kancil-g1g2-1994", model: "Kancil", generation: "Gen 1 / Gen 2", startYear: 1994, endYear: 2009, variants: ["660 EX", "850 EX", "850 EZ"] },
      { id: "perodua-ativa-g1-2021", model: "Ativa", generation: "Gen 1", startYear: 2021, variants: ["1.0 Turbo X", "1.0 Turbo H", "1.0 Turbo AV"], transmissions: ["AUTO"] },
      { id: "perodua-aruz-g1-2019", model: "Aruz", generation: "Gen 1", startYear: 2019, variants: ["1.5 X", "1.5 AV"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Proton",
    modelOrder: [
      "Saga",
      "Wira",
      "Satria",
      "Perdana",
      "Tiara",
      "Putra",
      "Waja",
      "Juara",
      "Arena",
      "Gen-2",
      "Savvy",
      "Satria Neo",
      "Persona",
      "Exora",
      "Inspira",
      "Prevé",
      "Suprima S",
      "Iriz",
      "Ertiga",
      "X70",
      "X50",
      "X90",
      "S70",
      "e.MAS 7",
      "e.MAS 5",
      "e.MAS 7 PHEV",
    ],
    vehicles: [
      // SAGA — 1985 to present
      { id: "proton-saga-orion-1985", model: "Saga", generation: "Orion", startYear: 1985, endYear: 1986, variants: ["1.3 S", "1.5 S"] },
      { id: "proton-saga-magma-1987", model: "Saga", generation: "Magma", startYear: 1987, endYear: 1989, variants: ["1.3 S", "1.5 S"] },
      { id: "proton-saga-megavalve-1990", model: "Saga", generation: "Megavalve", startYear: 1990, endYear: 1991, variants: ["1.3 12V", "1.5 12V"] },
      { id: "proton-saga-iswara-1992", model: "Saga", generation: "Iswara", startYear: 1992, endYear: 2000, variants: ["1.3 S Sedan", "1.5 S Sedan", "1.3 Aeroback", "1.5 Aeroback"] },
      { id: "proton-saga-iswara-se-2001", model: "Saga", generation: "Iswara Aeroback SE", startYear: 2001, endYear: 2003, variants: ["1.3 SE"], transmissions: ["MANUAL"] },
      { id: "proton-saga-lmst-2003", model: "Saga", generation: "LMST", startYear: 2003, endYear: 2007, variants: ["1.3 Standard", "1.3 Power Steering", "1.3 50th Merdeka Edition"], transmissions: ["MANUAL"] },
      { id: "proton-saga-blm-2008", model: "Saga", generation: "BLM", startYear: 2008, endYear: 2010, variants: ["1.3 N-Line", "1.3 B-Line", "1.3 M-Line", "1.3 SE", "1.6 CamPro"] },
      { id: "proton-saga-fl-2010", model: "Saga", generation: "FL", startYear: 2010, endYear: 2011, variants: ["1.3 Standard", "1.3 Executive", "1.6 Executive"] },
      { id: "proton-saga-flx-2011", model: "Saga", generation: "FLX", startYear: 2011, endYear: 2015, variants: ["1.3 Standard", "1.3 Executive", "1.6 SE"] },
      { id: "proton-saga-vvt-2016", model: "Saga", generation: "VVT (P2-13A)", startYear: 2016, endYear: 2018, variants: ["1.3 Standard", "1.3 Executive", "1.3 Premium"] },
      { id: "proton-saga-mc1-2019", model: "Saga", generation: "MC1 (P2-13A Facelift)", startYear: 2019, endYear: 2021, variants: ["1.3 Standard", "1.3 Premium"] },
      { id: "proton-saga-mc2-2022", model: "Saga", generation: "MC2 (P2-13A)", startYear: 2022, endYear: 2025, variants: ["1.3 Standard", "1.3 Premium S"] },
      { id: "proton-saga-ama01-2025", model: "Saga", generation: "AMA01", startYear: 2025, variants: ["1.5 Standard", "1.5 Executive", "1.5 Premium"], transmissions: ["AUTO"] },

      // WIRA — Sedan / Aeroback
      { id: "proton-wira-prefl-1993", model: "Wira", generation: "Pre-Facelift (C90)", startYear: 1993, endYear: 1995, variants: ["1.3 GL Sedan", "1.3 GL Aeroback", "1.5 GL Sedan", "1.5 GL Aeroback", "1.6 XLi Sedan", "1.6 XLi Aeroback"] },
      { id: "proton-wira-fl-1996", model: "Wira", generation: "Facelift (C90)", startYear: 1996, endYear: 2000, variants: ["1.3 GLi Sedan", "1.3 GLi Aeroback", "1.5 GLi Sedan", "1.5 GLi Aeroback", "1.6 XLi Sedan", "1.6 XLi Aeroback", "1.8 EXi DOHC", "2.0 Diesel"] },
      { id: "proton-wira-late-2001", model: "Wira", generation: "Late Model", startYear: 2001, endYear: 2009, variants: ["1.3 GLi Sedan", "1.3 GLi Aeroback", "1.5 GLi Sedan", "1.5 GLi Aeroback", "1.6 XLi Sedan", "1.6 XLi Aeroback", "1.5 SE", "1.8 EXi DOHC"] },

      // SATRIA
      { id: "proton-satria-prefl-1994", model: "Satria", generation: "Pre-Facelift", startYear: 1994, endYear: 1997, variants: ["1.3 GLi", "1.5 GLi", "1.6 XLi"] },
      { id: "proton-satria-fl-1998", model: "Satria", generation: "Facelift", startYear: 1998, endYear: 2005, variants: ["1.3 GLi", "1.5 GLi", "1.6 XLi", "1.8 GTi"] },
      { id: "proton-satria-r3-2004", model: "Satria", generation: "R3", startYear: 2004, endYear: 2005, variants: ["1.8 R3"], transmissions: ["MANUAL"] },

      // PERDANA
      { id: "proton-perdana-sei-1995", model: "Perdana", generation: "SEi (E50)", startYear: 1995, endYear: 1998, variants: ["2.0 SEi"] },
      { id: "proton-perdana-v6-1998", model: "Perdana", generation: "V6", startYear: 1998, endYear: 2002, variants: ["2.0 V6"], transmissions: ["AUTO"] },
      { id: "proton-perdana-v6-enhanced-2003", model: "Perdana", generation: "V6 Enhanced", startYear: 2003, endYear: 2010, variants: ["2.0 V6 Enhanced"], transmissions: ["AUTO"] },
      { id: "proton-perdana-cp-gov-2013", model: "Perdana", generation: "Accord-Based Government (CP)", startYear: 2013, endYear: 2015, variants: ["2.0 i-VTEC", "2.4 i-VTEC"], transmissions: ["AUTO"] },
      { id: "proton-perdana-p490b-2016", model: "Perdana", generation: "P4-90B", startYear: 2016, endYear: 2020, variants: ["2.0L", "2.4L"], transmissions: ["AUTO"] },

      // TIARA
      { id: "proton-tiara-1996", model: "Tiara", generation: "B31L", startYear: 1996, endYear: 2000, variants: ["1.1 GL", "1.1 GLi"], transmissions: ["MANUAL"] },

      // PUTRA
      { id: "proton-putra-1996", model: "Putra", generation: "C99D", startYear: 1996, endYear: 2004, variants: ["1.8 EXi"], transmissions: ["AUTO", "MANUAL"] },

      // WAJA
      { id: "proton-waja-mmc-2000", model: "Waja", generation: "MMC 4G18", startYear: 2000, endYear: 2005, variants: ["1.6 Standard", "1.6 Premium", "1.6X", "1.6 20th Anniversary"] },
      { id: "proton-waja-renault-2002", model: "Waja", generation: "Renault F4P", startYear: 2002, endYear: 2003, variants: ["1.8X"], transmissions: ["AUTO"] },
      { id: "proton-waja-chancellor-2005", model: "Waja", generation: "Chancellor LWB", startYear: 2005, endYear: 2006, variants: ["2.0 V6 Chancellor"], transmissions: ["AUTO"] },
      { id: "proton-waja-campro-2006", model: "Waja", generation: "CamPro", startYear: 2006, endYear: 2007, variants: ["1.6 CamPro Standard", "1.6 CamPro Premium"] },
      { id: "proton-waja-cps-2008", model: "Waja", generation: "CamPro CPS", startYear: 2008, endYear: 2011, variants: ["1.6 CPS M-Line", "1.6 CPS Premium"] },

      // JUARA
      { id: "proton-juara-2001", model: "Juara", generation: "U66W", startYear: 2001, endYear: 2004, variants: ["1.1 E"], transmissions: ["AUTO"] },

      // ARENA
      { id: "proton-arena-2002", model: "Arena", generation: "C97P", startYear: 2002, endYear: 2010, variants: ["1.5 Freestyle", "1.5 Sportdeck", "1.5 Fastback"], transmissions: ["MANUAL"] },

      // GEN-2
      { id: "proton-gen2-prefl-2004", model: "Gen-2", generation: "Pre-Facelift", startYear: 2004, endYear: 2007, variants: ["1.3 CamPro", "1.6 CamPro M-Line", "1.6 CamPro H-Line"] },
      { id: "proton-gen2-fl-2008", model: "Gen-2", generation: "Facelift", startYear: 2008, endYear: 2012, variants: ["1.6 IAFM M-Line", "1.6 CPS H-Line"] },

      // SAVVY
      { id: "proton-savvy-prefl-2005", model: "Savvy", generation: "Pre-Facelift", startYear: 2005, endYear: 2006, variants: ["1.2 L-Line", "1.2 M-Line"] },
      { id: "proton-savvy-fl-2007", model: "Savvy", generation: "Facelift", startYear: 2007, endYear: 2011, variants: ["1.2 Medium-Line", "1.2 High-Line"] },

      // SATRIA NEO
      { id: "proton-satria-neo-2006", model: "Satria Neo", generation: "Pre-CPS", startYear: 2006, endYear: 2008, variants: ["1.3 L-Line", "1.6 M-Line", "1.6 H-Line"] },
      { id: "proton-satria-neo-r3-2008", model: "Satria Neo", generation: "R3", startYear: 2008, endYear: 2009, variants: ["1.6 R3"], transmissions: ["MANUAL"] },
      { id: "proton-satria-neo-cps-2009", model: "Satria Neo", generation: "CPS", startYear: 2009, endYear: 2015, variants: ["1.6 M-Line", "1.6 H-Line CPS"] },
      { id: "proton-satria-neo-r3-lotus-2010", model: "Satria Neo", generation: "R3 Lotus Racing", startYear: 2010, endYear: 2010, variants: ["1.6 R3 Lotus Racing"], transmissions: ["MANUAL"] },
      { id: "proton-satria-neo-r3-rs-2011", model: "Satria Neo", generation: "R3 RS", startYear: 2011, endYear: 2012, variants: ["1.6 CPS R3 RS"], transmissions: ["MANUAL"] },

      // PERSONA
      { id: "proton-persona-cm-2007", model: "Persona", generation: "CM", startYear: 2007, endYear: 2009, variants: ["1.6 Base-Line", "1.6 Medium-Line", "1.6 High-Line", "1.6 SE"] },
      { id: "proton-persona-elegance-2010", model: "Persona", generation: "Elegance", startYear: 2010, endYear: 2012, variants: ["1.6 Base-Line", "1.6 Medium-Line", "1.6 High-Line"] },
      { id: "proton-persona-sv-2013", model: "Persona", generation: "SV / Late CM", startYear: 2013, endYear: 2016, variants: ["1.6 SV", "1.6 Executive"] },
      { id: "proton-persona-bh-2016", model: "Persona", generation: "BH", startYear: 2016, endYear: 2018, variants: ["1.6 Standard", "1.6 Executive", "1.6 Premium"] },
      { id: "proton-persona-mc1-2019", model: "Persona", generation: "BH Facelift (MC1)", startYear: 2019, endYear: 2020, variants: ["1.6 Standard", "1.6 Executive", "1.6 Premium"] },
      { id: "proton-persona-mc2-2021", model: "Persona", generation: "BH MC2", startYear: 2021, endYear: 2026, variants: ["1.6 Standard", "1.6 Executive", "1.6 Premium", "1.6 Black Edition"] },

      // EXORA
      { id: "proton-exora-cps-2009", model: "Exora", generation: "CPS", startYear: 2009, endYear: 2011, variants: ["1.6 B-Line / Standard", "1.6 M-Line", "1.6 H-Line"] },
      { id: "proton-exora-bold-2011", model: "Exora", generation: "Bold", startYear: 2011, endYear: 2014, variants: ["1.6 Standard CPS", "1.6 Bold Executive CPS", "1.6 Bold Premium CFE", "1.6 Prime CFE"] },
      { id: "proton-exora-bold-mc-2015", model: "Exora", generation: "Bold MC", startYear: 2015, endYear: 2018, variants: ["1.6 Executive CFE", "1.6 Premium CFE"], transmissions: ["AUTO"] },
      { id: "proton-exora-rc-2019", model: "Exora", generation: "RC", startYear: 2019, endYear: 2021, variants: ["1.6 Executive CFE", "1.6 Premium CFE"], transmissions: ["AUTO"] },
      { id: "proton-exora-rc2-2022", model: "Exora", generation: "RC2", startYear: 2022, endYear: 2023, variants: ["1.6 Executive CFE", "1.6 Premium CFE"], transmissions: ["AUTO"] },

      // INSPIRA
      { id: "proton-inspira-2010", model: "Inspira", generation: "CY3S / CY4S", startYear: 2010, endYear: 2013, variants: ["1.8 Executive", "2.0 Premium"] },
      { id: "proton-inspira-late-2014", model: "Inspira", generation: "Late Model", startYear: 2014, endYear: 2015, variants: ["1.8", "2.0 Executive", "2.0 Premium", "2.0 Super Premium"] },

      // PREVÉ
      { id: "proton-preve-2012", model: "Prevé", generation: "P3-21A", startYear: 2012, endYear: 2018, variants: ["1.6 Executive IAFM+", "1.6 Premium CFE"], transmissions: ["AUTO", "MANUAL"] },

      // SUPRIMA S
      { id: "proton-suprima-s-2013", model: "Suprima S", generation: "P3-22A", startYear: 2013, endYear: 2019, variants: ["1.6 Standard CFE", "1.6 Executive CFE", "1.6 Premium CFE", "1.6 Super Premium"], transmissions: ["AUTO"] },

      // IRIZ
      { id: "proton-iriz-2014", model: "Iriz", generation: "BH (Launch)", startYear: 2014, endYear: 2016, variants: ["1.3 Standard", "1.3 Executive", "1.6 Executive", "1.6 Premium"] },
      { id: "proton-iriz-rc-2017", model: "Iriz", generation: "2017 RC", startYear: 2017, endYear: 2018, variants: ["1.3 Standard", "1.3 Executive", "1.6 Premium"] },
      { id: "proton-iriz-mc1-2019", model: "Iriz", generation: "MC1 Facelift", startYear: 2019, endYear: 2020, variants: ["1.3 Standard", "1.3 Executive", "1.6 Executive", "1.6 Premium"] },
      { id: "proton-iriz-mc2-2021", model: "Iriz", generation: "MC2", startYear: 2021, endYear: 2025, variants: ["1.3 Standard", "1.6 Executive", "1.6 Active"], transmissions: ["AUTO"] },

      // ERTIGA
      { id: "proton-ertiga-2016", model: "Ertiga", generation: "P6-90A", startYear: 2016, endYear: 2017, variants: ["1.4 Executive", "1.4 Executive Plus"] },
      { id: "proton-ertiga-xtra-2018", model: "Ertiga", generation: "Xtra", startYear: 2018, endYear: 2019, variants: ["1.4 Executive", "1.4 Executive Plus"] },

      // X70
      { id: "proton-x70-cbu-2018", model: "X70", generation: "CBU", startYear: 2018, endYear: 2019, variants: ["1.8 TGDi Standard 2WD", "1.8 TGDi Executive 2WD", "1.8 TGDi Executive AWD", "1.8 TGDi Premium 2WD"], transmissions: ["AUTO"] },
      { id: "proton-x70-ckd-2020", model: "X70", generation: "CKD", startYear: 2020, endYear: 2021, variants: ["1.8 TGDi Standard 2WD", "1.8 TGDi Executive 2WD", "1.8 TGDi Premium 2WD", "1.8 TGDi Premium X 2WD"], transmissions: ["AUTO"] },
      { id: "proton-x70-mc1-2022", model: "X70", generation: "MC1", startYear: 2022, endYear: 2023, variants: ["1.5 TGDi Standard 2WD", "1.5 TGDi Executive 2WD", "1.5 TGDi Executive AWD", "1.5 TGDi Premium 2WD", "1.8 TGDi Premium 2WD"], transmissions: ["AUTO"] },
      { id: "proton-x70-2025-2024", model: "X70", generation: "2025 Facelift", startYear: 2024, variants: ["1.5 TGDi Standard", "1.5 TGDi Executive", "1.5 TGDi Premium", "1.5 TGDi Premium X"], transmissions: ["AUTO"] },
      { id: "proton-x70-se-2026", model: "X70", generation: "Sport Edition", startYear: 2026, endYear: 2026, variants: ["1.5 TGDi Sport Edition"], transmissions: ["AUTO"] },

      // X50
      { id: "proton-x50-2020", model: "X50", generation: "Gen 1", startYear: 2020, endYear: 2024, variants: ["1.5T Standard", "1.5T Executive", "1.5T Premium", "1.5 TGDi Flagship"], transmissions: ["AUTO"] },
      { id: "proton-x50-se-2025", model: "X50", generation: "Sport Edition", startYear: 2025, endYear: 2025, variants: ["1.5T Sport Edition"], transmissions: ["AUTO"] },
      { id: "proton-x50-allnew-2025", model: "X50", generation: "All-New", startYear: 2025, variants: ["1.5 i-GT Executive", "1.5 i-GT Premium", "1.5 i-GT Flagship"], transmissions: ["AUTO"] },

      // X90
      { id: "proton-x90-2023", model: "X90", generation: "Launch Model", startYear: 2023, endYear: 2025, variants: ["1.5 TGDi BSG Standard", "1.5 TGDi BSG Executive", "1.5 TGDi BSG Premium", "1.5 TGDi BSG Flagship"], transmissions: ["AUTO"] },
      { id: "proton-x90-2026", model: "X90", generation: "2026 Update", startYear: 2026, variants: ["1.5TD Lite", "1.5TD Prime", "1.5TD Prime X"], transmissions: ["AUTO"] },

      // S70
      { id: "proton-s70-2023", model: "S70", generation: "Launch Model", startYear: 2023, endYear: 2025, variants: ["1.5T Executive", "1.5T Premium", "1.5T Flagship", "1.5T Flagship X"], transmissions: ["AUTO"] },
      { id: "proton-s70-2026", model: "S70", generation: "2026 Expanded Range", startYear: 2026, variants: ["1.5 i-GT Lite", "1.5 i-GT Prime", "1.5T Executive", "1.5T Premium", "1.5T Flagship", "1.5T Flagship X"], transmissions: ["AUTO"] },

      // PROTON e.MAS
      { id: "proton-emas7-2024", model: "e.MAS 7", generation: "Launch Model", startYear: 2024, endYear: 2025, variants: ["Prime", "Premium"], transmissions: ["AUTO"] },
      { id: "proton-emas7-2026", model: "e.MAS 7", generation: "2026 Update", startYear: 2026, variants: ["Prime", "Premium"], transmissions: ["AUTO"] },
      { id: "proton-emas5-2025", model: "e.MAS 5", generation: "Launch Model", startYear: 2025, variants: ["Prime", "Premium"], transmissions: ["AUTO"] },
      { id: "proton-emas7-phev-2026", model: "e.MAS 7 PHEV", generation: "Launch Model", startYear: 2026, variants: ["Prime", "Premium", "Premium Plus"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Toyota",
    vehicles: [
      { id: "toyota-vios-ncp42-2002", model: "Vios", generation: "NCP42 (Gen 1)", startYear: 2002, endYear: 2007, variants: ["1.5 E", "1.5 G", "1.5 Special Edition"] },
      { id: "toyota-vios-ncp93-2007", model: "Vios", generation: "NCP93 (Gen 2)", startYear: 2007, endYear: 2013, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 TRD Sportivo"] },
      { id: "toyota-vios-ncp150-2013", model: "Vios", generation: "NCP150 (Gen 3)", startYear: 2013, endYear: 2015, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 TRD Sportivo"] },
      { id: "toyota-vios-nsp151-2016", model: "Vios", generation: "NSP151", startYear: 2016, endYear: 2018, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 GX"] },
      { id: "toyota-vios-nsp151-fl1-2019", model: "Vios", generation: "NSP151 Facelift", startYear: 2019, endYear: 2019, variants: ["1.5 J", "1.5 E", "1.5 G"] },
      { id: "toyota-vios-nsp151-fl2-2020", model: "Vios", generation: "NSP151 Facelift 2", startYear: 2020, endYear: 2022, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 GR Sport"] },
      { id: "toyota-vios-ngc102-2023", model: "Vios", generation: "NGC102 / AC100 (Gen 4)", startYear: 2023, variants: ["1.5 E", "1.5 G"], transmissions: ["AUTO"] },

      { id: "toyota-camry-xv20-1997", model: "Camry", generation: "XV20 (Gen 4)", startYear: 1997, endYear: 2002, variants: ["2.2 GLi", "2.2 Crown", "3.0 V6"] },
      { id: "toyota-camry-xv30-2002", model: "Camry", generation: "XV30 (Gen 5)", startYear: 2002, endYear: 2006, variants: ["2.0E", "2.0G", "2.4G"] },
      { id: "toyota-camry-xv40-2006", model: "Camry", generation: "XV40 (Gen 6)", startYear: 2006, endYear: 2012, variants: ["2.0E", "2.0G", "2.4V"] },
      { id: "toyota-camry-xv50-2012", model: "Camry", generation: "XV50 (Gen 7)", startYear: 2012, endYear: 2014, variants: ["2.0E", "2.0G", "2.5V", "2.5 Hybrid"] },
      { id: "toyota-camry-xv50-fl-2015", model: "Camry", generation: "XV50 Facelift", startYear: 2015, endYear: 2017, variants: ["2.0E", "2.0G", "2.5 Hybrid"] },
      { id: "toyota-camry-xv70-2018", model: "Camry", generation: "XV70 (Gen 8)", startYear: 2018, endYear: 2021, variants: ["2.5V"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv70-fl-2022", model: "Camry", generation: "XV70 Facelift", startYear: 2022, endYear: 2023, variants: ["2.5V Dynamic Force"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv80-2024", model: "Camry", generation: "XV80 (Gen 9)", startYear: 2024, variants: ["2.5 HEV", "2.5 HEV GR Sport"], transmissions: ["AUTO"] },

      { id: "toyota-altis-e120-2001", model: "Corolla Altis", generation: "E120", startYear: 2001, endYear: 2008, variants: ["1.6E", "1.8G"] },
      { id: "toyota-altis-e140-2008", model: "Corolla Altis", generation: "E140 / E150", startYear: 2008, endYear: 2013, variants: ["1.6E", "1.8E", "1.8G", "2.0V"] },
      { id: "toyota-altis-e170-2013", model: "Corolla Altis", generation: "E170", startYear: 2013, endYear: 2019, variants: ["1.8E", "1.8G", "2.0V"] },
      { id: "toyota-altis-e210-2019", model: "Corolla Altis", generation: "E210", startYear: 2019, variants: ["1.8E", "1.8G", "1.8 GR Sport"], transmissions: ["AUTO"] },

      { id: "toyota-hilux-vigo-2005", model: "Hilux", generation: "Vigo N70", startYear: 2005, endYear: 2010, variants: ["2.5 D-4D", "3.0 D-4D"] },
      { id: "toyota-hilux-vigo-fl-2011", model: "Hilux", generation: "Vigo N70 Facelift", startYear: 2011, endYear: 2015, variants: ["2.5 D-4D", "3.0 D-4D"] },
      { id: "toyota-hilux-revo-2016", model: "Hilux", generation: "Revo N80", startYear: 2016, endYear: 2017, variants: ["2.4 Single Cab", "2.4 E", "2.4 G", "2.8 G"] },
      { id: "toyota-hilux-revo-fl1-2018", model: "Hilux", generation: "Revo N80 Facelift", startYear: 2018, endYear: 2019, variants: ["2.4 E", "2.4 G", "2.8 L-Edition"] },
      { id: "toyota-hilux-revo-fl2-2020", model: "Hilux", generation: "Revo N80 Facelift 2", startYear: 2020, endYear: 2025, variants: ["2.4 Single Cab", "2.4 E", "2.4 G", "2.8 Rogue", "2.8 GR Sport"] },
      { id: "toyota-hilux-an220-2026", model: "Hilux", generation: "AN220 / AN230", startYear: 2026, variants: ["2.8"], transmissions: ["AUTO"] },

      { id: "toyota-corolla-cross-xg10-2021", model: "Corolla Cross", generation: "XG10", startYear: 2021, endYear: 2023, variants: ["1.8 G", "1.8 V", "1.8 Hybrid", "1.8 GR Sport"], transmissions: ["AUTO"] },
      { id: "toyota-corolla-cross-xg10-fl-2024", model: "Corolla Cross", generation: "XG10 Facelift", startYear: 2024, variants: ["1.8 V", "1.8 HEV", "1.8 HEV GR Sport"], transmissions: ["AUTO"] },
      { id: "toyota-alphard-vellfire-ah20-2008", model: "Alphard / Vellfire", generation: "AH20 / ANH20", startYear: 2008, endYear: 2015, variants: ["2.4 X", "2.4 Z", "2.4 G", "3.5 V6"] },
      { id: "toyota-alphard-vellfire-ah30-2015", model: "Alphard / Vellfire", generation: "AH30 / AGH30", startYear: 2015, endYear: 2022, variants: ["2.5 X", "2.5 Z", "2.5 ZG", "3.5 V6", "Executive Lounge"] },
      { id: "toyota-alphard-vellfire-ah40-2023", model: "Alphard / Vellfire", generation: "AH40", startYear: 2023, variants: ["Alphard 2.4T Executive Lounge", "Vellfire 2.5"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Honda",
    vehicles: [
      { id: "honda-city-gd-2002", model: "City", generation: "GD8 / GD3", startYear: 2002, endYear: 2008, variants: ["1.5 i-DSI", "1.5 VTEC"] },
      { id: "honda-city-gm23-2008", model: "City", generation: "GM2 / GM3", startYear: 2008, endYear: 2014, variants: ["1.5 S", "1.5 E", "1.5 V"] },
      { id: "honda-city-gm6-2014", model: "City", generation: "GM6", startYear: 2014, endYear: 2020, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 Hybrid"], transmissions: ["AUTO"] },
      { id: "honda-city-gn2-2020", model: "City", generation: "GN2", startYear: 2020, endYear: 2022, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 RS e:HEV"], transmissions: ["AUTO"] },
      { id: "honda-city-gn2-fl-2023", model: "City", generation: "GN2 Facelift", startYear: 2023, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 RS", "1.5 RS e:HEV"], transmissions: ["AUTO"] },

      { id: "honda-civic-fd-2006", model: "Civic", generation: "FD (FD1/FD2)", startYear: 2006, endYear: 2011, variants: ["1.8 i-VTEC", "2.0 i-VTEC", "Type R (FD2R)"] },
      { id: "honda-civic-fb-2012", model: "Civic", generation: "FB", startYear: 2012, endYear: 2016, variants: ["1.8 S", "2.0 S", "2.0 Navi", "Hybrid"] },
      { id: "honda-civic-fc-2016", model: "Civic", generation: "FC", startYear: 2016, endYear: 2021, variants: ["1.8 S", "1.5 Turbo TC", "1.5 Turbo TC-P"], transmissions: ["AUTO"] },
      { id: "honda-civic-fe-2022", model: "Civic", generation: "FE", startYear: 2022, endYear: 2024, variants: ["1.5 E", "1.5 V", "1.5 RS", "2.0 e:HEV RS"], transmissions: ["AUTO"] },
      { id: "honda-civic-fe-fl-2025", model: "Civic", generation: "FE Facelift", startYear: 2025, variants: ["1.5 E", "1.5 V", "1.5 RS", "2.0 e:HEV RS"], transmissions: ["AUTO"] },
      { id: "honda-civic-fl5-2023", model: "Civic Type R", generation: "FL5", startYear: 2023, variants: ["2.0 Turbo Type R"], transmissions: ["MANUAL"] },

      { id: "honda-hrv-ru-2015", model: "HR-V", generation: "RU", startYear: 2015, endYear: 2018, variants: ["1.8 S", "1.8 E", "1.8 V"], transmissions: ["AUTO"] },
      { id: "honda-hrv-ru-fl-2019", model: "HR-V", generation: "RU Facelift", startYear: 2019, endYear: 2021, variants: ["1.8 E", "1.8 V", "1.8 RS", "1.5 Hybrid"], transmissions: ["AUTO"] },
      { id: "honda-hrv-rv-2022", model: "HR-V", generation: "RV", startYear: 2022, endYear: 2024, variants: ["1.5 S", "1.5 Turbo E", "1.5 Turbo V", "1.5 RS e:HEV"], transmissions: ["AUTO"] },
      { id: "honda-hrv-rv-fl-2025", model: "HR-V", generation: "RV Facelift", startYear: 2025, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 e:HEV RS"], transmissions: ["AUTO"] },

      { id: "honda-crv-rm-2013", model: "CR-V", generation: "RM", startYear: 2013, endYear: 2014, variants: ["2.0 i-VTEC", "2.4 i-VTEC"], transmissions: ["AUTO"] },
      { id: "honda-crv-rm-fl-2015", model: "CR-V", generation: "RM Facelift", startYear: 2015, endYear: 2016, variants: ["2.0 i-VTEC", "2.4 i-VTEC"], transmissions: ["AUTO"] },
      { id: "honda-crv-rw-2017", model: "CR-V", generation: "RW", startYear: 2017, endYear: 2019, variants: ["2.0 i-VTEC", "1.5 Turbo", "1.5 Turbo Premium"], transmissions: ["AUTO"] },
      { id: "honda-crv-rw-fl-2020", model: "CR-V", generation: "RW Facelift", startYear: 2020, endYear: 2022, variants: ["2.0 i-VTEC", "1.5 Turbo", "1.5 Turbo Premium"], transmissions: ["AUTO"] },
      { id: "honda-crv-ry-2023", model: "CR-V", generation: "RY", startYear: 2023, variants: ["1.5 Turbo S", "1.5 Turbo E", "1.5 Turbo V", "2.0 e:HEV E", "2.0 e:HEV RS"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Nissan",
    vehicles: [
      { id: "nissan-almera-n17-2012", model: "Almera", generation: "N17", startYear: 2012, endYear: 2020, variants: ["1.5 E", "1.5 V", "1.5 VL"] },
      { id: "nissan-almera-n18-2020", model: "Almera", generation: "N18", startYear: 2020, variants: ["1.0 Turbo VL", "1.0 Turbo VLP", "1.0 Turbo VLT"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c26-2013", model: "Serena", generation: "C26 S-Hybrid", startYear: 2013, endYear: 2017, variants: ["2.0 S-Hybrid Highway Star", "2.0 S-Hybrid Premium"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c27-2018", model: "Serena", generation: "C27 S-Hybrid", startYear: 2018, endYear: 2021, variants: ["2.0 S-Hybrid Highway Star", "2.0 S-Hybrid Premium Highway Star"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c27-fl-2022", model: "Serena", generation: "C27 Facelift", startYear: 2022, endYear: 2025, variants: ["2.0 S-Hybrid Highway Star", "2.0 S-Hybrid Premium Highway Star"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c28-2026", model: "Serena", generation: "C28 e-POWER", startYear: 2026, variants: ["X", "X Plus", "Highway Star", "Premium Highway Star", "Shiro Premium Highway Star"], transmissions: ["AUTO"] },

      { id: "nissan-navara-d40-2008", model: "Navara", generation: "D40", startYear: 2008, endYear: 2012, variants: ["2.5 SE", "2.5 LE"] },
      { id: "nissan-navara-d40-fl-2013", model: "Navara", generation: "D40 Facelift", startYear: 2013, endYear: 2014, variants: ["2.5 SE", "2.5 LE"] },
      { id: "nissan-navara-d23-2015", model: "Navara", generation: "NP300 D23", startYear: 2015, endYear: 2020, variants: ["2.5 SE", "2.5 V", "2.5 VL"] },
      { id: "nissan-navara-d23-fl-2021", model: "Navara", generation: "D23 Facelift", startYear: 2021, variants: ["2.5 SE", "2.5 V", "2.5 VL", "2.5 PRO-4X"] },
    ],
  },
  {
    make: "Mazda",
    vehicles: [
      { id: "mazda-3-bm-2014", model: "Mazda 3", generation: "BM", startYear: 2014, endYear: 2016, variants: ["2.0 Skyactiv-G"], transmissions: ["AUTO"] },
      { id: "mazda-3-bm-fl-2017", model: "Mazda 3", generation: "BM Facelift / BN", startYear: 2017, endYear: 2018, variants: ["2.0 Skyactiv-G"], transmissions: ["AUTO"] },
      { id: "mazda-3-bp-2019", model: "Mazda 3", generation: "BP", startYear: 2019, variants: ["1.5 High Plus", "2.0 High", "2.0 High Plus", "2.0 Ignite Edition"], transmissions: ["AUTO"] },

      { id: "mazda-cx5-ke-2012", model: "CX-5", generation: "KE / Mk1", startYear: 2012, endYear: 2014, variants: ["2.0 Skyactiv-G", "2.5 Skyactiv-G"], transmissions: ["AUTO"] },
      { id: "mazda-cx5-ke-fl-2015", model: "CX-5", generation: "KE / Mk1 Facelift", startYear: 2015, endYear: 2016, variants: ["2.0 Skyactiv-G", "2.5 Skyactiv-G", "2.2 Diesel"], transmissions: ["AUTO"] },
      { id: "mazda-cx5-kf-2017", model: "CX-5", generation: "KF", startYear: 2017, endYear: 2023, variants: ["2.0", "2.5", "2.2 Diesel", "2.5 Turbo"], transmissions: ["AUTO"] },
      { id: "mazda-cx5-kf-fl-2024", model: "CX-5", generation: "KF Facelift", startYear: 2024, variants: ["2.0 Mid", "2.0 High", "2.5 High", "2.2D High", "2.5T High AWD"], transmissions: ["AUTO"] },
      { id: "mazda-cx30-dm-2020", model: "CX-30", generation: "DM", startYear: 2020, variants: ["2.0 Core", "2.0 High", "2.0 High Plus"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Lexus",
    vehicles: [
      { id: "lexus-rx-al10-fl-2012", model: "RX", generation: "AL10 Facelift", startYear: 2012, endYear: 2014, variants: ["RX 270", "RX 350", "RX 450h"], transmissions: ["AUTO"] },
      { id: "lexus-rx-al20-2015", model: "RX", generation: "AL20", startYear: 2015, endYear: 2018, variants: ["RX 200t", "RX 300", "RX 350"], transmissions: ["AUTO"] },
      { id: "lexus-rx-al20-fl-2019", model: "RX", generation: "AL20 Facelift", startYear: 2019, endYear: 2022, variants: ["RX 300", "RX 350", "RX 450h"], transmissions: ["AUTO"] },
      { id: "lexus-rx-ala10-2023", model: "RX", generation: "ALA10", startYear: 2023, variants: ["RX 350 Luxury", "RX 500h F Sport"], transmissions: ["AUTO"] },

      { id: "lexus-nx-az10-2015", model: "NX", generation: "AZ10", startYear: 2015, endYear: 2017, variants: ["NX 200t", "NX 300h"], transmissions: ["AUTO"] },
      { id: "lexus-nx-az10-fl-2018", model: "NX", generation: "AZ10 Facelift", startYear: 2018, endYear: 2021, variants: ["NX 300", "NX 300h"], transmissions: ["AUTO"] },
      { id: "lexus-nx-az20-2022", model: "NX", generation: "AZ20", startYear: 2022, variants: ["NX 250", "NX 350h Luxury", "NX 350 F Sport"], transmissions: ["AUTO"] },
    ],
  },
];

export const popularVehicleIds = [
  "perodua-myvi-m800-fl-2021",
  "perodua-bezza-fl-2020",
  "perodua-axia-dnga-2023",
  "proton-saga-mc2-2022",
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
