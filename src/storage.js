const KEY = "coffee_roast_data";
const VERSION = 3;

function migrate(raw) {
  const v = raw.version || 1;
  let data = { ...raw };

  // v1 → v2: add batchWeightIn, batchWeightOut, colourLevel, comments, rating
  if (v < 2) {
    data.beans = (data.beans || []).map((bean) => ({
      ...bean,
      roasts: (bean.roasts || []).map((roast) => ({
        batchWeightIn: null,
        batchWeightOut: null,
        colourLevel: null,
        comments: [],
        rating: 0,
        ...roast,
      })),
    }));
  }

  // v2 → v3: add exhaustTemp: null to each roast entry (old data won't have it)
  if (v < 3) {
    data.beans = (data.beans || []).map((bean) => ({
      ...bean,
      roasts: (bean.roasts || []).map((roast) => ({
        ...roast,
        entries: (roast.entries || []).map((entry) => ({
          exhaustTemp: null, // default — will be overwritten if already present
          ...entry,
        })),
      })),
    }));
  }

  return { ...data, version: VERSION };
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { version: VERSION, beans: [] };
    return migrate(JSON.parse(raw));
  } catch {
    return { version: VERSION, beans: [] };
  }
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function exportJSON(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `coffee-roast-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.beans) throw new Error("Not a valid backup file");
        resolve(migrate(parsed));
      } catch (err) {
        reject(new Error("Invalid backup file: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}
