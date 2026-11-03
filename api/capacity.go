package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

const dateLayout = "2006-01-02"
const databaseTimeout = 5 * time.Second

type capacityWeek struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type person struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	WeeklyHours float64 `json:"weeklyHours"`
}

type capacityPerson struct {
	person
	AllocatedHours []float64 `json:"allocatedHours"`
}

type capacityResponse struct {
	From   string           `json:"from"`
	To     string           `json:"to"`
	Weeks  []capacityWeek   `json:"weeks"`
	People []capacityPerson `json:"people"`
	Total  int              `json:"total"`
	Offset int              `json:"offset"`
	Limit  int              `json:"limit"`
}

type capacityRange struct {
	from, to time.Time
	offset   int
	limit    int
}

func parseCapacityRange(query url.Values) (capacityRange, error) {
	var result capacityRange
	from, err := time.Parse(dateLayout, query.Get("from"))
	if err != nil || from.Year() < 1 {
		return result, fmt.Errorf("from must be a valid YYYY-MM-DD date")
	}
	to, err := time.Parse(dateLayout, query.Get("to"))
	if err != nil || to.Year() < 1 {
		return result, fmt.Errorf("to must be a valid YYYY-MM-DD date")
	}
	if to.Before(from) {
		return result, fmt.Errorf("to must be on or after from")
	}
	// Dates represent calendar days, not local timestamps. Always include the
	// complete Monday–Sunday weeks touching the selected range.
	result.from = from.AddDate(0, 0, -(int(from.Weekday())+6)%7)
	lastMonday := to.AddDate(0, 0, -(int(to.Weekday())+6)%7)
	result.to = lastMonday.AddDate(0, 0, 6)
	if result.to.Year() > 9999 || lastMonday.Sub(result.from)/(7*24*time.Hour)+1 > 106 {
		return capacityRange{}, fmt.Errorf("choose a range of at most 106 weeks")
	}
	result.limit = 50
	if raw := query.Get("limit"); raw != "" {
		result.limit, err = strconv.Atoi(raw)
		if err != nil || result.limit < 1 || result.limit > 100 {
			return capacityRange{}, fmt.Errorf("limit must be between 1 and 100")
		}
	}
	if raw := query.Get("offset"); raw != "" {
		result.offset, err = strconv.Atoi(raw)
		if err != nil || result.offset < 0 {
			return capacityRange{}, fmt.Errorf("offset must be a non-negative integer")
		}
	}
	return result, nil
}

// Both pool and transaction satisfy this small boundary, allowing the real SQL
// to be checked against isolated transactional fixtures.
type capacityDB interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

const capacityQuery = `
WITH page AS MATERIALIZED (
    SELECT id, name, weekly_hours
    FROM people
    ORDER BY name, id
    LIMIT $3 OFFSET $4
), weeks AS (
    SELECT day::date AS week_start
    FROM generate_series($1::date, $2::date, interval '1 week') AS series(day)
), scoped_assignments AS MATERIALIZED (
    SELECT a.person_id, a.start_date, a.end_date, a.hours_per_day
    FROM assignments a
    JOIN page p ON p.id = a.person_id
    WHERE a.start_date <= $2::date AND a.end_date >= $1::date
), allocated AS (
    SELECT a.person_id, w.week_start,
           SUM(a.hours_per_day * (
               SELECT count(*)
               FROM generate_series(0, 4) AS weekdays(day)
               WHERE w.week_start + weekdays.day BETWEEN a.start_date AND a.end_date
           ))::double precision AS hours
    FROM scoped_assignments a
    JOIN weeks w ON a.start_date <= w.week_start + 6
                AND a.end_date >= w.week_start
    GROUP BY a.person_id, w.week_start
)
SELECT p.id, p.name, p.weekly_hours::double precision,
       array_agg(COALESCE(a.hours, 0)::double precision ORDER BY w.week_start)
FROM page p
CROSS JOIN weeks w
LEFT JOIN allocated a ON a.person_id = p.id AND a.week_start = w.week_start
GROUP BY p.id, p.name, p.weekly_hours
ORDER BY p.name, p.id`

func loadCapacity(ctx context.Context, db capacityDB, selected capacityRange) (capacityResponse, error) {
	result := capacityResponse{
		From: selected.from.Format(dateLayout), To: selected.to.Format(dateLayout),
		Weeks: []capacityWeek{}, People: []capacityPerson{},
		Offset: selected.offset, Limit: selected.limit,
	}
	for start := selected.from; !start.After(selected.to); start = start.AddDate(0, 0, 7) {
		result.Weeks = append(result.Weeks, capacityWeek{
			Start: start.Format(dateLayout), End: start.AddDate(0, 0, 6).Format(dateLayout),
		})
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM people`).Scan(&result.Total); err != nil {
		return result, err
	}
	rows, err := db.Query(ctx, capacityQuery, result.From, result.To, selected.limit, selected.offset)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var entry capacityPerson
		if err := rows.Scan(&entry.ID, &entry.Name, &entry.WeeklyHours, &entry.AllocatedHours); err != nil {
			return result, err
		}
		result.People = append(result.People, entry)
	}
	return result, rows.Err()
}

func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	selected, err := parseCapacityRange(r.URL.Query())
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), databaseTimeout)
	defer cancel()
	result, err := loadCapacity(ctx, s.db, selected)
	if err != nil {
		log.Printf("load capacity: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Could not load capacity. Please try again."})
		return
	}
	writeJSON(w, http.StatusOK, result)
}
