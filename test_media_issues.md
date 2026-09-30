# Media Plugin Issues Debug

## Issues Found:

1. **Stream button does nothing**
   - Need to check if backend endpoint is being called
   - Check browser console for errors

2. **Series not working**
   - Backend returns full series with seasons
   - Frontend may not be handling the data correctly

3. **Search results missing year**
   - Search results should show release year

4. **Search results not clickable properly**
   - Clicking should show details, not just hide search

## Files to check:
- src/backend/app/plugins/media/routes.py
- src/backend/app/plugins/media/controller/media_controller.py
- src/backend/app/plugins/media/controller/tmdb_controller.py
- src/frontend/src/plugins/media/components/MovieDetails.tsx
- src/frontend/src/plugins/media/components/SeriesDetails.tsx
- src/frontend/src/plugins/media/components/SearchResults.tsx
