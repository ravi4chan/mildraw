# MILDraw verification

## Latest result

**155 automated tests pass across eight test files.** Strict TypeScript compilation, Vite production build, offline precache and Cloudflare asset/header checks pass. The dependency audit reports **zero known vulnerabilities** for the current lockfile. MapLibre is pinned to 6.16.0, milsymbol to 3.0.4 and Vitest to 5.0.5. The MapLibre module worker is bundled locally and was verified rendering real map tiles in the browser.

## Automated coverage

- All 1,022 catalogue entries have unique IDs, render without undefined/NaN output, and preserve save/load compatibility.
- Every one of the 971 generated SIDCs is recognised by the renderer under all four supported affiliations (3,884 validity checks).
- Affiliation, rotation, hierarchy, palette, undo, project cloning/validation and SVG escaping.
- Original drawing geometry, pen smoothing, arc/parabolic paths, tangent arrows and shared SVG/PNG renderer.
- Closed shapes, styled/fill paths, geographic distance, sampled KML curves/circles/polygons and escaped XML labels.
- Background image transforms, coordinate/elevation conversion, grid bounds, map layer visibility, search coordinates and offline asset handling.

## Browser verification

- Equipment filtering found the Howitzer family; placement, red ink and 45° rotation worked.
- Enemy-unit filtering returned detailed Infantry variants; a placed Infantry item retained `hostile` affiliation.
- Naval search found Frigate. All 16 schematic tasks were listed. Show more increased rendered cards from48 to96.
- Rectangle, circle and polygon drawing worked. Polygon closed when clicking its first vertex. Drawing options can collapse while leaving the tool active, including at372px mobile width.
- Two map clicks produced a3.67km distance readout.
- Icon tooltip appeared after the configured one-second focus delay with the expected name.
- Clear removed all visible symbols; Undo restored all five test symbols.
- PDF and KML exports completed through the live menu and reported their completed downloads. KML serialization/content is also covered by automated tests.
- Earlier retained checks cover direct map text, place/coordinate search, image import/resize, dark logo, movable windows, elevation and compact reference/properties layout.

## Practical limits

Catalogue labels derive from renderer metadata; the library is not a certified Indian Army doctrinal dataset. The16 task graphics are original compact schematics, not full doctrinal multipoint graphics. KML preserves geographic geometry and symbol metadata through standard placemarks, while SVG/PNG/PDF preserve the military artwork. Elevation is approximate and public basemap/geocoding providers require connectivity. No claim of zero possible bugs is made.


## Deletion and launch regression
Browser tests on an isolated localhost origin verified all four removal paths: toolbar Delete, direct on-symbol Delete, Properties Remove and the Delete key. Each removed the only symbol (count0) and did not show a welcome card. Undo restored the symbol; keyboard Enter selected it and Delete removed it again. After autosave and reload, the count remained0. On the existing preview origin, launch showed0 symbols while Restore saved briefing remained available; explicit restore loaded4 saved symbols, and reloading again began empty. Startup no longer auto-centres old unplaced data. Regression tests cover exact-ID deletion of overlapping symbols, empty project save/load and Undo.
