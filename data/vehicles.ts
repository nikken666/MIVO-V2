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
      { id: "perodua-kembara-hc-hd-1998", model: "Kembara", generation: "Old Model (HC / HD)", startYear: 1998, endYear: 2003, variants: ["1.3 EX", "1.3 GX", "1.3 EZ"], transmissions: ["AUTO", "MANUAL"] },
      { id: "perodua-kembara-dvvt-2003", model: "Kembara", generation: "DVVT", startYear: 2003, endYear: 2007, variants: ["1.3 EX", "1.3 GX", "1.3 EZ"], transmissions: ["AUTO", "MANUAL"] },
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

      // ARENA
      { id: "proton-arena-2002", model: "Arena", generation: "C97P", startYear: 2002, endYear: 2010, variants: ["1.5 Freestyle", "1.5 Sportdeck", "1.5 Fastback"], transmissions: ["MANUAL"] },

      // GEN-2
      { id: "proton-gen2-prefl-2004", model: "Gen-2", generation: "Pre-Facelift", startYear: 2004, endYear: 2007, variants: ["1.3 CamPro", "1.6 CamPro M-Line", "1.6 CamPro H-Line"] },
      { id: "proton-gen2-fl-iafm-2008", model: "Gen-2", generation: "Facelift IAFM", startYear: 2008, endYear: 2012, variants: ["1.6 IAFM M-Line"] },
      { id: "proton-gen2-fl-cps-2008", model: "Gen-2", generation: "Facelift CPS", startYear: 2008, endYear: 2012, variants: ["1.6 CPS H-Line"] },

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
      { id: "proton-persona-cm-2007", model: "Persona", generation: "CM", startYear: 2007, endYear: 2009, variants: ["1.6 CamPro Base-Line", "1.6 CamPro / IAFM Medium-Line", "1.6 CamPro / IAFM High-Line", "1.6 IAFM SE"] },
      { id: "proton-persona-elegance-2010", model: "Persona", generation: "Elegance (IAFM)", startYear: 2010, endYear: 2012, variants: ["1.6 IAFM Base-Line", "1.6 IAFM Medium-Line", "1.6 IAFM High-Line"] },
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
    modelOrder: [
      "Corolla",
      "Corona",
      "Hilux",
      "Hiace",
      "Land Cruiser",
      "Camry",
      "Unser",
      "Estima / Previa",
      "Land Cruiser Prado",
      "Harrier",
      "RAV4",
      "Prius",
      "Prius C",
      "86",
      "Crown",
      "GR Supra",
      "GR Yaris",
      "GR86",
      "GR Corolla",
      "Vios",
      "Yaris",
      "Avanza",
      "Wish",
      "Voxy",
      "Innova",
      "Fortuner",
      "Alphard",
      "Vellfire",
      "Rush",
      "Sienta",
      "C-HR",
      "Corolla Altis",
      "Corolla Cross",
      "Veloz",
      "Yaris Cross",
      "Innova Zenix",
    ],
    vehicles: [
      // COROLLA — classic Malaysia-market generations
      { id: "toyota-corolla-ke20-1970", model: "Corolla", generation: "KE20 / KE25", startYear: 1970, endYear: 1974, variants: ["1.2 Sedan", "1.2 Coupe"], transmissions: ["MANUAL"] },
      { id: "toyota-corolla-ke30-1974", model: "Corolla", generation: "KE30 / KE35 / KE36", startYear: 1974, endYear: 1979, variants: ["1.2 Sedan", "1.2 Coupe", "1.2 Wagon"], transmissions: ["MANUAL"] },
      { id: "toyota-corolla-ke70-1979", model: "Corolla", generation: "KE70 / AE70", startYear: 1979, endYear: 1983, variants: ["1.3 DX", "1.3 GL", "1.6"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-corolla-ae80-1984", model: "Corolla", generation: "AE80 / AE82", startYear: 1984, endYear: 1987, variants: ["1.3 DX", "1.3 GL", "1.6 GL", "1.6 GT"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-corolla-ae90-1988", model: "Corolla", generation: "AE90 / AE92", startYear: 1988, endYear: 1991, variants: ["1.3 XL", "1.6 SEG", "1.6 GTi"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-corolla-ae100-1992", model: "Corolla", generation: "AE100 / AE101", startYear: 1992, endYear: 1996, variants: ["1.3 XL", "1.6 SEG", "1.6 SEG Limited"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-corolla-ae110-1996", model: "Corolla", generation: "AE110 / AE111", startYear: 1996, endYear: 2001, variants: ["1.3 XL", "1.6 SEG", "1.6 SEG Limited"], transmissions: ["AUTO", "MANUAL"] },

      // CORONA
      { id: "toyota-corona-t130-1979", model: "Corona", generation: "T130", startYear: 1979, endYear: 1983, variants: ["1.8", "2.0"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-corona-t140-1983", model: "Corona", generation: "T140", startYear: 1983, endYear: 1987, variants: ["1.8", "2.0"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-corona-t170-1988", model: "Corona", generation: "T170", startYear: 1988, endYear: 1992, variants: ["1.6", "1.8", "2.0"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-corona-t190-1992", model: "Corona", generation: "T190 / Corona Absolute", startYear: 1992, endYear: 1996, variants: ["1.8", "2.0"], transmissions: ["AUTO", "MANUAL"] },

      // HILUX
      { id: "toyota-hilux-n50-1984", model: "Hilux", generation: "N50 / N60", startYear: 1984, endYear: 1988, variants: ["2.0 Petrol", "2.4 Diesel"], transmissions: ["MANUAL"] },
      { id: "toyota-hilux-n80-1989", model: "Hilux", generation: "N80 / N90", startYear: 1989, endYear: 1997, variants: ["2.0 Petrol", "2.4 Diesel", "2.8 Diesel"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hilux-tiger-1998", model: "Hilux", generation: "Tiger / N140-N170", startYear: 1998, endYear: 2004, variants: ["2.4 Diesel Single Cab", "2.4 Diesel Double Cab", "2.5 D-4D", "3.0 Diesel"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hilux-vigo-2005", model: "Hilux", generation: "Vigo N70", startYear: 2005, endYear: 2010, variants: ["2.5 D-4D Single Cab", "2.5 D-4D Double Cab", "3.0 D-4D Double Cab"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hilux-vigo-fl-2011", model: "Hilux", generation: "Vigo N70 Facelift", startYear: 2011, endYear: 2015, variants: ["2.5 D-4D Single Cab", "2.5 D-4D E", "2.5 D-4D G", "3.0 D-4D G", "3.0 D-4D VNT"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hilux-revo-2016", model: "Hilux", generation: "Revo N80", startYear: 2016, endYear: 2017, variants: ["2.4 Single Cab", "2.4 E", "2.4 G", "2.8 G"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hilux-revo-fl1-2018", model: "Hilux", generation: "Revo N80 Facelift", startYear: 2018, endYear: 2019, variants: ["2.4 Single Cab", "2.4 E", "2.4 G", "2.8 L-Edition"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hilux-revo-fl2-2020", model: "Hilux", generation: "Revo N80 Facelift 2", startYear: 2020, endYear: 2025, variants: ["2.4 Single Cab", "2.4 E", "2.4 G", "2.8 Rogue", "2.8 GR Sport"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hilux-an220-2026", model: "Hilux", generation: "AN220 / AN230", startYear: 2026, variants: ["2.8 Diesel", "D/Cab BEV", "2.8 GR Sport"], transmissions: ["AUTO"] },

      // HIACE
      { id: "toyota-hiace-h50-1983", model: "Hiace", generation: "H50 / H60", startYear: 1983, endYear: 1989, variants: ["2.0 Petrol Van", "2.4 Diesel Van"], transmissions: ["MANUAL"] },
      { id: "toyota-hiace-h100-1989", model: "Hiace", generation: "H100", startYear: 1989, endYear: 2004, variants: ["2.0 Petrol Panel Van", "2.4 Diesel", "3.0 Diesel"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hiace-h200-2005", model: "Hiace", generation: "H200", startYear: 2005, endYear: 2018, variants: ["2.5 Diesel Panel Van", "2.7 Petrol", "3.0 Diesel Commuter"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-hiace-h300-2019", model: "Hiace", generation: "H300", startYear: 2019, variants: ["2.8 Diesel Panel Van", "2.8 Diesel SLWB", "2.8 Diesel Super Long Wheelbase"], transmissions: ["AUTO", "MANUAL"] },

      // LAND CRUISER
      { id: "toyota-landcruiser-j70-1984", model: "Land Cruiser", generation: "J70", startYear: 1984, variants: ["4.2 Diesel", "4.5 Petrol", "2.8 Turbo Diesel"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-landcruiser-j80-1990", model: "Land Cruiser", generation: "J80", startYear: 1990, endYear: 1997, variants: ["4.2 Diesel", "4.5 Petrol"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-landcruiser-j100-1998", model: "Land Cruiser", generation: "J100", startYear: 1998, endYear: 2007, variants: ["4.2 Turbo Diesel", "4.7 V8"], transmissions: ["AUTO"] },
      { id: "toyota-landcruiser-j200-2008", model: "Land Cruiser", generation: "J200", startYear: 2008, endYear: 2021, variants: ["4.5 V8 Diesel", "4.6 V8 Petrol", "4.7 V8 Petrol", "5.7 V8 Petrol"], transmissions: ["AUTO"] },
      { id: "toyota-landcruiser-j300-2021", model: "Land Cruiser", generation: "J300", startYear: 2021, variants: ["3.3 Twin Turbo Diesel", "3.5 Twin Turbo Petrol", "GR Sport"], transmissions: ["AUTO"] },

      // CAMRY
      { id: "toyota-camry-v10-1983", model: "Camry", generation: "V10", startYear: 1983, endYear: 1986, variants: ["1.8", "2.0"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-camry-v20-1987", model: "Camry", generation: "V20", startYear: 1987, endYear: 1991, variants: ["1.8", "2.0"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-camry-xv10-1992", model: "Camry", generation: "XV10", startYear: 1992, endYear: 1996, variants: ["2.2 GX", "3.0 V6"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv20-1997", model: "Camry", generation: "XV20", startYear: 1997, endYear: 2001, variants: ["2.2 GL", "2.2 GX", "3.0 V6"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv30-2002", model: "Camry", generation: "XV30", startYear: 2002, endYear: 2006, variants: ["2.0E", "2.0G", "2.4G", "3.0V"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv40-2006", model: "Camry", generation: "XV40", startYear: 2006, endYear: 2011, variants: ["2.0E", "2.0G", "2.4V"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv50-2012", model: "Camry", generation: "XV50", startYear: 2012, endYear: 2014, variants: ["2.0E", "2.0G", "2.5V", "2.5 Hybrid"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv50-fl-2015", model: "Camry", generation: "XV50 Facelift", startYear: 2015, endYear: 2017, variants: ["2.0E", "2.0G X", "2.0G", "2.5 Hybrid"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv70-2018", model: "Camry", generation: "XV70", startYear: 2018, endYear: 2021, variants: ["2.5V"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv70-fl-2022", model: "Camry", generation: "XV70 Facelift", startYear: 2022, endYear: 2023, variants: ["2.5V Dynamic Force"], transmissions: ["AUTO"] },
      { id: "toyota-camry-xv80-2024", model: "Camry", generation: "XV80", startYear: 2024, variants: ["2.5V", "2.5 HEV", "2.5 HEV GR Sport"], transmissions: ["AUTO"] },

      // UNSER
      { id: "toyota-unser-kf60-1998", model: "Unser", generation: "KF60", startYear: 1998, endYear: 2000, variants: ["1.8 GLi", "1.8 LGX"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-unser-kf80-2001", model: "Unser", generation: "KF80", startYear: 2001, endYear: 2004, variants: ["1.8 GLi", "1.8 LGX"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-unser-kf80-fl-2005", model: "Unser", generation: "KF80 Facelift", startYear: 2005, endYear: 2007, variants: ["1.8 GLi", "1.8 LGX"], transmissions: ["AUTO", "MANUAL"] },

      // ESTIMA / PREVIA
      { id: "toyota-estima-xr10-1990", model: "Estima / Previa", generation: "XR10 / XR20", startYear: 1990, endYear: 1999, variants: ["2.4 Petrol 2WD (TCR10)","2.4 Petrol 4WD (TCR20)","2.2 Diesel 2WD (CXR10)","2.2 Diesel 4WD (CXR20)"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-estima-xr30-2000", model: "Estima / Previa", generation: "XR30 / XR40", startYear: 2000, endYear: 2005, variants: ["2.4 2WD (ACR30)","2.4 4WD (ACR40)","3.0 V6 2WD (MCR30)","3.0 V6 4WD (MCR40)","2.4 Hybrid 4WD (AHR10)"], transmissions: ["AUTO"] },
      { id: "toyota-estima-xr50-2006", model: "Estima / Previa", generation: "XR50", startYear: 2006, endYear: 2015, variants: ["2.4 Aeras 2WD (ACR50)","2.4 Aeras 4WD (ACR55)","3.5 V6 Aeras 2WD (GSR50)","3.5 V6 Aeras 4WD (GSR55)","2.4 Hybrid E-Four 4WD (AHR20)"], transmissions: ["AUTO"] },
      { id: "toyota-estima-xr50-fl-2016", model: "Estima / Previa", generation: "XR50 Facelift", startYear: 2016, endYear: 2019, variants: ["2.4 Aeras 2WD (ACR50)","2.4 Aeras 4WD (ACR55)","2.4 Aeras Premium 2WD (ACR50)","2.4 Aeras Premium 4WD (ACR55)","2.4 Hybrid E-Four 4WD (AHR20)"], transmissions: ["AUTO"] },

      // LAND CRUISER PRADO
      { id: "toyota-prado-j90-1996", model: "Land Cruiser Prado", generation: "J90", startYear: 1996, endYear: 2002, variants: ["2.7 Petrol", "3.0 Turbo Diesel", "3.4 V6"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-prado-j120-2003", model: "Land Cruiser Prado", generation: "J120", startYear: 2003, endYear: 2009, variants: ["2.7 Petrol", "3.0 D-4D", "4.0 V6"], transmissions: ["AUTO"] },
      { id: "toyota-prado-j150-2010", model: "Land Cruiser Prado", generation: "J150", startYear: 2010, endYear: 2023, variants: ["2.7 Petrol", "2.8 Turbo Diesel", "3.0 D-4D", "4.0 V6"], transmissions: ["AUTO"] },
      { id: "toyota-prado-j250-2024", model: "Land Cruiser Prado", generation: "J250", startYear: 2024, variants: ["2.7 Petrol", "2.8 Turbo Diesel", "2.4 Turbo Hybrid"], transmissions: ["AUTO"] },

      // HARRIER
      { id: "toyota-harrier-xu10-1998", model: "Harrier", generation: "XU10", startYear: 1998, endYear: 2002, variants: ["2.2 2WD (SXU10)","2.2 4WD (SXU15)","2.4 2WD (ACU10)","2.4 4WD (ACU15)","3.0 V6 2WD (MCU10)","3.0 V6 4WD (MCU15)"], transmissions: ["AUTO"] },
      { id: "toyota-harrier-xu30-2003", model: "Harrier", generation: "XU30", startYear: 2003, endYear: 2012, variants: ["2.4 2WD (ACU30)","2.4 4WD (ACU35)","3.0 V6 2WD (MCU30)","3.0 V6 4WD (MCU35)","3.5 V6 2WD (GSU30)","3.5 V6 4WD (GSU35)","3.3 Hybrid 4WD (MHU38)"], transmissions: ["AUTO"] },
      { id: "toyota-harrier-xu60-2013", model: "Harrier", generation: "XU60", startYear: 2013, endYear: 2016, variants: ["2.0 Elegance 2WD (ZSU60)","2.0 Elegance 4WD (ZSU65)","2.0 Premium 2WD (ZSU60)","2.0 Premium 4WD (ZSU65)","2.5 Hybrid E-Four 4WD (AVU65)"], transmissions: ["AUTO"] },
      { id: "toyota-harrier-xu60-fl-2017", model: "Harrier", generation: "XU60 Facelift", startYear: 2017, endYear: 2020, variants: ["2.0 Elegance 2WD (ZSU60)","2.0 Elegance 4WD (ZSU65)","2.0 Premium 2WD (ZSU60)","2.0 Premium 4WD (ZSU65)","2.0 Turbo 2WD (ASU60)","2.0 Turbo 4WD (ASU65)","2.5 Hybrid E-Four 4WD (AVU65)"], transmissions: ["AUTO"] },
      { id: "toyota-harrier-xu80-2021", model: "Harrier", generation: "XU80", startYear: 2021, endYear: 2025, variants: ["2.0 Luxury 2WD (MXUA80)","2.0 Luxury 4WD (MXUA85)","2.0 Luxury SE 2WD (MXUA80)","2.0 Luxury SE 4WD (MXUA85)"], transmissions: ["AUTO"] },
      { id: "toyota-harrier-xu80-hev-2026", model: "Harrier", generation: "XU80 Hybrid Electric", startYear: 2026, variants: ["2.5 HEV Luxury 2WD (AXUH80)","2.5 HEV Luxury E-Four 4WD (AXUH85)"], transmissions: ["AUTO"] },

      // MODERN / RECENT TOYOTA MODELS — keep even if less common in Malaysia
      { id: "toyota-rav4-xa50-2019", model: "RAV4", generation: "XA50", startYear: 2019, endYear: 2021, variants: ["2.0", "2.5"], transmissions: ["AUTO"] },

      { id: "toyota-prius-zvw30-2009", model: "Prius", generation: "XW30 / ZVW30 (Gen 3)", startYear: 2009, endYear: 2015, variants: ["1.8 Hybrid", "1.8 Hybrid Luxury"], transmissions: ["AUTO"] },
      { id: "toyota-prius-xw50-2016", model: "Prius", generation: "XW50", startYear: 2016, endYear: 2022, variants: ["1.8 Hybrid"], transmissions: ["AUTO"] },
      { id: "toyota-prius-xw60-2023", model: "Prius", generation: "XW60", startYear: 2023, variants: ["1.8 HEV", "2.0 HEV", "2.0 PHEV"], transmissions: ["AUTO"] },
      { id: "toyota-prius-c-nhp10-2012", model: "Prius C", generation: "NHP10 (Gen 1)", startYear: 2012, endYear: 2016, variants: ["1.5 Hybrid"], transmissions: ["AUTO"] },

      { id: "toyota-crown-s230-2023", model: "Crown", generation: "S230 / Crossover", startYear: 2023, variants: ["2.5 HEV", "2.4 Turbo HEV"], transmissions: ["AUTO"] },

      { id: "toyota-gr-supra-a90-2019", model: "GR Supra", generation: "A90 / DB", startYear: 2019, endYear: 2022, variants: ["3.0"], transmissions: ["AUTO"] },
      { id: "toyota-gr-supra-a90-mt-2023", model: "GR Supra", generation: "A90 2023 Update", startYear: 2023, endYear: 2025, variants: ["3.0"], transmissions: ["AUTO", "MANUAL"] },

      { id: "toyota-gr-yaris-gxpa16-2021", model: "GR Yaris", generation: "GXPA16", startYear: 2021, endYear: 2024, variants: ["1.6 Turbo GR"], transmissions: ["MANUAL"] },
      { id: "toyota-gr-yaris-gxpa16-fl-2025", model: "GR Yaris", generation: "GXPA16 Facelift", startYear: 2025, variants: ["1.6 Turbo GR"], transmissions: ["AUTO", "MANUAL"] },

      { id: "toyota-gr86-zn8-2022", model: "GR86", generation: "ZN8", startYear: 2022, variants: ["2.4"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-gr-corolla-gzea14-2023", model: "GR Corolla", generation: "GZEA14", startYear: 2023, variants: ["1.6 Turbo GR"], transmissions: ["MANUAL"] },

      // VIOS
      { id: "toyota-vios-ncp42-2003", model: "Vios", generation: "NCP42 (Gen 1)", startYear: 2003, endYear: 2007, variants: ["1.5 E", "1.5 G", "1.5 S", "1.5 Special Edition"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-vios-ncp93-2007", model: "Vios", generation: "NCP93 (Gen 2)", startYear: 2007, endYear: 2012, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 TRD Sportivo"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-vios-ncp150-2013", model: "Vios", generation: "NCP150 (Gen 3)", startYear: 2013, endYear: 2015, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 TRD Sportivo"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-vios-nsp151-2016", model: "Vios", generation: "NSP151", startYear: 2016, endYear: 2018, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 GX"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-vios-nsp151-fl1-2019", model: "Vios", generation: "NSP151 Facelift", startYear: 2019, endYear: 2020, variants: ["1.5 J", "1.5 E", "1.5 G"], transmissions: ["AUTO"] },
      { id: "toyota-vios-nsp151-fl2-2021", model: "Vios", generation: "NSP151 Facelift 2", startYear: 2021, endYear: 2022, variants: ["1.5 J", "1.5 E", "1.5 G", "1.5 GR Sport"], transmissions: ["AUTO"] },
      { id: "toyota-vios-ac100-2023", model: "Vios", generation: "AC100 / NGC102 (Gen 4)", startYear: 2023, endYear: 2025, variants: ["1.5E", "1.5G"], transmissions: ["AUTO"] },
      { id: "toyota-vios-ac100-hev-2026", model: "Vios", generation: "AC100 2026 HEV Update", startYear: 2026, variants: ["1.5E AT", "1.5G AT", "1.5 HEV AT", "1.5 HEV GR Sport"], transmissions: ["AUTO"] },

      // YARIS
      { id: "toyota-yaris-xp90-2006", model: "Yaris", generation: "XP90", startYear: 2006, endYear: 2011, variants: ["1.5 S", "1.5 G"], transmissions: ["AUTO"] },
      { id: "toyota-yaris-xp150-2019", model: "Yaris", generation: "XP150", startYear: 2019, endYear: 2020, variants: ["1.5 J", "1.5 E", "1.5 G"], transmissions: ["AUTO"] },
      { id: "toyota-yaris-xp150-fl-2021", model: "Yaris", generation: "XP150 Facelift", startYear: 2021, variants: ["1.5E", "1.5G", "1.5 G Limited"], transmissions: ["AUTO"] },

      // AVANZA
      { id: "toyota-avanza-f600-2004", model: "Avanza", generation: "F600 / Gen 1", startYear: 2004, endYear: 2011, variants: ["1.3E", "1.3G", "1.5G", "1.5S"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-avanza-f650-2012", model: "Avanza", generation: "F650 / Gen 2", startYear: 2012, endYear: 2015, variants: ["1.3E", "1.5G", "1.5S"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-avanza-f650-fl-2016", model: "Avanza", generation: "F650 Facelift", startYear: 2016, endYear: 2018, variants: ["1.3E", "1.5G", "1.5S"], transmissions: ["AUTO"] },
      { id: "toyota-avanza-f650-fl2-2019", model: "Avanza", generation: "F650 Facelift 2", startYear: 2019, endYear: 2022, variants: ["1.5E", "1.5S"], transmissions: ["AUTO"] },

      // WISH
      { id: "toyota-wish-ae10-2003", model: "Wish", generation: "AE10 / ZNE10", startYear: 2003, endYear: 2008, variants: ["1.8 X 2WD (ZNE10G)","1.8 X 4WD (ZNE14G)","2.0 G 2WD (ANE10G)","2.0 Z 2WD (ANE11W)"], transmissions: ["AUTO"] },
      { id: "toyota-wish-ae20-2009", model: "Wish", generation: "AE20 / ZGE20", startYear: 2009, endYear: 2012, variants: ["1.8 X 2WD (ZGE20G)","1.8 X 4WD (ZGE25G)","1.8 S 2WD (ZGE20W)","1.8 S 4WD (ZGE25W)","2.0 G 2WD (ZGE21G)","2.0 Z 2WD (ZGE22W)"], transmissions: ["AUTO"] },
      { id: "toyota-wish-ae20-fl-2013", model: "Wish", generation: "AE20 Facelift", startYear: 2013, endYear: 2017, variants: ["1.8 X 2WD (ZGE20G)","1.8 X 4WD (ZGE25G)","1.8 G 2WD (ZGE20G)","1.8 G 4WD (ZGE25G)","1.8 A 2WD (ZGE20W)","1.8 A 4WD (ZGE25W)","1.8 S 2WD (ZGE20W)","1.8 S 4WD (ZGE25W)","2.0 Z 2WD (ZGE22W)"], transmissions: ["AUTO"] },

      // VOXY — Japanese-market generations, separate 2WD, 4WD and Hybrid chassis
      { id: "toyota-voxy-azr60-2001", model: "Voxy", generation: "Gen 1 (AZR60 / AZR65)", startYear: 2001, endYear: 2007, variants: ["2.0 X 2WD (AZR60G)","2.0 Z 2WD (AZR60G)","2.0 X 4WD (AZR65G)","2.0 Z 4WD (AZR65G)"], transmissions: ["AUTO"] },
      { id: "toyota-voxy-zrr70-2007", model: "Voxy", generation: "Gen 2 (ZRR70 / ZRR75)", startYear: 2007, endYear: 2013, variants: ["2.0 X 2WD (ZRR70G)","2.0 X 4WD (ZRR75G)","2.0 Z 2WD (ZRR70W)","2.0 Z 4WD (ZRR75W)","2.0 ZS 2WD (ZRR70W)","2.0 ZS 4WD (ZRR75W)"], transmissions: ["AUTO"] },
      { id: "toyota-voxy-zrr80-2014", model: "Voxy", generation: "Gen 3 (ZRR80 / ZRR85 / ZWR80)", startYear: 2014, endYear: 2016, variants: ["2.0 X 2WD (ZRR80G)","2.0 X 4WD (ZRR85G)","2.0 V 2WD (ZRR80G)","2.0 V 4WD (ZRR85G)","2.0 ZS 2WD (ZRR80W)","2.0 ZS 4WD (ZRR85W)","1.8 Hybrid X 2WD (ZWR80G)","1.8 Hybrid V 2WD (ZWR80G)"], transmissions: ["AUTO"] },
      { id: "toyota-voxy-zrr80-fl-2017", model: "Voxy", generation: "Gen 3 Facelift (ZRR80 / ZRR85 / ZWR80)", startYear: 2017, endYear: 2021, variants: ["2.0 X 2WD (ZRR80G)","2.0 X 4WD (ZRR85G)","2.0 V 2WD (ZRR80G)","2.0 V 4WD (ZRR85G)","2.0 ZS 2WD (ZRR80W)","2.0 ZS 4WD (ZRR85W)","1.8 Hybrid X 2WD (ZWR80G)","1.8 Hybrid V 2WD (ZWR80G)","1.8 Hybrid ZS 2WD (ZWR80W)"], transmissions: ["AUTO"] },
      { id: "toyota-voxy-mzra90-2022", model: "Voxy", generation: "Gen 4 (MZRA90 / MZRA95 / ZWR90 / ZWR95)", startYear: 2022, variants: ["2.0 S-G 2WD (MZRA90W)","2.0 S-G 4WD (MZRA95W)","2.0 S-Z 2WD (MZRA90W)","2.0 S-Z 4WD (MZRA95W)","1.8 Hybrid S-G 2WD (ZWR90W)","1.8 Hybrid S-G E-Four 4WD (ZWR95W)","1.8 Hybrid S-Z 2WD (ZWR90W)","1.8 Hybrid S-Z E-Four 4WD (ZWR95W)"], transmissions: ["AUTO"] },

      // INNOVA
      { id: "toyota-innova-an40-2005", model: "Innova", generation: "AN40 / TGN40", startYear: 2005, endYear: 2008, variants: ["2.0E", "2.0G"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-innova-an40-fl1-2009", model: "Innova", generation: "AN40 Facelift", startYear: 2009, endYear: 2011, variants: ["2.0E", "2.0G"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-innova-an40-fl2-2012", model: "Innova", generation: "AN40 Facelift 2", startYear: 2012, endYear: 2015, variants: ["2.0E", "2.0G"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-innova-an140-2016", model: "Innova", generation: "AN140", startYear: 2016, endYear: 2020, variants: ["2.0E", "2.0G", "2.0X"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-innova-an140-fl-2021", model: "Innova", generation: "AN140 Facelift", startYear: 2021, endYear: 2022, variants: ["2.0E", "2.0G", "2.0X"], transmissions: ["AUTO"] },

      // FORTUNER
      { id: "toyota-fortuner-an50-2005", model: "Fortuner", generation: "AN50 / AN60", startYear: 2005, endYear: 2011, variants: ["2.5G Diesel", "2.7V Petrol", "3.0V Diesel"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-fortuner-an50-fl-2012", model: "Fortuner", generation: "AN50 / AN60 Facelift", startYear: 2012, endYear: 2015, variants: ["2.5G Diesel", "2.7V Petrol", "3.0V Diesel"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-fortuner-an160-2016", model: "Fortuner", generation: "AN160", startYear: 2016, endYear: 2020, variants: ["2.4 VRZ", "2.7 SRZ", "2.8 VRZ"], transmissions: ["AUTO"] },
      { id: "toyota-fortuner-an160-fl-2021", model: "Fortuner", generation: "AN160 Facelift", startYear: 2021, variants: ["2.4 AT 4WD", "2.7 SRZ AT 4WD", "2.8 VRZ AT 4WD", "2.8 GR Sport"], transmissions: ["AUTO"] },

      // ALPHARD
      { id: "toyota-alphard-ah10-2002", model: "Alphard", generation: "AH10", startYear: 2002, endYear: 2007, variants: ["2.4 AS 2WD (ANH10)","2.4 AS 4WD (ANH15)","2.4 AX 2WD (ANH10)","2.4 AX 4WD (ANH15)","3.0 MZ 2WD (MNH10)","3.0 MZ 4WD (MNH15)"], transmissions: ["AUTO"] },
      { id: "toyota-alphard-ah20-2008", model: "Alphard", generation: "AH20 / ANH20", startYear: 2008, endYear: 2014, variants: ["2.4 X 2WD (ANH20)","2.4 X 4WD (ANH25)","2.4 G 2WD (ANH20)","2.4 G 4WD (ANH25)","2.4 S 2WD (ANH20)","2.4 S 4WD (ANH25)","3.5 G 2WD (GGH20)","3.5 G 4WD (GGH25)","3.5 Executive Lounge 2WD (GGH20)","3.5 Executive Lounge 4WD (GGH25)"], transmissions: ["AUTO"] },
      { id: "toyota-alphard-ah30-2015", model: "Alphard", generation: "AH30 / AGH30", startYear: 2015, endYear: 2017, variants: ["2.5 X 2WD (AGH30)","2.5 X 4WD (AGH35)","2.5 G 2WD (AGH30)","2.5 G 4WD (AGH35)","2.5 SC 2WD (AGH30)","2.5 SC 4WD (AGH35)","3.5 Executive Lounge 2WD (GGH30)","3.5 Executive Lounge 4WD (GGH35)"], transmissions: ["AUTO"] },
      { id: "toyota-alphard-ah30-fl-2018", model: "Alphard", generation: "AH30 Facelift", startYear: 2018, endYear: 2022, variants: ["2.5 X 2WD (AGH30)","2.5 X 4WD (AGH35)","2.5 G 2WD (AGH30)","2.5 G 4WD (AGH35)","2.5 SC 2WD (AGH30)","2.5 SC 4WD (AGH35)","3.5 Executive Lounge 2WD (GGH30)","3.5 Executive Lounge 4WD (GGH35)"], transmissions: ["AUTO"] },
      { id: "toyota-alphard-ah40-2023", model: "Alphard", generation: "AH40", startYear: 2023, variants: ["2.5 Z 2WD (AGH40)","2.5 Z 4WD (AGH45)","2.5 HEV Executive Lounge 2WD (AAHH40)","2.5 HEV Executive Lounge E-Four 4WD (AAHH45)"], transmissions: ["AUTO"] },

      // VELLFIRE
      { id: "toyota-vellfire-ah20-2008", model: "Vellfire", generation: "AH20 / ANH20", startYear: 2008, endYear: 2014, variants: ["2.4 X 2WD (ANH20)","2.4 X 4WD (ANH25)","2.4 Z 2WD (ANH20)","2.4 Z 4WD (ANH25)","2.4 ZG 2WD (ANH20)","2.4 ZG 4WD (ANH25)","3.5 V 2WD (GGH20)","3.5 V 4WD (GGH25)","3.5 ZG 2WD (GGH20)","3.5 ZG 4WD (GGH25)"], transmissions: ["AUTO"] },
      { id: "toyota-vellfire-ah30-2015", model: "Vellfire", generation: "AH30 / AGH30", startYear: 2015, endYear: 2017, variants: ["2.5 X 2WD (AGH30)","2.5 X 4WD (AGH35)","2.5 Z 2WD (AGH30)","2.5 Z 4WD (AGH35)","2.5 ZG 2WD (AGH30)","2.5 ZG 4WD (AGH35)","3.5 ZG 2WD (GGH30)","3.5 ZG 4WD (GGH35)"], transmissions: ["AUTO"] },
      { id: "toyota-vellfire-ah30-fl-2018", model: "Vellfire", generation: "AH30 Facelift", startYear: 2018, endYear: 2022, variants: ["2.5 Z 2WD (AGH30)","2.5 Z 4WD (AGH35)","2.5 ZG 2WD (AGH30)","2.5 ZG 4WD (AGH35)","3.5 ZG 2WD (GGH30)","3.5 ZG 4WD (GGH35)"], transmissions: ["AUTO"] },
      { id: "toyota-vellfire-ah40-2023", model: "Vellfire", generation: "AH40", startYear: 2023, endYear: 2025, variants: ["2.4 Turbo Z Premier 2WD (TAHA40)","2.4 Turbo Z Premier 4WD (TAHA45)","2.5 HEV Z Premier 2WD (AAHH40)","2.5 HEV Z Premier E-Four 4WD (AAHH45)"], transmissions: ["AUTO"] },
      { id: "toyota-vellfire-ah40-hev-2026", model: "Vellfire", generation: "AH40 Hybrid Electric", startYear: 2026, variants: ["2.5 HEV Executive Lounge 2WD (AAHH40)","2.5 HEV Executive Lounge E-Four 4WD (AAHH45)"], transmissions: ["AUTO"] },

      // RUSH
      { id: "toyota-rush-f700-2008", model: "Rush", generation: "F700", startYear: 2008, endYear: 2017, variants: ["1.5G", "1.5S"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-rush-f800-2018", model: "Rush", generation: "F800", startYear: 2018, endYear: 2024, variants: ["1.5G", "1.5S"], transmissions: ["AUTO"] },

      // TOYOTA 86 / FT86 / GT86
      { id: "toyota-86-zn6-2012", model: "86", generation: "ZN6 / FT86 / GT86", startYear: 2012, endYear: 2016, variants: ["2.0 Standard", "2.0 Aero", "2.0 TRD"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-86-zn6-fl-2017", model: "86", generation: "ZN6 Facelift", startYear: 2017, endYear: 2021, variants: ["2.0 Standard", "2.0 GT", "2.0 GT Limited"], transmissions: ["AUTO", "MANUAL"] },

      // SIENTA
      { id: "toyota-sienta-p80-2003", model: "Sienta", generation: "P80", startYear: 2003, endYear: 2015, variants: ["1.5 X", "1.5 G"], transmissions: ["AUTO"] },
      { id: "toyota-sienta-p170-2016", model: "Sienta", generation: "NSP170 (Gen 2)", startYear: 2016, endYear: 2019, variants: ["1.5V", "1.5G"], transmissions: ["AUTO"] },

      // C-HR
      { id: "toyota-chr-ax10-2018", model: "C-HR", generation: "AX10", startYear: 2018, endYear: 2020, variants: ["1.8"], transmissions: ["AUTO"] },
      { id: "toyota-chr-ax10-fl-2021", model: "C-HR", generation: "AX10 Facelift / Recon", startYear: 2021, endYear: 2023, variants: ["1.2 Turbo", "1.8 Hybrid"], transmissions: ["AUTO"] },

      // COROLLA ALTIS
      { id: "toyota-altis-e120-2001", model: "Corolla Altis", generation: "E120", startYear: 2001, endYear: 2007, variants: ["1.6E", "1.8G"], transmissions: ["AUTO", "MANUAL"] },
      { id: "toyota-altis-e140-2008", model: "Corolla Altis", generation: "E140 / E150", startYear: 2008, endYear: 2010, variants: ["1.6E", "1.8E", "1.8G", "2.0V"], transmissions: ["AUTO"] },
      { id: "toyota-altis-e140-fl-2011", model: "Corolla Altis", generation: "E140 / E150 Facelift", startYear: 2011, endYear: 2013, variants: ["1.6E", "1.8E", "1.8G", "2.0V"], transmissions: ["AUTO"] },
      { id: "toyota-altis-e170-2014", model: "Corolla Altis", generation: "E170", startYear: 2014, endYear: 2016, variants: ["1.8E", "1.8G", "2.0V"], transmissions: ["AUTO"] },
      { id: "toyota-altis-e170-fl-2017", model: "Corolla Altis", generation: "E170 Facelift", startYear: 2017, endYear: 2019, variants: ["1.8E", "1.8G"], transmissions: ["AUTO"] },
      { id: "toyota-altis-e210-2019", model: "Corolla Altis", generation: "E210", startYear: 2019, endYear: 2022, variants: ["1.8E", "1.8G"], transmissions: ["AUTO"] },
      { id: "toyota-altis-e210-gr-2023", model: "Corolla Altis", generation: "E210 2023 Update", startYear: 2023, variants: ["1.8G", "1.8 GR Sport"], transmissions: ["AUTO"] },

      // COROLLA CROSS
      { id: "toyota-corolla-cross-xg10-2021", model: "Corolla Cross", generation: "XG10", startYear: 2021, endYear: 2023, variants: ["1.8G", "1.8V", "1.8 Hybrid", "1.8 HEV GR Sport"], transmissions: ["AUTO"] },
      { id: "toyota-corolla-cross-xg10-fl-2024", model: "Corolla Cross", generation: "XG10 Facelift", startYear: 2024, variants: ["1.8V", "1.8 HEV", "1.8 HEV GR Sport"], transmissions: ["AUTO"] },

      // VELOZ
      { id: "toyota-veloz-w100-2022", model: "Veloz", generation: "W100", startYear: 2022, variants: ["1.5"], transmissions: ["AUTO"] },

      // YARIS CROSS — Malaysia DNGA model
      { id: "toyota-yaris-cross-my-2026", model: "Yaris Cross", generation: "Malaysia Gen 1", startYear: 2026, variants: ["1.5S", "1.5S HEV"], transmissions: ["AUTO"] },

      // INNOVA ZENIX
      { id: "toyota-innova-zenix-ag10-2023", model: "Innova Zenix", generation: "AG10", startYear: 2023, variants: ["2.0V", "2.0 HEV"], transmissions: ["AUTO"] },

    ],
  },
  {
    make: "Honda",
    modelOrder: [
      "Civic",
      "Accord",
      "City",
      "CR-V",
      "Odyssey",
      "Stream",
      "Jazz",
      "Freed",
      "Insight",
      "CR-Z",
      "HR-V",
      "BR-V",
      "City Hatchback",
      "Civic Type R",
      "WR-V",
      "e:N1",
      "Prelude",
    ],
    vehicles: [
      // CIVIC
      { id: "honda-civic-ef-1988", model: "Civic", generation: "EF", startYear: 1988, endYear: 1991, variants: ["1.5 EX", "1.6 EXi"], transmissions: ["AUTO", "MANUAL"] },
      { id: "honda-civic-eg-1992", model: "Civic", generation: "EG", startYear: 1992, endYear: 1995, variants: ["1.5 EX NON-VTEC","1.6 EXi NON-VTEC","1.6 VTi VTEC","1.6 SiR DOHC VTEC"], transmissions: ["AUTO", "MANUAL"] },
      { id: "honda-civic-ek-1996", model: "Civic", generation: "EK", startYear: 1996, endYear: 2000, variants: ["1.6 EXi NON-VTEC","1.6 VTi VTEC","1.6 VTi-S VTEC","1.6 SiR DOHC VTEC"], transmissions: ["AUTO", "MANUAL"] },
      { id: "honda-civic-es-2001", model: "Civic", generation: "ES", startYear: 2001, endYear: 2005, variants: ["1.7 VTi", "1.7 VTi-S", "2.0 i-VTEC"], transmissions: ["AUTO", "MANUAL"] },
      { id: "honda-civic-fd-2006", model: "Civic", generation: "FD", startYear: 2006, endYear: 2011, variants: ["1.8 S", "1.8 S-L", "2.0 S", "2.0 S Navi"], transmissions: ["AUTO"] },
      { id: "honda-civic-fb-2012", model: "Civic", generation: "FB", startYear: 2012, endYear: 2015, variants: ["1.8 S", "2.0 S", "2.0 Navi", "1.5 Hybrid"], transmissions: ["AUTO"] },
      { id: "honda-civic-fc-2016", model: "Civic", generation: "FC", startYear: 2016, endYear: 2021, variants: ["1.8 S", "1.5 Turbo TC", "1.5 Turbo TC-P"], transmissions: ["AUTO"] },
      { id: "honda-civic-fe-2022", model: "Civic", generation: "FE", startYear: 2022, endYear: 2024, variants: ["1.5 E", "1.5 V", "1.5 RS", "2.0 e:HEV RS"], transmissions: ["AUTO"] },
      { id: "honda-civic-fe-fl-2025", model: "Civic", generation: "FE Facelift", startYear: 2025, variants: ["1.5 E", "1.5 V", "1.5 RS", "2.0 e:HEV RS"], transmissions: ["AUTO"] },

      // ACCORD
      { id: "honda-accord-sm4-1990", model: "Accord", generation: "SM4", startYear: 1990, endYear: 1993, variants: ["2.0 EXi", "2.0 EX"], transmissions: ["AUTO", "MANUAL"] },
      { id: "honda-accord-sv4-1994", model: "Accord", generation: "SV4", startYear: 1994, endYear: 1997, variants: ["2.0 EXi", "2.2 VTi"], transmissions: ["AUTO", "MANUAL"] },
      { id: "honda-accord-s84-1998", model: "Accord", generation: "S84", startYear: 1998, endYear: 2002, variants: ["2.0 VTi", "2.0 VTi-L", "2.3 VTi-L"], transmissions: ["AUTO"] },
      { id: "honda-accord-cm-2003", model: "Accord", generation: "CM4 / CM5", startYear: 2003, endYear: 2007, variants: ["2.0 VTi", "2.0 VTi-L", "2.4 VTi-L"], transmissions: ["AUTO"] },
      { id: "honda-accord-cp-2008", model: "Accord", generation: "CP1 / CP2", startYear: 2008, endYear: 2012, variants: ["2.0 VTi", "2.0 VTi-L", "2.4 VTi-L"], transmissions: ["AUTO"] },
      { id: "honda-accord-cr-2013", model: "Accord", generation: "CR", startYear: 2013, endYear: 2015, variants: ["2.0 VTi", "2.0 VTi-L", "2.4 VTi-L"], transmissions: ["AUTO"] },
      { id: "honda-accord-cr-fl-2016", model: "Accord", generation: "CR Facelift", startYear: 2016, endYear: 2019, variants: ["2.0 VTi", "2.0 VTi-L", "2.4 VTi-L"], transmissions: ["AUTO"] },
      { id: "honda-accord-cv-2020", model: "Accord", generation: "CV", startYear: 2020, endYear: 2023, variants: ["1.5 TC", "1.5 TC-P"], transmissions: ["AUTO"] },

      // CITY
      { id: "honda-city-sx8-1996", model: "City", generation: "SX8", startYear: 1996, endYear: 2002, variants: ["1.3 EXi", "1.5 EXi", "1.5 VTi"], transmissions: ["AUTO", "MANUAL"] },
      { id: "honda-city-gd-2003", model: "City", generation: "GD8 / GD3", startYear: 2003, endYear: 2008, variants: ["1.5 i-DSI", "1.5 VTEC"], transmissions: ["AUTO"] },
      { id: "honda-city-gm2-2009", model: "City", generation: "GM2 / GM3", startYear: 2009, endYear: 2013, variants: ["1.5 S", "1.5 E"], transmissions: ["AUTO"] },
      { id: "honda-city-gm6-2014", model: "City", generation: "GM6", startYear: 2014, endYear: 2016, variants: ["1.5 S", "1.5 E", "1.5 V"], transmissions: ["AUTO"] },
      { id: "honda-city-gm6-fl-2017", model: "City", generation: "GM6 Facelift", startYear: 2017, endYear: 2019, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 Hybrid"], transmissions: ["AUTO"] },
      { id: "honda-city-gn2-2020", model: "City", generation: "GN2", startYear: 2020, endYear: 2022, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 RS", "1.5 e:HEV RS"], transmissions: ["AUTO"] },
      { id: "honda-city-gn2-fl-2023", model: "City", generation: "GN2 Facelift", startYear: 2023, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 RS", "1.5 e:HEV RS"], transmissions: ["AUTO"] },

      // CR-V
      { id: "honda-crv-rd1-1997", model: "CR-V", generation: "RD1", startYear: 1997, endYear: 2001, variants: ["2.0 4WD"], transmissions: ["AUTO"] },
      { id: "honda-crv-rd5-2002", model: "CR-V", generation: "RD5 / RD7", startYear: 2002, endYear: 2006, variants: ["2.0 i-VTEC", "2.4 i-VTEC"], transmissions: ["AUTO"] },
      { id: "honda-crv-re-2007", model: "CR-V", generation: "RE", startYear: 2007, endYear: 2012, variants: ["2.0 i-VTEC", "2.4 i-VTEC"], transmissions: ["AUTO"] },
      { id: "honda-crv-rm-2013", model: "CR-V", generation: "RM", startYear: 2013, endYear: 2014, variants: ["2.0 i-VTEC", "2.4 i-VTEC"], transmissions: ["AUTO"] },
      { id: "honda-crv-rm-fl-2015", model: "CR-V", generation: "RM Facelift", startYear: 2015, endYear: 2016, variants: ["2.0 i-VTEC 2WD", "2.0 i-VTEC 4WD", "2.4 i-VTEC 4WD"], transmissions: ["AUTO"] },
      { id: "honda-crv-rw-2017", model: "CR-V", generation: "RW", startYear: 2017, endYear: 2019, variants: ["2.0 i-VTEC 2WD", "1.5 Turbo 2WD", "1.5 Turbo 4WD", "1.5 Turbo Premium 2WD"], transmissions: ["AUTO"] },
      { id: "honda-crv-rw-fl-2020", model: "CR-V", generation: "RW Facelift", startYear: 2020, endYear: 2022, variants: ["2.0 i-VTEC 2WD", "1.5 Turbo 2WD", "1.5 Turbo 4WD", "1.5 Turbo Premium 2WD"], transmissions: ["AUTO"] },
      { id: "honda-crv-ry-2023", model: "CR-V", generation: "RY", startYear: 2023, variants: ["1.5 Turbo S", "1.5 Turbo E", "1.5 Turbo V AWD", "2.0 e:HEV E", "2.0 e:HEV RS"], transmissions: ["AUTO"] },

      // ODYSSEY
      { id: "honda-odyssey-ra6-2000", model: "Odyssey", generation: "RA6 / RA7", startYear: 2000, endYear: 2003, variants: ["2.3 Absolute", "3.0 V6"], transmissions: ["AUTO"] },
      { id: "honda-odyssey-rb1-2004", model: "Odyssey", generation: "RB1 / RB2", startYear: 2004, endYear: 2008, variants: ["2.4 M", "2.4 Absolute"], transmissions: ["AUTO"] },
      { id: "honda-odyssey-rb3-2009", model: "Odyssey", generation: "RB3 / RB4", startYear: 2009, endYear: 2013, variants: ["2.4", "2.4 Absolute"], transmissions: ["AUTO"] },
      { id: "honda-odyssey-rc1-2014", model: "Odyssey", generation: "RC1", startYear: 2014, endYear: 2017, variants: ["2.4 EX", "2.4 EXV"], transmissions: ["AUTO"] },
      { id: "honda-odyssey-rc1-fl-2018", model: "Odyssey", generation: "RC1 Facelift", startYear: 2018, endYear: 2021, variants: ["2.4 EXV"], transmissions: ["AUTO"] },

      // STREAM
      { id: "honda-stream-rn1-2001", model: "Stream", generation: "RN1 / RN3", startYear: 2001, endYear: 2006, variants: ["1.7", "2.0 i-VTEC"], transmissions: ["AUTO"] },
      { id: "honda-stream-rn6-2007", model: "Stream", generation: "RN6 / RN8", startYear: 2007, endYear: 2014, variants: ["1.8", "2.0 RSZ"], transmissions: ["AUTO"] },

      // JAZZ
      { id: "honda-jazz-gd-2003", model: "Jazz", generation: "GD", startYear: 2003, endYear: 2008, variants: ["1.5 i-DSI", "1.5 VTEC"], transmissions: ["AUTO"] },
      { id: "honda-jazz-ge-2009", model: "Jazz", generation: "GE", startYear: 2009, endYear: 2013, variants: ["1.5 S", "1.5 V"], transmissions: ["AUTO"] },
      { id: "honda-jazz-gk-2014", model: "Jazz", generation: "GK", startYear: 2014, endYear: 2016, variants: ["1.5 S", "1.5 E", "1.5 V"], transmissions: ["AUTO"] },
      { id: "honda-jazz-gk-fl-2017", model: "Jazz", generation: "GK Facelift", startYear: 2017, endYear: 2021, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 Hybrid"], transmissions: ["AUTO"] },

      // FREED
      { id: "honda-freed-gb3-2010", model: "Freed", generation: "GB3", startYear: 2010, endYear: 2014, variants: ["1.5 E", "1.5 E Plus"], transmissions: ["AUTO"] },

      // INSIGHT / CR-Z
      { id: "honda-insight-ze2-2011", model: "Insight", generation: "ZE2", startYear: 2011, endYear: 2014, variants: ["1.3 Hybrid"], transmissions: ["AUTO"] },
      { id: "honda-crz-zf1-2012", model: "CR-Z", generation: "ZF1", startYear: 2012, endYear: 2013, variants: ["1.5 Hybrid"], transmissions: ["AUTO", "MANUAL"] },
      { id: "honda-crz-zf2-2014", model: "CR-Z", generation: "ZF2", startYear: 2014, endYear: 2016, variants: ["1.5 Hybrid"], transmissions: ["AUTO", "MANUAL"] },

      // HR-V
      { id: "honda-hrv-ru-2015", model: "HR-V", generation: "RU", startYear: 2015, endYear: 2018, variants: ["1.8 S", "1.8 E", "1.8 V"], transmissions: ["AUTO"] },
      { id: "honda-hrv-ru-fl-2019", model: "HR-V", generation: "RU Facelift", startYear: 2019, endYear: 2021, variants: ["1.8 E", "1.8 V", "1.8 RS", "1.5 Hybrid"], transmissions: ["AUTO"] },
      { id: "honda-hrv-rv-2022", model: "HR-V", generation: "RV", startYear: 2022, endYear: 2024, variants: ["1.5 S", "1.5 Turbo E", "1.5 Turbo V", "1.5 e:HEV RS"], transmissions: ["AUTO"] },
      { id: "honda-hrv-rv-fl-2025", model: "HR-V", generation: "RV Facelift", startYear: 2025, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 e:HEV RS"], transmissions: ["AUTO"] },

      // BR-V
      { id: "honda-brv-dg1-2017", model: "BR-V", generation: "DG1", startYear: 2017, endYear: 2019, variants: ["1.5 E", "1.5 V"], transmissions: ["AUTO"] },
      { id: "honda-brv-dg1-fl-2020", model: "BR-V", generation: "DG1 Facelift", startYear: 2020, endYear: 2023, variants: ["1.5 E", "1.5 V"], transmissions: ["AUTO"] },

      // CITY HATCHBACK
      { id: "honda-city-hatch-gn-2021", model: "City Hatchback", generation: "GN", startYear: 2021, endYear: 2023, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 RS", "1.5 e:HEV RS"], transmissions: ["AUTO"] },
      { id: "honda-city-hatch-gn-fl-2024", model: "City Hatchback", generation: "GN Facelift", startYear: 2024, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 RS", "1.5 e:HEV RS"], transmissions: ["AUTO"] },

      // CIVIC TYPE R
      { id: "honda-civic-type-r-fd2-2007", model: "Civic Type R", generation: "FD2", startYear: 2007, endYear: 2010, variants: ["2.0 Type R"], transmissions: ["MANUAL"] },
      { id: "honda-civic-type-r-fk8-2017", model: "Civic Type R", generation: "FK8", startYear: 2017, endYear: 2021, variants: ["2.0 Turbo Type R"], transmissions: ["MANUAL"] },
      { id: "honda-civic-fl5-2023", model: "Civic Type R", generation: "FL5", startYear: 2023, variants: ["2.0 Turbo Type R"], transmissions: ["MANUAL"] },

      // WR-V / NEW HONDA MODELS
      { id: "honda-wrv-dg4-2023", model: "WR-V", generation: "DG4", startYear: 2023, variants: ["1.5 S", "1.5 E", "1.5 V", "1.5 RS"], transmissions: ["AUTO"] },
      { id: "honda-en1-2025", model: "e:N1", generation: "Gen 1", startYear: 2025, variants: ["e:N1"], transmissions: ["AUTO"] },
      { id: "honda-prelude-2026", model: "Prelude", generation: "Gen 6", startYear: 2026, variants: ["2.0 e:HEV"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Nissan",
    modelOrder: [
      "Sentra",
      "Vanette",
      "Cefiro",
      "Serena",
      "X-Trail",
      "Murano",
      "Navara",
      "Latio",
      "Grand Livina",
      "Sylphy",
      "Teana",
      "Almera",
      "Urvan",
      "Elgrand",
      "370Z",
      "GT-R",
      "Leaf",
      "Kicks e-POWER",
    ],
    vehicles: [
      // SENTRA — only N16 (no Sunny/B11/B12/B13/B14)
      { id: "nissan-sentra-n16-2000", model: "Sentra", generation: "N16", startYear: 2000, endYear: 2006, variants: ["1.6 SG", "1.6 XG-L", "1.8 XG-L"], transmissions: ["AUTO", "MANUAL"] },

      // VANETTE
      { id: "nissan-vanette-c22-1986", model: "Vanette", generation: "C22", startYear: 1986, endYear: 2012, variants: ["1.5 Petrol Panel Van", "1.5 Petrol Window Van"], transmissions: ["MANUAL"] },

      // CEFIRO
      { id: "nissan-cefiro-a31-1989", model: "Cefiro", generation: "A31", startYear: 1989, endYear: 1994, variants: ["2.0", "2.0 Turbo"], transmissions: ["AUTO", "MANUAL"] },
      { id: "nissan-cefiro-a32-1995", model: "Cefiro", generation: "A32", startYear: 1995, endYear: 1998, variants: ["2.0 V6", "3.0 V6"], transmissions: ["AUTO"] },
      { id: "nissan-cefiro-a33-1999", model: "Cefiro", generation: "A33", startYear: 1999, endYear: 2003, variants: ["2.0 V6", "3.0 V6"], transmissions: ["AUTO"] },

      // SERENA
      { id: "nissan-serena-c23-1997", model: "Serena", generation: "C23", startYear: 1997, endYear: 1999, variants: ["2.0"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c24-2000", model: "Serena", generation: "C24", startYear: 2000, endYear: 2012, variants: ["2.0 Highway Star", "2.0 Comfort"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c26-2013", model: "Serena", generation: "C26 S-Hybrid", startYear: 2013, endYear: 2017, variants: ["2.0 S-Hybrid Highway Star", "2.0 S-Hybrid Premium"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c27-2018", model: "Serena", generation: "C27 S-Hybrid", startYear: 2018, endYear: 2021, variants: ["2.0 S-Hybrid Highway Star", "2.0 S-Hybrid Premium Highway Star"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c27-fl-2022", model: "Serena", generation: "C27 Facelift", startYear: 2022, endYear: 2025, variants: ["2.0 S-Hybrid Highway Star", "2.0 S-Hybrid Premium Highway Star"], transmissions: ["AUTO"] },
      { id: "nissan-serena-c28-2026", model: "Serena", generation: "C28 e-POWER", startYear: 2026, variants: ["X", "X Plus", "Highway Star", "Premium Highway Star", "Shiro Premium Highway Star"], transmissions: ["AUTO"] },

      // X-TRAIL
      { id: "nissan-xtrail-t30-2003", model: "X-Trail", generation: "T30", startYear: 2003, endYear: 2007, variants: ["2.0 2WD", "2.0 4WD (NT30)", "2.5 4WD"], transmissions: ["AUTO"] },
      { id: "nissan-xtrail-t31-2008", model: "X-Trail", generation: "T31", startYear: 2008, endYear: 2014, variants: ["2.0 2WD", "2.5 4WD"], transmissions: ["AUTO"] },
      { id: "nissan-xtrail-t32-2015", model: "X-Trail", generation: "T32", startYear: 2015, endYear: 2018, variants: ["2.0L 2WD", "2.5L 4WD"], transmissions: ["AUTO"] },
      { id: "nissan-xtrail-t32-fl-2019", model: "X-Trail", generation: "T32 Facelift", startYear: 2019, endYear: 2024, variants: ["2.0L 2WD", "2.0L 2WD MID", "2.5L 4WD", "2.0L Hybrid"], transmissions: ["AUTO"] },

      // MURANO
      { id: "nissan-murano-z50-2005", model: "Murano", generation: "Z50", startYear: 2005, endYear: 2008, variants: ["2.5", "3.5 V6"], transmissions: ["AUTO"] },
      { id: "nissan-murano-z51-2009", model: "Murano", generation: "Z51", startYear: 2009, endYear: 2014, variants: ["2.5", "3.5 V6"], transmissions: ["AUTO"] },

      // NAVARA
      { id: "nissan-navara-d40-2008", model: "Navara", generation: "D40", startYear: 2008, endYear: 2012, variants: ["2.5 SE", "2.5 LE"], transmissions: ["AUTO", "MANUAL"] },
      { id: "nissan-navara-d40-fl-2013", model: "Navara", generation: "D40 Facelift", startYear: 2013, endYear: 2014, variants: ["2.5 SE", "2.5 LE"], transmissions: ["AUTO", "MANUAL"] },
      { id: "nissan-navara-d23-2015", model: "Navara", generation: "NP300 D23", startYear: 2015, endYear: 2020, variants: ["2.5 SE", "2.5 V", "2.5 VL"], transmissions: ["AUTO", "MANUAL"] },
      { id: "nissan-navara-d23-fl-2021", model: "Navara", generation: "D23 Facelift", startYear: 2021, variants: ["2.5 SE MT", "2.5 SE AT", "2.5 V", "2.5 VL", "2.5 PRO-4X"], transmissions: ["AUTO", "MANUAL"] },

      // LATIO
      { id: "nissan-latio-c11-2007", model: "Latio", generation: "C11", startYear: 2007, endYear: 2012, variants: ["1.6 ST-L Sedan", "1.6 ST-L Sport", "1.8 Ti Sedan", "1.8 Ti Hatchback"], transmissions: ["AUTO", "MANUAL"] },

      // GRAND LIVINA
      { id: "nissan-grand-livina-l10-2007", model: "Grand Livina", generation: "L10", startYear: 2007, endYear: 2012, variants: ["1.6 ST-L", "1.8 A/T", "1.8 Impul"], transmissions: ["AUTO", "MANUAL"] },
      { id: "nissan-grand-livina-l10-fl-2013", model: "Grand Livina", generation: "L10 Facelift", startYear: 2013, endYear: 2018, variants: ["1.6 Comfort", "1.6 Autech", "1.8 Comfort", "1.8 Autech"], transmissions: ["AUTO", "MANUAL"] },

      // SYLPHY
      { id: "nissan-sylphy-g11-2008", model: "Sylphy", generation: "G11", startYear: 2008, endYear: 2013, variants: ["2.0 Comfort", "2.0 Luxury", "2.0 Tuned by Impul"], transmissions: ["AUTO"] },
      { id: "nissan-sylphy-b17-2014", model: "Sylphy", generation: "B17", startYear: 2014, endYear: 2019, variants: ["1.8 E", "1.8 VL"], transmissions: ["AUTO"] },

      // TEANA
      { id: "nissan-teana-j32-2010", model: "Teana", generation: "J32", startYear: 2010, endYear: 2013, variants: ["2.0 XE", "2.0 XL", "2.5 XV", "3.5 V6"], transmissions: ["AUTO"] },
      { id: "nissan-teana-l33-2014", model: "Teana", generation: "L33", startYear: 2014, endYear: 2020, variants: ["2.0 XE", "2.0 XL", "2.5 XV"], transmissions: ["AUTO"] },

      // ALMERA
      { id: "nissan-almera-n17-2012", model: "Almera", generation: "N17", startYear: 2012, endYear: 2014, variants: ["1.5 E MT", "1.5 E AT", "1.5 V", "1.5 VL"], transmissions: ["AUTO", "MANUAL"] },
      { id: "nissan-almera-n17-fl-2015", model: "Almera", generation: "N17 Facelift", startYear: 2015, endYear: 2019, variants: ["1.5 E", "1.5 V", "1.5 VL", "1.5 Black Series"], transmissions: ["AUTO", "MANUAL"] },
      { id: "nissan-almera-n18-2020", model: "Almera", generation: "N18", startYear: 2020, endYear: 2024, variants: ["1.0 Turbo VL", "1.0 Turbo VLP", "1.0 Turbo VLT"], transmissions: ["AUTO"] },
      { id: "nissan-almera-n18-fl-2025", model: "Almera", generation: "N18 Facelift", startYear: 2025, variants: ["1.0 Turbo VL", "1.0 Turbo VLP", "1.0 Turbo VLT"], transmissions: ["AUTO"] },

      // URVAN
      { id: "nissan-urvan-e25-2002", model: "Urvan", generation: "E25", startYear: 2002, endYear: 2014, variants: ["2.5 Diesel Panel Van", "3.0 Diesel Window Van"], transmissions: ["MANUAL"] },
      { id: "nissan-urvan-e26-2015", model: "Urvan", generation: "NV350 / E26", startYear: 2015, variants: ["2.5 Diesel Panel Van", "2.5 Diesel Window Van"], transmissions: ["MANUAL"] },

      // ELGRAND
      { id: "nissan-elgrand-e51-2002", model: "Elgrand", generation: "E51", startYear: 2002, endYear: 2010, variants: ["2.5 Highway Star", "3.5 Highway Star"], transmissions: ["AUTO"] },
      { id: "nissan-elgrand-e52-2011", model: "Elgrand", generation: "E52", startYear: 2011, variants: ["2.5 Highway Star", "2.5 Highway Star Premium", "3.5 Highway Star"], transmissions: ["AUTO"] },

      // PERFORMANCE / EV
      { id: "nissan-370z-z34-2009", model: "370Z", generation: "Z34", startYear: 2009, endYear: 2020, variants: ["3.7 Coupe", "3.7 NISMO"], transmissions: ["AUTO", "MANUAL"] },
      { id: "nissan-gtr-r35-2009", model: "GT-R", generation: "R35", startYear: 2009, endYear: 2025, variants: ["3.8 Premium", "3.8 Black Edition", "3.8 NISMO"], transmissions: ["AUTO"] },
      { id: "nissan-leaf-ze1-2019", model: "Leaf", generation: "ZE1", startYear: 2019, variants: ["EV"], transmissions: ["AUTO"] },

      // KICKS e-POWER
      { id: "nissan-kicks-p15-2024", model: "Kicks e-POWER", generation: "P15", startYear: 2024, variants: ["VL", "VLT"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Mazda",
    modelOrder: [
      "323 / Familia",
      "626",
      "Tribute",
      "RX-8",
      "Mazda 5",
      "Mazda 2",
      "Mazda 3",
      "Mazda 6",
      "CX-7",
      "CX-9",
      "CX-5",
      "Biante",
      "CX-3",
      "MX-5",
      "BT-50",
      "CX-30",
      "CX-8",
      "CX-60",
      "CX-80",
    ],
    vehicles: [
      // 323 / FAMILIA
      { id: "mazda-323-bf-1985", model: "323 / Familia", generation: "BF", startYear: 1985, endYear: 1989, variants: ["1.3", "1.5", "1.6"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-323-bg-1989", model: "323 / Familia", generation: "BG", startYear: 1989, endYear: 1994, variants: ["1.3", "1.6", "1.8"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-323-bh-1994", model: "323 / Familia", generation: "BH", startYear: 1994, endYear: 1998, variants: ["1.5", "1.8"], transmissions: ["AUTO", "MANUAL"] },

      // 626
      { id: "mazda-626-gd-1988", model: "626", generation: "GD", startYear: 1988, endYear: 1991, variants: ["1.8", "2.0"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-626-ge-1992", model: "626", generation: "GE", startYear: 1992, endYear: 1997, variants: ["1.8", "2.0"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-626-gf-1998", model: "626", generation: "GF", startYear: 1998, endYear: 2002, variants: ["2.0"], transmissions: ["AUTO"] },

      // TRIBUTE
      { id: "mazda-tribute-ep-2001", model: "Tribute", generation: "EP", startYear: 2001, endYear: 2007, variants: ["2.0", "2.3", "3.0 V6"], transmissions: ["AUTO"] },

      // RX-8
      { id: "mazda-rx8-se3p-2003", model: "RX-8", generation: "SE3P", startYear: 2003, endYear: 2008, variants: ["1.3 Rotary Standard", "1.3 Rotary Type S"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-rx8-se3p-fl-2009", model: "RX-8", generation: "SE3P Facelift", startYear: 2009, endYear: 2012, variants: ["1.3 Rotary Type E", "1.3 Rotary Type S"], transmissions: ["AUTO", "MANUAL"] },

      // MAZDA 5
      { id: "mazda-5-cr-2007", model: "Mazda 5", generation: "CR", startYear: 2007, endYear: 2010, variants: ["2.0"], transmissions: ["AUTO"] },
      { id: "mazda-5-cw-2011", model: "Mazda 5", generation: "CW", startYear: 2011, endYear: 2017, variants: ["2.0"], transmissions: ["AUTO"] },

      // MAZDA 2
      { id: "mazda-2-de-2010", model: "Mazda 2", generation: "DE", startYear: 2010, endYear: 2014, variants: ["1.5 Sedan", "1.5 Hatchback"], transmissions: ["AUTO"] },
      { id: "mazda-2-dj-2015", model: "Mazda 2", generation: "DJ", startYear: 2015, endYear: 2019, variants: ["1.5 Sedan", "1.5 Hatchback"], transmissions: ["AUTO"] },
      { id: "mazda-2-dj-fl-2020", model: "Mazda 2", generation: "DJ Facelift", startYear: 2020, endYear: 2024, variants: ["1.5 Sedan", "1.5 Hatchback"], transmissions: ["AUTO"] },

      // MAZDA 3
      { id: "mazda-3-bk-2006", model: "Mazda 3", generation: "BK", startYear: 2006, endYear: 2008, variants: ["1.6 Sedan", "2.0 Sedan", "2.0 Hatchback"], transmissions: ["AUTO"] },
      { id: "mazda-3-bl-2009", model: "Mazda 3", generation: "BL", startYear: 2009, endYear: 2013, variants: ["1.6 Sedan", "2.0 Sedan", "2.0 Hatchback"], transmissions: ["AUTO"] },
      { id: "mazda-3-bm-2014", model: "Mazda 3", generation: "BM", startYear: 2014, endYear: 2016, variants: ["2.0 Sedan", "2.0 Hatchback"], transmissions: ["AUTO"] },
      { id: "mazda-3-bm-fl-2017", model: "Mazda 3", generation: "BM Facelift / BN", startYear: 2017, endYear: 2018, variants: ["2.0 Sedan", "2.0 Hatchback"], transmissions: ["AUTO"] },
      { id: "mazda-3-bp-2019", model: "Mazda 3", generation: "BP", startYear: 2019, endYear: 2022, variants: ["1.5 Sedan", "1.5 Liftback", "2.0 High Sedan", "2.0 High Plus Sedan", "2.0 High Plus Liftback"], transmissions: ["AUTO"] },
      { id: "mazda-3-bp-update-2023", model: "Mazda 3", generation: "BP 2023 Update", startYear: 2023, variants: ["1.5 High Plus Sedan", "1.5 High Plus Liftback", "2.0 High Sedan", "2.0 High Plus Sedan", "2.0 High Plus Liftback", "2.0 Ignite Edition"], transmissions: ["AUTO"] },

      // MAZDA 6
      { id: "mazda-6-gg-2003", model: "Mazda 6", generation: "GG", startYear: 2003, endYear: 2007, variants: ["2.0 Sedan", "2.3 Sedan"], transmissions: ["AUTO"] },
      { id: "mazda-6-gh-2008", model: "Mazda 6", generation: "GH", startYear: 2008, endYear: 2012, variants: ["2.0 Sedan", "2.5 Sedan"], transmissions: ["AUTO"] },
      { id: "mazda-6-gj-2013", model: "Mazda 6", generation: "GJ", startYear: 2013, endYear: 2017, variants: ["2.0 Sedan", "2.5 Sedan", "2.2 Diesel"], transmissions: ["AUTO"] },
      { id: "mazda-6-gl-2018", model: "Mazda 6", generation: "GL Facelift", startYear: 2018, endYear: 2023, variants: ["2.0 Sedan", "2.5 Sedan", "2.5 Touring", "2.2 Diesel"], transmissions: ["AUTO"] },

      // CX-7
      { id: "mazda-cx7-er-2007", model: "CX-7", generation: "ER", startYear: 2007, endYear: 2012, variants: ["2.3 Turbo AWD", "2.5 2WD"], transmissions: ["AUTO"] },

      // CX-9
      { id: "mazda-cx9-tb-2008", model: "CX-9", generation: "TB", startYear: 2008, endYear: 2016, variants: ["3.7 V6 AWD"], transmissions: ["AUTO"] },
      { id: "mazda-cx9-tc-2017", model: "CX-9", generation: "TC", startYear: 2017, endYear: 2023, variants: ["2.5 Turbo 2WD", "2.5 Turbo AWD"], transmissions: ["AUTO"] },

      // CX-5
      { id: "mazda-cx5-ke-2012", model: "CX-5", generation: "KE / Mk1 CBU", startYear: 2012, endYear: 2012, variants: ["2.0 Skyactiv-G 2WD CBU", "2.0 Skyactiv-G 4WD CBU"], transmissions: ["AUTO"] },
      { id: "mazda-cx5-ke-ckd-2013", model: "CX-5", generation: "KE / Mk1 CKD", startYear: 2013, endYear: 2014, variants: ["2.0 Skyactiv-G 2WD Mid CKD", "2.0 Skyactiv-G 2WD High CKD", "2.0 Skyactiv-G 4WD High CKD"], transmissions: ["AUTO"] },
      { id: "mazda-cx5-ke-fl-2015", model: "CX-5", generation: "KE / Mk1 Facelift", startYear: 2015, endYear: 2016, variants: ["2.0 Skyactiv-G 2WD CKD", "2.0 Skyactiv-G 4WD CKD", "2.5 Skyactiv-G 2WD CBU", "2.5 Skyactiv-G 4WD CBU", "2.5 Skyactiv-G 2WD CKD", "2.2 Skyactiv-D 2WD CKD"], transmissions: ["AUTO"] },
      { id: "mazda-cx5-kf-2017", model: "CX-5", generation: "KF", startYear: 2017, endYear: 2023, variants: ["2.0 GLS", "2.5 GLS", "2.2D GLS", "2.5T AWD"], transmissions: ["AUTO"] },
      { id: "mazda-cx5-kf-fl-2024", model: "CX-5", generation: "KF Facelift", startYear: 2024, variants: ["2.0 Mid", "2.0 High", "2.5 High", "2.2D High", "2.5T High AWD"], transmissions: ["AUTO"] },

      // BIANTE
      { id: "mazda-biante-cc-2013", model: "Biante", generation: "CC", startYear: 2013, endYear: 2018, variants: ["2.0 Skyactiv-G"], transmissions: ["AUTO"] },

      // CX-3
      { id: "mazda-cx3-dk-2015", model: "CX-3", generation: "DK", startYear: 2015, endYear: 2017, variants: ["2.0 Skyactiv-G"], transmissions: ["AUTO"] },
      { id: "mazda-cx3-dk-fl-2018", model: "CX-3", generation: "DK Facelift", startYear: 2018, endYear: 2023, variants: ["1.5 Core", "2.0 Mid", "2.0 High"], transmissions: ["AUTO"] },

      // MX-5
      { id: "mazda-mx5-nc-2006", model: "MX-5", generation: "NC", startYear: 2006, endYear: 2014, variants: ["2.0 Roadster", "2.0 Roadster Coupe"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-mx5-nd-2015", model: "MX-5", generation: "ND", startYear: 2015, endYear: 2023, variants: ["2.0 Roadster", "2.0 RF"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-mx5-nd-fl-2024", model: "MX-5", generation: "ND 2024 Update", startYear: 2024, variants: ["2.0 RF"], transmissions: ["AUTO", "MANUAL"] },

      // BT-50
      { id: "mazda-bt50-j97m-2007", model: "BT-50", generation: "J97M", startYear: 2007, endYear: 2011, variants: ["2.5 4x2", "2.5 4x4", "3.0 4x4"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-bt50-up-2012", model: "BT-50", generation: "UP / UR", startYear: 2012, endYear: 2020, variants: ["2.2 4x2", "2.2 4x4", "3.2 4x4"], transmissions: ["AUTO", "MANUAL"] },
      { id: "mazda-bt50-tf-2021", model: "BT-50", generation: "TF", startYear: 2021, variants: ["1.9 High", "3.0 High Plus"], transmissions: ["AUTO"] },

      // CX-30
      { id: "mazda-cx30-dm-2020", model: "CX-30", generation: "DM", startYear: 2020, endYear: 2022, variants: ["2.0 Core", "2.0 High", "2.0 High Plus"], transmissions: ["AUTO"] },
      { id: "mazda-cx30-dm-update-2023", model: "CX-30", generation: "DM 2023 Update", startYear: 2023, variants: ["2.0 High", "2.0 High Plus", "2.0 High Plus Premium"], transmissions: ["AUTO"] },

      // CX-8
      { id: "mazda-cx8-kg-2019", model: "CX-8", generation: "KG", startYear: 2019, endYear: 2021, variants: ["2.5 Mid", "2.5 High", "2.2D High", "2.5T High AWD"], transmissions: ["AUTO"] },
      { id: "mazda-cx8-kg-fl-2022", model: "CX-8", generation: "KG Facelift", startYear: 2022, variants: ["2.5 Mid", "2.5 High", "2.2D High", "2.5T High AWD"], transmissions: ["AUTO"] },

      // LARGE PLATFORM SUV
      { id: "mazda-cx60-kh-2024", model: "CX-60", generation: "KH", startYear: 2024, variants: ["3.3 Turbo Mild Hybrid AWD", "2.5 PHEV AWD"], transmissions: ["AUTO"] },
      { id: "mazda-cx80-kl-2025", model: "CX-80", generation: "KL", startYear: 2025, variants: ["2.5 PHEV AWD", "3.3 Turbo Mild Hybrid AWD"], transmissions: ["AUTO"] },
    ],
  },
  {
    make: "Lexus",
    modelOrder: [
      "LS",
      "ES",
      "GS",
      "IS",
      "RX",
      "LX",
      "SC",
      "CT",
      "NX",
      "RC",
      "LC",
      "UX",
      "LM",
      "RZ",
      "LBX",
      "GX",
    ],
    vehicles: [
      // LS
      { id: "lexus-ls-xf30-2001", model: "LS", generation: "XF30", startYear: 2001, endYear: 2006, variants: ["LS 430"], transmissions: ["AUTO"] },
      { id: "lexus-ls-xf40-2007", model: "LS", generation: "XF40", startYear: 2007, endYear: 2012, variants: ["LS 460", "LS 460L", "LS 600hL"], transmissions: ["AUTO"] },
      { id: "lexus-ls-xf40-fl-2013", model: "LS", generation: "XF40 Facelift", startYear: 2013, endYear: 2017, variants: ["LS 460 Luxury", "LS 460L", "LS 600hL"], transmissions: ["AUTO"] },
      { id: "lexus-ls-xf50-2018", model: "LS", generation: "XF50", startYear: 2018, endYear: 2020, variants: ["LS 500 Luxury", "LS 500 Executive", "LS 500h Executive"], transmissions: ["AUTO"] },
      { id: "lexus-ls-xf50-fl-2021", model: "LS", generation: "XF50 Facelift", startYear: 2021, variants: ["LS 500 Luxury", "LS 500 Executive Kiriko"], transmissions: ["AUTO"] },

      // ES
      { id: "lexus-es-xv40-2007", model: "ES", generation: "XV40", startYear: 2007, endYear: 2012, variants: ["ES 350"], transmissions: ["AUTO"] },
      { id: "lexus-es-xv60-2013", model: "ES", generation: "XV60", startYear: 2013, endYear: 2015, variants: ["ES 250", "ES 300h"], transmissions: ["AUTO"] },
      { id: "lexus-es-xv60-fl-2016", model: "ES", generation: "XV60 Facelift", startYear: 2016, endYear: 2018, variants: ["ES 250 Luxury", "ES 300h"], transmissions: ["AUTO"] },
      { id: "lexus-es-xv70-2019", model: "ES", generation: "XV70", startYear: 2019, endYear: 2021, variants: ["ES 250 Premium", "ES 250 Luxury", "ES 300h Luxury"], transmissions: ["AUTO"] },
      { id: "lexus-es-xv70-fl-2022", model: "ES", generation: "XV70 Facelift", startYear: 2022, endYear: 2025, variants: ["ES 250 Premium", "ES 250 Luxury", "ES 300h Luxury"], transmissions: ["AUTO"] },

      // GS
      { id: "lexus-gs-s160-1998", model: "GS", generation: "S160", startYear: 1998, endYear: 2004, variants: ["GS 300", "GS 430"], transmissions: ["AUTO"] },
      { id: "lexus-gs-s190-2005", model: "GS", generation: "S190", startYear: 2005, endYear: 2011, variants: ["GS 300", "GS 350", "GS 450h"], transmissions: ["AUTO"] },
      { id: "lexus-gs-l10-2012", model: "GS", generation: "L10", startYear: 2012, endYear: 2015, variants: ["GS 250", "GS 350", "GS 450h"], transmissions: ["AUTO"] },
      { id: "lexus-gs-l10-fl-2016", model: "GS", generation: "L10 Facelift", startYear: 2016, endYear: 2020, variants: ["GS 200t", "GS 300", "GS 350", "GS F"], transmissions: ["AUTO"] },

      // IS
      { id: "lexus-is-xe10-1999", model: "IS", generation: "XE10", startYear: 1999, endYear: 2005, variants: ["IS 200", "IS 300"], transmissions: ["AUTO", "MANUAL"] },
      { id: "lexus-is-xe20-2006", model: "IS", generation: "XE20", startYear: 2006, endYear: 2012, variants: ["IS 250", "IS 300", "IS F"], transmissions: ["AUTO"] },
      { id: "lexus-is-xe30-2013", model: "IS", generation: "XE30", startYear: 2013, endYear: 2016, variants: ["IS 250 Luxury", "IS 250 F Sport", "IS 300h"], transmissions: ["AUTO"] },
      { id: "lexus-is-xe30-fl-2017", model: "IS", generation: "XE30 Facelift", startYear: 2017, endYear: 2020, variants: ["IS 200t", "IS 300", "IS 300h"], transmissions: ["AUTO"] },

      // RX
      { id: "lexus-rx-xu10-1998", model: "RX", generation: "XU10", startYear: 1998, endYear: 2003, variants: ["RX 300"], transmissions: ["AUTO"] },
      { id: "lexus-rx-xu30-2004", model: "RX", generation: "XU30", startYear: 2004, endYear: 2008, variants: ["RX 330", "RX 350", "RX 400h"], transmissions: ["AUTO"] },
      { id: "lexus-rx-al10-2009", model: "RX", generation: "AL10", startYear: 2009, endYear: 2011, variants: ["RX 270", "RX 350", "RX 450h"], transmissions: ["AUTO"] },
      { id: "lexus-rx-al10-fl-2012", model: "RX", generation: "AL10 Facelift", startYear: 2012, endYear: 2014, variants: ["RX 270", "RX 350", "RX 450h"], transmissions: ["AUTO"] },
      { id: "lexus-rx-al20-2015", model: "RX", generation: "AL20", startYear: 2015, endYear: 2018, variants: ["RX 200t", "RX 300", "RX 350", "RX 450h"], transmissions: ["AUTO"] },
      { id: "lexus-rx-al20-fl-2019", model: "RX", generation: "AL20 Facelift", startYear: 2019, endYear: 2022, variants: ["RX 300 Luxury", "RX 300 F Sport", "RX 350", "RX 450h"], transmissions: ["AUTO"] },
      { id: "lexus-rx-ala10-2023", model: "RX", generation: "ALA10", startYear: 2023, variants: ["RX 350 Luxury", "RX 500h F Sport", "RX 500h F Sport Special Edition"], transmissions: ["AUTO"] },

      // LX
      { id: "lexus-lx-j100-1998", model: "LX", generation: "J100", startYear: 1998, endYear: 2007, variants: ["LX 470"], transmissions: ["AUTO"] },
      { id: "lexus-lx-j200-2008", model: "LX", generation: "J200", startYear: 2008, endYear: 2015, variants: ["LX 570"], transmissions: ["AUTO"] },
      { id: "lexus-lx-j200-fl-2016", model: "LX", generation: "J200 Facelift", startYear: 2016, endYear: 2021, variants: ["LX 570"], transmissions: ["AUTO"] },
      { id: "lexus-lx-j300-2022", model: "LX", generation: "J300", startYear: 2022, endYear: 2025, variants: ["LX 600 Luxury", "LX 600 F Sport"], transmissions: ["AUTO"] },
      { id: "lexus-lx-j300-2026", model: "LX", generation: "J300 Hybrid Update", startYear: 2026, variants: ["LX 700h Urban", "LX 700h F Sport", "LX 700h VIP"], transmissions: ["AUTO"] },

      // SC
      { id: "lexus-sc-z40-2001", model: "SC", generation: "Z40", startYear: 2001, endYear: 2010, variants: ["SC 430"], transmissions: ["AUTO"] },

      // CT
      { id: "lexus-ct-zwa10-2011", model: "CT", generation: "ZWA10", startYear: 2011, endYear: 2013, variants: ["CT 200h Luxury", "CT 200h F Sport"], transmissions: ["AUTO"] },
      { id: "lexus-ct-zwa10-fl-2014", model: "CT", generation: "ZWA10 Facelift", startYear: 2014, endYear: 2021, variants: ["CT 200h Luxury", "CT 200h F Sport"], transmissions: ["AUTO"] },

      // NX
      { id: "lexus-nx-az10-2015", model: "NX", generation: "AZ10", startYear: 2015, endYear: 2017, variants: ["NX 200t", "NX 300h"], transmissions: ["AUTO"] },
      { id: "lexus-nx-az10-fl-2018", model: "NX", generation: "AZ10 Facelift", startYear: 2018, endYear: 2021, variants: ["NX 300 Urban", "NX 300 Premium", "NX 300 F Sport", "NX 300h"], transmissions: ["AUTO"] },
      { id: "lexus-nx-az20-2022", model: "NX", generation: "AZ20", startYear: 2022, variants: ["NX 250 Luxury", "NX 350h Luxury", "NX 350 F Sport"], transmissions: ["AUTO"] },

      // RC
      { id: "lexus-rc-xc10-2015", model: "RC", generation: "XC10", startYear: 2015, endYear: 2018, variants: ["RC 200t", "RC 300", "RC 350", "RC F"], transmissions: ["AUTO"] },
      { id: "lexus-rc-xc10-fl-2019", model: "RC", generation: "XC10 Facelift", startYear: 2019, endYear: 2024, variants: ["RC 300 F Sport", "RC 350", "RC F"], transmissions: ["AUTO"] },

      // LC
      { id: "lexus-lc-z100-2018", model: "LC", generation: "Z100", startYear: 2018, variants: ["LC 500", "LC 500 Convertible", "LC 500h"], transmissions: ["AUTO"] },

      // UX
      { id: "lexus-ux-za10-2019", model: "UX", generation: "ZA10", startYear: 2019, endYear: 2022, variants: ["UX 200 Urban", "UX 200 Luxury", "UX 250h"], transmissions: ["AUTO"] },
      { id: "lexus-ux-za10-fl-2023", model: "UX", generation: "ZA10 Update", startYear: 2023, endYear: 2025, variants: ["UX 250h Luxury", "UX 250h F Sport"], transmissions: ["AUTO"] },

      // LM
      { id: "lexus-lm-ah30-2020", model: "LM", generation: "AH30", startYear: 2020, endYear: 2023, variants: ["LM 300h 7-Seater", "LM 350 4-Seater"], transmissions: ["AUTO"] },
      { id: "lexus-lm-aw10-2024", model: "LM", generation: "AW10", startYear: 2024, variants: ["LM 350h 7-Seater", "LM 500h 4-Seater"], transmissions: ["AUTO"] },

      // RZ
      { id: "lexus-rz-xebm15-2023", model: "RZ", generation: "XEBM15", startYear: 2023, endYear: 2025, variants: ["RZ 450e Luxury"], transmissions: ["AUTO"] },

      // LBX
      { id: "lexus-lbx-ay10-2024", model: "LBX", generation: "AY10", startYear: 2024, variants: ["LBX Premium", "LBX Luxury"], transmissions: ["AUTO"] },

      // GX
      { id: "lexus-gx-j150-2010", model: "GX", generation: "J150", startYear: 2010, endYear: 2023, variants: ["GX 460"], transmissions: ["AUTO"] },
      { id: "lexus-gx-j250-2024", model: "GX", generation: "J250", startYear: 2024, variants: ["GX 550 Overtrail", "GX 550 Luxury+"], transmissions: ["AUTO"] },
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
