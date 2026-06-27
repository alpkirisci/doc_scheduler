// Bilingual dictionaries. `en` is the canonical shape; `tr` must match its keys
// (enforced by the `Messages` type). Add a key here and both languages require it.

export type Locale = "tr" | "en";

export const en = {
  appName: "doc_scheduler",
  tagline: "Fair duty & room rosters for residents",
  nav: { projects: "Projects", newProject: "New project", signOut: "Sign out" },
  lang: { tr: "Türkçe", en: "English", label: "Language" },
  demo: {
    title: "Try the demo",
    subtitle:
      "9 residents, rooms 1/2/3/3, 21 duty days, with one hard-to-work-with colleague. Generate a fair schedule — no account needed.",
    loadDemo: "Load demo data",
    generate: "Generate schedule",
    generating: "Generating…",
    regenerate: "Regenerate",
    downloadXlsx: "Download Excel",
  },
  result: {
    fairnessScore: "Fairness score",
    feasible: "Feasible",
    infeasible: "Not possible as configured",
    solveTime: "Solved in",
    roomMatrix: "Time per room (per person)",
    person: "Person",
    total: "Total",
    withDifficult: "With difficult colleague",
    nights: "Nights",
    target: "Target",
    spreads: "Spread (max − min, lower is fairer)",
    rules: "Rules",
    neverAlone: "Never-alone breaches",
    avoidShared: "Avoid-pair shared",
    wantShared: "Want-pair shared",
    twoRooms: "2-person rooms",
    why: "Why this is fair",
  },
  fields: {
    room: "Room",
    capacity: "Capacity",
    shift: "Shift",
    date: "Date",
    difficult: "Hard to work with",
  },
};

export type Messages = typeof en;

export const tr: Messages = {
  appName: "doc_scheduler",
  tagline: "Asistanlar için adil nöbet & oda çizelgeleri",
  nav: { projects: "Projeler", newProject: "Yeni proje", signOut: "Çıkış yap" },
  lang: { tr: "Türkçe", en: "English", label: "Dil" },
  demo: {
    title: "Demoyu dene",
    subtitle:
      "9 asistan, 1/2/3/3 odalar, 21 nöbet günü ve birlikte çalışması zor bir kişi. Adil bir çizelge oluştur — hesap gerekmez.",
    loadDemo: "Demo verisini yükle",
    generate: "Çizelge oluştur",
    generating: "Oluşturuluyor…",
    regenerate: "Yeniden oluştur",
    downloadXlsx: "Excel indir",
  },
  result: {
    fairnessScore: "Adalet puanı",
    feasible: "Uygulanabilir",
    infeasible: "Bu ayarlarla mümkün değil",
    solveTime: "Çözüm süresi",
    roomMatrix: "Oda başına süre (kişi bazında)",
    person: "Kişi",
    total: "Toplam",
    withDifficult: "Zor kişiyle",
    nights: "Gece",
    target: "Hedef",
    spreads: "Fark (maks − min, düşük olması daha adil)",
    rules: "Kurallar",
    neverAlone: "Yalnız-kalmasın ihlali",
    avoidShared: "Kaçınma çifti birlikte",
    wantShared: "İstenen çift birlikte",
    twoRooms: "2 kişilik odalar",
    why: "Neden adil",
  },
  fields: {
    room: "Oda",
    capacity: "Kapasite",
    shift: "Vardiya",
    date: "Tarih",
    difficult: "Birlikte çalışması zor",
  },
};

export const dictionaries: Record<Locale, Messages> = { en, tr };
