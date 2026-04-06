"use client";

import { useState, useEffect } from "react";

type DataType =
  | "applications"
  | "interviews"
  | "cv-packages"
  | "emails"
  | "metrics"
  | "content-calendar";

export function useData<T>(type: DataType) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/data?type=${type}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch ${type}`);
        return r.json();
      })
      .then((d) => {
        setData(d.data || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [type]);

  return { data, loading, error, setData };
}
