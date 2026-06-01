"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

interface ApiSpec {
  openapi?: string;
  swagger?: string;
  info?: any;
  paths?: Record<string, any>;
  components?: any;
}

export default function DocsPage() {
  const [spec, setSpec] = useState<ApiSpec | null>(null);

  useEffect(() => {
    fetch("/api/docs/spec")
      .then(res => res.json())
      .then(data => setSpec(data))
      .catch(console.error);
  }, []);

  if (!spec) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SwaggerUI spec={spec} />
    </div>
  );
}