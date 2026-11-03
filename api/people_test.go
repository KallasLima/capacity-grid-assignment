package main

import (
	"strings"
	"testing"
)

func TestWeeklyHoursAcceptsZeroAndDecimalCapacity(t *testing.T) {
	for _, test := range []struct {
		body string
		want float64
	}{
		{`{"weeklyHours":0}`, 0},
		{`{"weeklyHours":32.25}`, 32.25},
		{`{"weeklyHours":32.29}`, 32.29},
		{`{"weeklyHours":168}`, 168},
	} {
		got, err := decodeWeeklyHours(strings.NewReader(test.body))
		if err != nil || got != test.want {
			t.Fatalf("%s: got %v, %v", test.body, got, err)
		}
	}
}

func TestWeeklyHoursRejectsAmbiguousOrInvalidUpdates(t *testing.T) {
	for _, body := range []string{
		`{}`, `null`, `[]`, `{"weeklyHours":null}`, `{"weeklyHours":"40"}`,
		`{"weeklyHours":-1}`, `{"weeklyHours":169}`, `{"weeklyHours":0.001}`, `{"weeklyHours":1e-11}`,
		`{"weeklyHours":1e999}`, `{"weeklyHours":NaN}`, `{"weeklyHours":true}`,
		`{"weeklyHours":40,"name":"changed"}`, `{"weeklyHours":40} {"weeklyHours":20}`,
	} {
		t.Run(body, func(t *testing.T) {
			if _, err := decodeWeeklyHours(strings.NewReader(body)); err == nil {
				t.Fatal("accepted invalid or ambiguous update")
			}
		})
	}
}
