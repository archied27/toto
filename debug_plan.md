# Debug Plan for Media Plugin Issues

## Issue 1: Stream button does nothing
**Hypothesis**: The frontend is calling the API but backend may not be opening the browser
**Check**: Verify webbrowser.open() is working

## Issue 2: Series still don't work
**Hypothesis**: Backend now fetches seasons but it might be slow or failing
**Check**: The get_series_details loops through all seasons synchronously - this could timeout

## Issue 3: Search results no longer have year
**Hypothesis**: Code shows `{result.release_date?.slice(0, 4)}` which should work
**Check**: Maybe release_date is null/undefined for some results

## Issue 4: Clicking search results just hides search
**Hypothesis**: The onClick sets state correctly
**Check**: Maybe the detail components aren't rendering

## Root Cause Analysis:
Looking at tmdb_controller.py line 124:
```python
for season_num in range(1, data["number_of_seasons"] + 1):
    season_details = await self.get_season_details(id, season_num)
```
This is making N sequential API calls! For a show with 10 seasons, that's 10+ API calls that happen synchronously.
This is likely TIMING OUT or taking too long.

## Fix Strategy:
1. Make season fetching async and parallel
2. Add error handling
3. Check if search results have release_date
4. Verify stream endpoint returns correctly
