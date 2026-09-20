/* Labour <-> site many-to-many mapping helpers (pure data, no DOM).
   LABOUR.siteId is kept as the derived "primary site": first mapped site, or null. */

function labourSiteIds(labourId) {
  return LABOUR_SITES.filter((r) => r.labourId === labourId).map((r) => r.siteId);
}
function siteLabourIds(siteId) {
  return LABOUR_SITES.filter((r) => r.siteId === siteId).map((r) => r.labourId);
}
function isUnmapped(labourId) {
  return !LABOUR_SITES.some((r) => r.labourId === labourId);
}
function _syncPrimarySite(labourId) {
  const l = LABOUR.find((x) => x.id === labourId);
  if (l) l.siteId = labourSiteIds(labourId)[0] ?? null;
}
function mapLabourToSites(labourId, siteIds) {
  const unique = [...new Set((siteIds || []).map(Number))];
  for (let i = LABOUR_SITES.length - 1; i >= 0; i--) if (LABOUR_SITES[i].labourId === labourId) LABOUR_SITES.splice(i, 1);
  for (const siteId of unique) LABOUR_SITES.push({ id: Store.nextId(LABOUR_SITES), labourId, siteId });
  _syncPrimarySite(labourId);
}
function setSiteLabour(siteId, labourIds) {
  const want = new Set((labourIds || []).map(Number));
  const have = new Set(siteLabourIds(siteId));
  let added = 0, removed = 0;
  const affected = new Set();
  for (let i = LABOUR_SITES.length - 1; i >= 0; i--) {
    const r = LABOUR_SITES[i];
    if (r.siteId === siteId && !want.has(r.labourId)) { LABOUR_SITES.splice(i, 1); removed++; affected.add(r.labourId); }
  }
  for (const labourId of want) {
    if (have.has(labourId)) continue;
    LABOUR_SITES.push({ id: Store.nextId(LABOUR_SITES), labourId, siteId });
    added++; affected.add(labourId);
  }
  affected.forEach(_syncPrimarySite);
  return { added, removed };
}
/* djb2 over the whole string, unsigned 32-bit, hex */
function biometricHash(dataUrl) {
  let h = 5381;
  const s = String(dataUrl);
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
/* Duplicate only when both the 32-bit hash (quick prefilter) and the full data URL match. */
function findBiometricDuplicate(hash, dataUrl, exceptId) {
  const biometric = BIOMETRICS.find((b) => b.hash === hash && b.imageDataUrl === dataUrl && b.id !== exceptId);
  if (!biometric) return null;
  return { biometric, labour: LABOUR.find((l) => l.id === biometric.labourId) || null };
}

/* Site names of a labour limited to the caller's scope: in-scope names, " +N other" for hidden sites, "Unmapped" when none. */
function scopedSiteNames(labourId, scopedIds) {
  const ids = labourSiteIds(labourId);
  if (!ids.length) return "Unmapped";
  const inScope = ids.filter((id) => (scopedIds || []).includes(id));
  const hidden = ids.length - inScope.length;
  const names = inScope.map((id) => { const s = SITES.find((x) => x.id === id); return s ? s.name : "—"; }).join(", ");
  if (!hidden) return names;
  return names ? `${names} +${hidden} other` : `+${hidden} other`;
}

/* Single visibility rule for manpower. Mapped: in scope if mapped to >= 1 in-scope site.
   Unmapped: visible to its creator, to level <= 1 only when deptId is null (All Departments), and to level 2. */
function labourVisible(labour, user, scopedIds, deptId) {
  if (!labour || !user) return false;
  if (labourSiteIds(labour.id).some((sid) => (scopedIds || []).includes(sid))) return true;
  if (!isUnmapped(labour.id)) return false;
  if (labour.createdBy != null && labour.createdBy === user.id) return true;
  const level = Auth.roleLevel(user);
  if (level <= 1) return deptId == null;
  return level === 2;
}
