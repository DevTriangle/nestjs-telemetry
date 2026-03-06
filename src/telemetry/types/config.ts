import { Attributes } from "@opentelemetry/api";

export interface TelemetryConfig {
  /** Service name. */
  serviceName?: string;

  /** Environment. */
  environment?: "production" | "development";

  /** OTLP traces endpoint URL. */
  otlpTracesEndpoint?: string;

  /** Default tracing attributes. */
  defaultAttributes?: Attributes;

  /** Paths to ignore. */
  ignorePaths?: string[];
}
