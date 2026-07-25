# QuackViz Showcase SQL Cookbook

Each JSON file is a top-level array of flat objects and can be imported directly.

## 1. Global Development Odyssey

### Health vs. wealth, 2007
```sql
SELECT
  country,
  continent,
  gdpPercap,
  lifeExp,
  population_millions,
  development_score,
  centroid_lat,
  centroid_lon
FROM global_development_odyssey
WHERE year = 2007
ORDER BY population_millions DESC;
```

Recommended: scatter plot, GDP per capita on X, life expectancy on Y, population as point size, continent as category.

### Fastest life-expectancy gains by five-year interval
```sql
SELECT
  country,
  continent,
  year,
  life_expectancy_change_years
FROM global_development_odyssey
WHERE life_expectancy_change_years IS NOT NULL
ORDER BY life_expectancy_change_years DESC
LIMIT 25;
```

Recommended: horizontal bar chart.

### Development map
```sql
SELECT
  country,
  iso_alpha,
  centroid_lat,
  centroid_lon,
  population_millions,
  development_score,
  income_band
FROM global_development_odyssey
WHERE year = 2007;
```

Recommended: proportional-symbol map or choropleth.

### Continental trajectory
```sql
SELECT
  continent,
  year,
  SUM(estimated_gdp_billions) AS total_gdp_billions,
  SUM(population_millions) AS population_millions,
  SUM(lifeExp * population_millions) / SUM(population_millions) AS weighted_life_expectancy
FROM global_development_odyssey
GROUP BY continent, year
ORDER BY year, continent;
```

Recommended: multi-series line or area chart.

## 2. Montreal Mobility Constellation

### Mobility hotspot map
```sql
SELECT
  hotspot_id,
  latitude,
  longitude,
  car_hours,
  peak_hour,
  peak_period,
  intensity_band,
  map_symbol_size
FROM montreal_mobility_constellation;
```

Recommended: clustered point map; size by car_hours; color by peak_period.

### Rush-hour pattern
```sql
SELECT
  peak_hour,
  COUNT(*) AS hotspot_count,
  AVG(car_hours) AS avg_car_hours
FROM montreal_mobility_constellation
GROUP BY peak_hour
ORDER BY peak_hour;
```

Recommended: combo-style line/bar views or two separate saved visualizations.

## 3. Tech Stock Time Machine

### Multi-stock trend
```sql
SELECT date, symbol, price_index
FROM tech_stock_time_machine
ORDER BY date, symbol;
```

Recommended: multi-series line chart.

### Worst drawdowns
```sql
SELECT symbol, date, drawdown_pct
FROM tech_stock_time_machine
ORDER BY drawdown_pct
LIMIT 30;
```

Recommended: ranked horizontal bar.

### Volatility heatmap
```sql
SELECT
  symbol,
  month,
  AVG(rolling_7_volatility_pct) AS avg_volatility
FROM tech_stock_time_machine
GROUP BY symbol, month
ORDER BY month, symbol;
```

Recommended: heatmap.

## 4. Iris Morphology Lab

### Species clusters
```sql
SELECT
  species,
  petal_length,
  petal_width,
  sepal_length,
  petal_area,
  petal_size_band
FROM iris_morphology_lab;
```

Recommended: scatter plot, petal length vs width, color by species, size by sepal length.

### Distribution summary
```sql
SELECT
  species,
  AVG(petal_area) AS avg_petal_area,
  STDDEV_SAMP(petal_area) AS sd_petal_area,
  MIN(petal_area) AS min_petal_area,
  MAX(petal_area) AS max_petal_area
FROM iris_morphology_lab
GROUP BY species;
```

Recommended: grouped bars or KPI cards.

## 5. Wind Rose Observatory

### Direction-strength matrix
```sql
SELECT
  direction,
  direction_degrees,
  strength,
  strength_order,
  frequency_pct
FROM wind_rose_observatory
ORDER BY direction_degrees, strength_order;
```

Recommended: heatmap or polar chart where supported.

### Dominant directions
```sql
SELECT
  direction,
  SUM(frequency_pct) AS total_frequency
FROM wind_rose_observatory
GROUP BY direction
ORDER BY total_frequency DESC;
```

Recommended: ranked bar chart.