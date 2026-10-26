# Death in America: sources, methods, and gaps

Two pages, built October 26, 2026. Published to adamtroy.net October 26, 2026.

## The pages

- `index.html`: Version 1, national trends. Interactive line chart of age-adjusted death rates for leading causes, 1999 to 2024, plus a ranked bar view by year. Fully self-contained (data embedded). Full 113-cause detail through 2020; the 15 leading causes, all causes, and drug overdose extended through 2024.
- `county-maps.html`: Version 2, county maps. Interactive Leaflet choropleth for heart disease and stroke, adults age 35 and older, across seven rolling three-year periods (2015-2017 through 2022-2024), with a play button. Fully self-contained (boundaries and rates embedded). Requires an internet connection for the Leaflet library and the CARTO basemap tiles.
- `data/`: underlying data files (see below).

## Sources used

### National trends (index.html)

1. CDC WONDER, Underlying Cause of Death, 1999 to 2020, dataset D76 (bridged race), queried October 26, 2026 via the WONDER API. National deaths by underlying cause (ICD-10), NCHS 113-cause list. Age-adjusted rates use the 2000 US standard population. File: `data/national_113_1999_2020.json` (49 ranked causes, 1999 to 2020; death counts and age-adjusted rates). Verified spot values: heart disease 1999, 725,192 deaths, rate 266.5; heart disease 2020, 696,962 deaths, rate 168.2; COVID-19 (U07.1) 2020, 350,831 deaths, rate 85.0. No ranked national row was suppressed or flagged unreliable.
2. CDC WONDER, same dataset, drug overdose query, queried October 26, 2026. Drug overdose defined as ICD-10 X40-X44, X60-X64, X85, Y10-Y14 (underlying cause). File: `data/national_overdose_1999_2020.json`. Verified: 1999, 16,849 deaths, rate 6.1; 2020, 91,799 deaths, rate 28.3.
3. CDC WONDER, same dataset, all-causes query, queried October 26, 2026. File: `data/national_allcause_1999_2020.json`. Verified: 1999, 2,391,399 deaths, rate 875.6; 2019, 2,854,838 deaths, rate 715.2; 2020, 3,383,729 deaths, rate 835.4.
4. CDC WONDER, Underlying Cause of Death, 2018 to 2024, dataset D158 (single race), queried October 26, 2026 via the WONDER web interface (live-browser query; the D158 API parameter set could not be validated, so the web interface was used). National deaths by underlying cause (ICD-10), NCHS 113-cause list, plus all-cause totals and a drug/alcohol-induced grouping. Used for 2021 to 2024: the 15 leading causes, all causes, and drug overdose (X40-X44, X60-X64, X85, Y10-Y14). Overlap validation against D76: exact match for 2018, 2019, and 2020 on all causes, heart disease, and cancer (0 deaths and 0.0 rate difference), so the two files are plotted as one series. File: `data/national_top15_2021_2024.json`. Key values: all-cause rate peaked at 879.7 in 2021 (3,464,231 deaths) and fell to 722.1 in 2024 (3,072,666 deaths); COVID-19 peaked at 416,893 deaths in 2021 (rate 104.1) and fell to 31,426 in 2024 (rate 7.3, 15th); overdose peaked at 107,941 in 2022 and fell to 79,384 in 2024. The earlier provisional 2024 release (overall rate 722.0; heart 683,037; cancer 619,812; unintentional injury 196,488) is superseded by these D158 values.
5. NCHS Data Brief No. 521 (December 2024), final data for 2023: 3,090,964 resident deaths. Corroborates the D158 2023 all-cause count exactly; no longer needed for the page narrative.
6. NCHS Vital Statistics Rapid Release No. 039 (September 2025), provisional data for 2024: overall age-adjusted rate 722.0 per 100,000. Superseded by the D158 values above.
7. FiveThirtyEight, "35 Years of American Death" (2017, updated 2018): the model for this piece (animated county maps of leading causes, 1980 to 2014, from Institute for Health Metrics and Evaluation estimates, age-standardized).

### County maps (county-maps.html)

8. CDC Interactive Atlas of Heart Disease and Stroke, county datasets via CDC Socrata (data.cdc.gov), downloaded October 26, 2026 (script: `data/fetch_county.py`). Seven rolling three-year periods per cause: 2015-2017, 2016-2018, 2017-2019, 2018-2020, 2019-2021, 2021-2023, 2022-2024. Adults age 35 and older, overall race and ethnicity, both sexes. Rates are age-standardized, spatially smoothed, three-year averages, per 100,000. Source deaths: National Vital Statistics System. File: `data/county_heart_stroke.json` (3,226 counties per period; counties with insufficient data stored as null). Dataset IDs: heart disease mfvi-hkb9, 6x7h-usvx, s6p7-fvbw, jiwm-ppbh, 55yu-xksw, th8y-thx5, mri7-5jtw; stroke v246-z5tb, tqwu-4a7k, ua33-yiiu, g5fg-bgtw, vutr-sfkh, cpdh-8cna, y5ii-knwc. Each dataset was validated on download (3,226 county rows, one data value type, anchor year equal to the middle year of its period).
9. CDC Atlas of Heart Disease and Stroke, Data Sources page (cdc.gov): ICD-10 mortality definitions. All Heart Disease: I00-I09, I11, I13, I20-I51, underlying cause. All Stroke: I60-I69, underlying cause. Deaths from the National Vital Statistics System.
10. County boundaries: Plotly geojson-counties-fips.json (US county boundaries, FIPS-keyed), 3,221 features, simplified for embedding (coordinates rounded to 3 decimals, properties reduced to county name and state). Files: `data/counties_geo.json` (original), `data/counties_geo_simple.json` (embedded version).

## Methods and reading notes

- Age-adjusted rates remove the effect of a changing age structure and are the right measure for comparing risk over time. Death counts show absolute burden. Both are shown on the national page.
- The county rates cover adults age 35 and older only, so they run much higher than the all-ages national rates and must not be compared directly with them.
- County rates are spatially smoothed (each county's published rate borrows strength from neighbors). Smoothed rates stabilize small counties but soften sharp local differences. They are estimates for mapping, not raw counts divided by populations.
- Each county period is a three-year average that overlaps the next (for example, 2019-2021 shares two years with 2018-2020 and with 2021-2023). Frame-to-frame change is muted by design. Read the maps for persistent geographic patterns and for the endpoints.
- County medians reported on the county page are unweighted across counties (small counties count the same as large ones), unlike population-weighted national rates.
- Suppression: counties with insufficient data are shown in gray, never as zero. Counts: heart disease, 6 suppressed counties in 2015-2017 through 2019-2021, 16 in 2021-2023 and 2022-2024; stroke, 7 to 22 depending on period. Connecticut's eight counties are insufficient data in 2021-2023 and 2022-2024 because Connecticut replaced counties with planning regions.
- Boundary mismatch: 8 counties in the source data have no polygon in the boundary file (territories and two renamed counties: Kusilvak, AK, 02158; Oglala Lakota, SD, 46102; plus 60000, 66010, 69000, 78010, 78020, 78030), and 3 boundary polygons have no source row (Valdez-Cordova, AK, 02270; Shannon County, SD, 46113; Bedford city, VA, 51515). Under 0.4 percent of counties affected.
- Overdose deaths overlap with unintentional injuries, suicide, homicide, and undetermined-intent deaths by definition, so overdose must not be added to those categories.
- No figure on either page is estimated, interpolated, or invented. Every number comes from one of the sources above.

## What could not be verified or obtained (gaps, stated on the pages)

1. County maps for causes beyond heart disease and stroke (cancer, unintentional injuries, chronic lower respiratory diseases, Alzheimer disease, diabetes, suicide, homicide, drug overdose). Complete, recent, public county-by-cause rates for those causes are not available as bulk downloads. The CDC WONDER web interface holds county-level underlying-cause data, but the WONDER API returns national data only (confirmed in CDC's API help and the wonderapi readme). The NCHS public-use multiple-cause microdata files were checked directly (2023 file, 818-character fixed-width records, official layout): positions 21-62 are reserved and the file contains no county or state of residence, so county rates cannot be built from microdata. The IHME county files ("United States Mortality Rates by Causes of Death and Life Expectancy by County, Race, and Ethnicity 2000-2019", 19 causes, age-standardized) require a registered GHDx login, which was not used. The NCHS drug poisoning county dataset gives binned ranges, not point rates, and ends in 2015, so it was not used.
2. The 538 original covered 1980 to 2014 from IHME modeled estimates. This build does not reproduce the 1980 to 2014 county series; the national page starts in 1999 (the WONDER ICD-10 era) and the county maps start in 2015.

## Gaps closed after the first build

- National data for 2021 to 2024: closed October 26, 2026 via a live-browser CDC WONDER D158 web-interface query (see source 4 above). The 2018 to 2020 overlap matched the D76 file exactly, so the national page now runs 1999 to 2024, with full 113-cause detail through 2020 and the 15 leading causes for 2021 to 2024.

## Browser task still open (county maps only)

A live-browser task (not available to a generic subagent) could still add county maps for causes beyond heart disease and stroke, through the CDC WONDER web interface at wonder.cdc.gov: county-level queries by underlying cause for the leading causes (heart disease, cancer, unintentional injuries, stroke, chronic lower respiratory diseases, Alzheimer disease, diabetes, suicide, homicide, drug overdose), grouped by county and year or multi-year period, with age-adjusted rates. Note WONDER suppresses counts under 10 at county level; small-county rates will be suppressed or unstable and must be labeled as such. Alternative: IHME county files 2000 to 2019 with Adam-authorized GHDx access (registration and sign-in required; do not create an account without his explicit authorization). The national extension item from the original version of this section was closed October 26, 2026 (see source 4).

## Verification performed October 26, 2026

- WONDER API: D76 113-cause query returned 2,857 rows, 1999 to 2020, 134 cause labels; ranked ("#") causes extracted (49). Cross-checked heart disease 1999 and 2020 and COVID-19 2020 against the earlier ICD-range query (exact match). Overdose and all-cause batch queries returned HTTP 200 with expected row counts (22 years each).
- County downloads: all 14 datasets returned 3,226 county rows with a single data value type; suppressed counts recorded per period.
- Pages: JavaScript syntax-checked with node; national chart logic smoke-tested in Node (SVG renders, ranked view returns 12 rows with correct totals, log scale with all causes enabled no longer overflows); county logic smoke-tested (color bins, stats line, legend, cause and period switching). No em dashes in either page. No live-browser rendering test was possible from this subagent; Adam's review should include opening both pages in a browser and pressing play on the county map. The national page was re-checked after the 2021-2024 extension (October 26, 2026): embedded data re-parsed and verified (heart disease 2024, COVID-19 2021, all-cause 2024, overdose 2024), and the page was published to adamtroy.net and verified live.
