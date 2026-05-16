"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LocationOption {
  location_code: number;
  location_name: string;
}

export interface LocationSelection {
  country: { code: number; name: string };
  state: { code: number; name: string } | null;
  city: { code: number; name: string } | null;
  location_code: number;
}

interface LocationFilterProps {
  onLocationChange: (location: LocationSelection) => void;
  defaultCountryCode?: number;
  className?: string;
}

const DEFAULT_COUNTRY_CODE = 2356; // India

export function LocationFilter({
  onLocationChange,
  defaultCountryCode = DEFAULT_COUNTRY_CODE,
  className,
}: LocationFilterProps) {
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [states, setStates] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationOption[]>([]);

  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const [countryCode, setCountryCode] = useState<number | null>(null);
  const [stateCode, setStateCode] = useState<number | null>(null);
  const [cityCode, setCityCode] = useState<number | null>(null);

  const statesAbortRef = useRef<AbortController | null>(null);
  const citiesAbortRef = useRef<AbortController | null>(null);

  // Keep the latest callback in a ref so cascade fetches don't re-run because
  // the parent passed a new inline function on re-render.
  const onChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  // 1. Fetch countries on mount and preselect the default country if present.
  useEffect(() => {
    let cancelled = false;
    setLoadingCountries(true);
    apiClient<LocationOption[]>("/locations/countries")
      .then((rows) => {
        if (cancelled) return;
        setCountries(rows);
        const preset = rows.find((r) => r.location_code === defaultCountryCode);
        if (preset) setCountryCode(preset.location_code);
      })
      .catch((err) => {
        if (!cancelled) console.error("[LocationFilter] countries load failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingCountries(false);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultCountryCode]);

  // 2. When country changes, fetch its states (and reset state/city below).
  useEffect(() => {
    setStates([]);
    setStateCode(null);
    setCities([]);
    setCityCode(null);
    if (countryCode == null) return;

    statesAbortRef.current?.abort();
    const controller = new AbortController();
    statesAbortRef.current = controller;

    setLoadingStates(true);
    apiClient<LocationOption[]>(`/locations/states?country_code=${countryCode}`, {
      signal: controller.signal,
    })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setStates(rows);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[LocationFilter] states load failed:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStates(false);
      });

    return () => controller.abort();
  }, [countryCode]);

  // 3. When state changes, fetch its cities.
  useEffect(() => {
    setCities([]);
    setCityCode(null);
    if (stateCode == null) return;

    citiesAbortRef.current?.abort();
    const controller = new AbortController();
    citiesAbortRef.current = controller;

    setLoadingCities(true);
    apiClient<LocationOption[]>(`/locations/cities?state_code=${stateCode}`, {
      signal: controller.signal,
    })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setCities(rows);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[LocationFilter] cities load failed:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCities(false);
      });

    return () => controller.abort();
  }, [stateCode]);

  // Emit only on explicit user picks — never from cascade-effect side effects.
  function emit(
    country: LocationOption,
    state: LocationOption | null,
    city: LocationOption | null
  ) {
    const location_code = city?.location_code ?? state?.location_code ?? country.location_code;
    onChangeRef.current({
      country: { code: country.location_code, name: country.location_name },
      state: state ? { code: state.location_code, name: state.location_name } : null,
      city: city ? { code: city.location_code, name: city.location_name } : null,
      location_code,
    });
  }

  const handleCountryChange = (value: string) => {
    const code = Number(value);
    setCountryCode(code);
    setStateCode(null);
    setCityCode(null);
    const country = countries.find((c) => c.location_code === code);
    if (country) emit(country, null, null);
  };

  const handleStateChange = (value: string) => {
    const code = Number(value);
    setStateCode(code);
    setCityCode(null);
    const country = countries.find((c) => c.location_code === countryCode);
    const state = states.find((s) => s.location_code === code);
    if (country && state) emit(country, state, null);
  };

  const handleCityChange = (value: string) => {
    const code = Number(value);
    setCityCode(code);
    const country = countries.find((c) => c.location_code === countryCode);
    const state = states.find((s) => s.location_code === stateCode);
    const city = cities.find((c) => c.location_code === code);
    if (country && state && city) emit(country, state, city);
  };

  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      <Field label="Country" loading={loadingCountries}>
        <Select
          value={countryCode != null ? String(countryCode) : undefined}
          onValueChange={handleCountryChange}
          disabled={loadingCountries || countries.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((c) => (
              <SelectItem key={c.location_code} value={String(c.location_code)}>
                {c.location_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="State" loading={loadingStates}>
        <Select
          value={stateCode != null ? String(stateCode) : undefined}
          onValueChange={handleStateChange}
          disabled={countryCode == null || loadingStates || states.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select State" />
          </SelectTrigger>
          <SelectContent>
            {states.map((s) => (
              <SelectItem key={s.location_code} value={String(s.location_code)}>
                {s.location_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="City" loading={loadingCities}>
        <Select
          value={cityCode != null ? String(cityCode) : undefined}
          onValueChange={handleCityChange}
          disabled={stateCode == null || loadingCities}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                stateCode != null && !loadingCities && cities.length === 0
                  ? "No cities available"
                  : "Select City"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c.location_code} value={String(c.location_code)}>
                {c.location_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function Field({
  label,
  loading,
  children,
}: {
  label: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        {loading && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>
      {children}
    </div>
  );
}

export default LocationFilter;
