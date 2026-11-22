# Wayfarer trip planner

Open `index.html` in a modern browser to use the planner. Each launch starts with a choice to open an existing Excel itinerary or create a new one. Your work stays in the browser until you export it.

## Plan and share

- Add trip details and dates, then add days and activities with times, locations, and notes.
- Add trip essentials, mark them packed, and include the checklist with your exports.
- Drag a day by its grip to change the itinerary order. Drag an activity to reorder it or move it to another day.
- Select **Export Excel** to download a shareable `.xlsx` workbook with colorful title bands, day-tinted itinerary rows, readable column widths, and **Trip**, **Itinerary**, and **Essentials** sheets.
- Select **Make PDF** for a print-ready itinerary, then choose **Save as PDF** in the browser's print dialog.
- Select **Import Excel** to reopen a workbook. The itinerary sheet uses columns named `Day`, `Date`, `Time`, `Activity`, `Location`, and `Notes`; the Trip sheet stores trip name, destination, and dates; the Essentials sheet stores item names and packed status.

Excel import/export uses xlsx-js-style from jsDelivr, so an internet connection is needed for Excel features. The rest of the planner works locally in your browser.
