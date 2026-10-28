# MILDraw

A static military briefing editor with a compact, movable interface. No account, backend, API secret or voice dependency is required. Voice remains a future phase.

## Run and deploy

Use Node 24 and `npm ci`, then `npm run dev`. `npm test` runs the regression suite; `npm run build` compiles the application, precaches its offline shell and checks the Cloudflare assets. `npm run preview` serves the production build at http://127.0.0.1:5188/ with deployment headers.

Upload **mildraw-cloudflare.zip** through Cloudflare Pages Direct Upload. Its root contains index.html; do not upload the source ZIP as a built site. No environment variables are required. Existing deployments need the complete new ZIP, including the bundled map worker and symbol chunks.

## Symbol library

The library contains **1,022 templates**:

| Collection | Templates |
| --- | ---: |
| Existing formation/unit/equipment templates | 35 |
| Detailed land units | 212 |
| Land equipment and weapons | 219 |
| Aircraft | 52 |
| Naval symbols | 93 |
| Installations | 126 |
| Control measures / point graphics | 269 |
| Schematic tactical tasks | 16 |

The 971 detailed symbols use the MIT-licensed **milsymbol 3.0.4** renderer. Their catalogue is generated from the renderer's SIDC definitions with `npm run catalogue:generate`; the pinned dependency and generated JSON make it reproducible. Names and search terms derive from those icon definitions. The renderer supports MIL-STD/APP-6 symbology; this app's catalogue and task schematics are not a claim of doctrinal certification. Task graphics are compact, movable schematics rather than doctrinal multipoint overlays. Existing projects retain their original 35 template IDs and appearance.

Search the whole catalogue, select a collection/branch, or use the equipment, friendly, enemy and task shortcut icons. Friendly, hostile, neutral and unknown frames are available for the detailed symbols. Affiliation changes frame identity independently of ink. Results load 48 at a time; Show more extends the list without changing filters.

Click a template to add it at the map centre. Black is the default. Symbol inks are restricted to navy blue, green, red, blue, yellow and black. Frame, icon, formation mark and designation share the selected ink and rotate together. Drag the rotation handle, click it for +15°, hold Shift to snap, or enter an angle. Formation echelons run from Section to Command.

## Tools and interface

Tool groups use distinct icons with a **one-second delayed tooltip**, also available on keyboard focus. The library opens on launch and remains open after symbol insertion. Selecting a drawing tool tucks it away to expose the canvas; the grid icon reopens it. Floating panels and the toolbars have grips for dragging or arrow-key repositioning. The basemap selector sits beside the scale. Properties fill the remaining space beneath coordinates and scroll internally.

- **Select / pan:** drag objects, Shift-click for multiple selection, duplicate and delete.
- **Drawing:** straight lines, parabolic curves and freehand pen; one colour slider, stroke width, opacity and solid/dashed/dotted/dash-dot strokes. Curves take start, end and bend clicks.
- **Shapes:** rectangle (opposite corners), circle and star (centre/radius), polygon (vertices, then click the first point to close). Fill colour and opacity are editable. Collapse Drawing options to leave room while drawing, then reopen it as needed.
- **Text:** choose Text, click the canvas and type. Enter or clicking elsewhere commits; Escape cancels. Selected text remains editable in Properties.
- **Measure:** click two map points for geodesic distance; an image canvas reports unreferenced canvas units. Reset starts a new measurement.
- **Clear:** clears current objects and drawings, with Undo available. Undo/Redo and Help remain available in the toolbar.

Map search accepts a place name (submit, then choose a result) or `latitude, longitude` (no geocoder request). Named search uses Photon/OpenStreetMap on explicit submission. Choosing a location returns to terrain from an image workspace while preserving the separate workspaces.

Map, Terrain, Satellite, Hybrid, Sand and Whiteboard backgrounds preserve geographic positions. Satellite uses the attributed EOX Sentinel-2 cloudless **2016 archive**, not live imagery. Public tile/geocoding services need connectivity and are subject to their availability and fair-use terms. No geocoding or symbol-rendering API key is bundled.

Live coordinates show Grid, Lat/Long or Both. Cursor coordinates take priority while hovering; approximate ground elevation is decoded from AWS Terrain Tiles. Missing data and unreferenced image canvases are labelled explicitly. Displayed precision does not establish surveying accuracy.

Upload a browser-supported image under 8 MB from the header. It is rasterised locally, fitted to the unreferenced image canvas and saved with the project (longest edge reduced to 4096 pixels when necessary). Move / resize background enables image dragging, a proportional resize handle and size slider. Its placement is independent of symbols, undoable, saved and used in image/PDF exports. Remove the image in map settings. Terrain and image-canvas drawings are kept separately.

Light/dark mode covers the interface, map and symbols. Dark mode uses the supplied dark logo. Image backgrounds retain their natural colours. Exported artwork retains source ink colours rather than the display's dark-mode filter.

## Export and storage

| Format | Content |
| --- | --- |
| MILDraw JSON | Editable project, symbols, affiliations, shapes, drawings and image placement |
| PNG | Visible background and overlays, with map attribution |
| PDF | Visible background and overlays as a raster briefing page |
| SVG | Editable vector overlays; basemap and image background excluded |
| KML | Geographic points, labels and sampled line/shape geometry with SIDC/affiliation metadata; standard KML point placemarks, not embedded military artwork |

Each launch starts with an empty map. If a previous briefing exists, use **Restore saved briefing** to load it explicitly; symbols and image backgrounds are never inserted automatically. Saved work is retained while that choice is pending. Editing a new briefing starts its autosave and preserves a recovery copy of the previous project. Download JSON for a portable backup. The initial offline shell includes the symbol renderer, generated catalogue, map worker, export modules, logos and licences. New basemap/elevation/geocoding data requires a connection.

## Sources and licences

- Reference for collection breadth/tool grouping: https://sittemp.com/ . Its artwork and application code were not copied.
- Renderer: https://github.com/spatialillusions/milsymbol . Its MIT licence is bundled at `/milsymbol-LICENSE.txt`.
- Runtime licences: `/THIRD-PARTY-NOTICES.txt`.
- Terrain encoding: https://github.com/tilezen/joerd/blob/master/docs/formats.md .
- Photon: https://github.com/komoot/photon .
- Satellite archive terms: https://cloudless.eox.at/documentation/faq .


## Deleting symbols
Select a symbol, then use Delete selection in the drawing toolbar, Remove in Object Properties, the Delete key, or the × button beside that symbol's rotation handle. The direct button deletes that exact symbol ID, even if other symbols overlap it. The notification names the deleted symbol. Undo restores deletions. The last deletion leaves a clear map; there is no welcome/reference-image card or sample-symbol action. Older unplaced imported items are not automatically positioned.
