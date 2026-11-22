# Death in America: sources, methods, and gaps

County cause-of-death explorers, added November 8, 2026.

Two pages built from IHME county files that Adam downloaded from GHDx with his own login. Both use one shared engine (`explorer.js`, `explorer.css`) and load data per cause on demand.

- `causes-1980-2014.html`: the FiveThirtyEight "35 Years of American Death" replica. Source: IHME, United States Mortality Rates by County 1980-2014 (2016), state-by-state CSV release Y2017M05D19. Annual age-standardized rates per 100,000 with 95% uncertainty intervals, both sexes (sex_id 3), 1980 to 2014, 3,142 counties plus states and the US. All 25 IHME causes in the file: all causes, 3 broad groups, 21 specific causes. Study: Dwyer-Lindgren L, et al. JAMA. 2016;316(22):2385-2401.
- `causes-2000-2019.html`: the newer series. Source: IHME, United States Mortality Rates by Causes of Death and Life Expectancy by County, Race, and Ethnicity 2000-2019 (2023), files MX_*_BOTH Y2023M06D12, plus the 2000-2019 liver cancer release (Y2024M02D08). Filters: age group 27 (age-standardized), race 1 (Total), sex 3 (Both). Values converted from deaths per person to deaths per 100,000. 24 causes: all causes, 3 broad groups, 19 specific causes, liver cancer. Study: GBD US Health Disparities Collaborators. Lancet. 2023;402(10407):1065-1082.
- Boundaries: us-atlas 3.0.1 `counties-10m.json` (Census cartographic boundaries, 1:10M), copied to `data/counties-10m.json`.
- Data files: `data/ihme-1980-2014/` and `data/ihme-2000-2019/`. `index.json` holds years, county FIPS order, names, merged-unit groups, national and state series per cause, and pooled county-year quantiles used for the color breaks. `c<cause_id>.json` holds flat arrays `v`, `lo`, `hi` (county-major, year-minor; rounded to 2 decimals under 10, 1 decimal otherwise). Build script: `data/ihme_build/build_data.py` (run on extracts of the raw zips; the extraction filtered rows with `grep` for `,1,Total,3,Both,27,Age-standardized,` before parsing).

### Processing checks

- 1980-2014: every IHME county FIPS (3,142) matches a us-atlas county and vice versa. IHME estimated 22 merged units (54 mapped counties, for example the Denver metro counties with Broomfield, several Virginia independent cities with their surrounding counties, and parts of Alaska) under separate location IDs with identical series; these were identified by identical 35-year all-cause series with identical uncertainty bounds and are labeled in the tooltip.
- 2000-2019: 3,158 county rows; 16 use retired FIPS codes (for example Dade County 12025, Shannon County 46113, Bedford City 51515) and duplicate a current county's location ID and values, so they are not drawn. Every us-atlas county has a row. 32 merged units share a location ID. 31 small counties (for example Loving County TX, Arthur County NE, Hinsdale County CO) have blank values in the IHME file for every year and cause; they are gray and labeled "IHME did not publish an estimate."
- Spot checks against the raw files: US all causes 1980 1,113.76 and 2014 785.7 (1980-2014 file); US cardiovascular 2000 360.4 per 100,000 (2000-2019 file, converted from 0.0036040 per person); Autauga County AL cardiovascular 2000 403.13 (2000-2019 file).
- The two series are different model rounds and are not spliced. For 2000, US all causes is 938.1 in the 1980-2014 file and 949.0 in the 2000-2019 file.
- Not included: FiveThirtyEight's cancer-subtype drill-down (needs IHME's separate 1980-2014 county cancer file), and the race/ethnicity and sex breakdowns in the 2000-2019 files (downloaded both-sexes files only; sex-specific files were deleted at Adam's request).
- Narrative facts on both pages were computed from the processed files on November 8, 2026.
