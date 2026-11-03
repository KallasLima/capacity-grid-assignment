package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
)

func decodeWeeklyHours(body io.Reader) (float64, error) {
	var input struct {
		WeeklyHours json.RawMessage `json:"weeklyHours"`
	}
	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return 0, err
	}
	var extra any
	if err := decoder.Decode(&extra); err == nil {
		return 0, fmt.Errorf("expected one JSON object")
	} else if err != io.EOF {
		return 0, err
	}
	raw := bytes.TrimSpace(input.WeeklyHours)
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return 0, fmt.Errorf("weeklyHours is required")
	}
	var hours float64
	if err := json.Unmarshal(raw, &hours); err != nil {
		return 0, fmt.Errorf("weeklyHours must be a number")
	}
	if math.IsNaN(hours) || math.IsInf(hours, 0) || hours < 0 || hours > 168 ||
		hours != math.Round(hours*100)/100 {
		return 0, fmt.Errorf("weeklyHours must be between 0 and 168 with at most two decimal places")
	}
	return hours, nil
}

func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil || id < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid person ID."})
		return
	}
	hours, err := decodeWeeklyHours(http.MaxBytesReader(w, r.Body, 4096))
	if err != nil {
		status := http.StatusBadRequest
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		writeJSON(w, status, map[string]string{"error": "Enter weekly hours from 0 to 168, with at most two decimal places."})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), databaseTimeout)
	defer cancel()
	var updated person
	err = s.db.QueryRow(ctx, `
        UPDATE people SET weekly_hours = $1
        WHERE id = $2
        RETURNING id, name, weekly_hours::double precision`, hours, id).
		Scan(&updated.ID, &updated.Name, &updated.WeeklyHours)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Person not found."})
		return
	}
	if err != nil {
		log.Printf("save weekly hours: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Could not save weekly hours. Please try again."})
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
